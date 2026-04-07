import { logLoaderVerbose } from '../LoaderUtils';
import {
  decodeDXT1 as decodeDXT1Impl,
  decodeDXT1Downsampled as decodeDXT1DownsampledImpl,
  decodeDXT5 as decodeDXT5Impl,
  decodeDXT5Downsampled as decodeDXT5DownsampledImpl,
  getBlockCompressedExpectedSize,
} from './DXTDecoder';
import {
  convertRGtoRGBA as convertRGtoRGBAImpl,
  convertRtoRGBA as convertRtoRGBAImpl,
  createPNG as createPNGImpl,
  cropRGBA as cropRGBAImpl,
  downsampleRGBA as downsampleRGBAImpl,
  float16ToFloat32 as float16ToFloat32Impl,
  parseJpegDimensions as parseJpegDimensionsImpl,
} from './TexImageProcessor';
import {
  pngAddAlphaFromBrightness as pngAddAlphaFromBrightnessImpl,
  texToUrl as texToUrlImpl,
} from './TexUrlConverter';
import {
  decodeDxt1Path,
  decodeDxt5Path,
  decodeRPath,
  decodeRgPath,
  decodeRgbaPath,
  type TexDecodeContext as BranchTexDecodeContext,
} from './TexDecodePaths';

const console = { ...globalThis.console, log: logLoaderVerbose };

interface TexHeaderInfo {
  magic: string;
  version: string;
  texiPos: number;
  texiMagic: string;
}

function parseTexHeader(data: Uint8Array): TexHeaderInfo {
  const magic = String.fromCharCode(data[0], data[1], data[2], data[3]);
  const version = String.fromCharCode(data[4], data[5], data[6], data[7]);
  const texiPos = 9;
  const texiMagic = String.fromCharCode(data[texiPos], data[texiPos + 1], data[texiPos + 2], data[texiPos + 3]);
  return { magic, version, texiPos, texiMagic };
}

function findSequence(data: Uint8Array, sequence: number[]): number {
  outer: for (let i = 0; i <= data.length - sequence.length; i++) {
    for (let j = 0; j < sequence.length; j++) {
      if (data[i + j] !== sequence[j]) continue outer;
    }
    return i;
  }
  return -1;
}

function lz4Decompress(input: Uint8Array, outputSize: number): Uint8Array {
  const output = new Uint8Array(outputSize);
  let inputPos = 0;
  let outputPos = 0;
  while (inputPos < input.length && outputPos < outputSize) {
    const token = input[inputPos++];
    let literalLength = token >> 4;
    if (literalLength === 15) {
      let len = 255;
      while (len === 255 && inputPos < input.length) {
        len = input[inputPos++];
        literalLength += len;
      }
    }
    for (let i = 0; i < literalLength && inputPos < input.length && outputPos < outputSize; i++) {
      output[outputPos++] = input[inputPos++];
    }
    if (inputPos >= input.length || inputPos + 1 >= input.length) break;
    const offset = input[inputPos] | (input[inputPos + 1] << 8);
    inputPos += 2;
    if (offset === 0 || offset > outputPos) break;
    let matchLength = token & 0x0f;
    if (matchLength === 15) {
      let len = 255;
      while (len === 255 && inputPos < input.length) {
        len = input[inputPos++];
        matchLength += len;
      }
    }
    matchLength += 4;
    const matchStart = outputPos - offset;
    for (let i = 0; i < matchLength && outputPos < outputSize; i++) {
      output[outputPos++] = output[matchStart + i];
    }
  }
  return output.slice(0, outputPos);
}

/**
 * Wallpaper Engine TEX 纹理文件解析器
 * 
 * TEX 是 Wallpaper Engine 的自定义纹理格式，内部可能包含 JPEG/PNG 等图像数据，
 * 或者是 LZ4 压缩的原始像素数据。
 * 
 * 格式参考: https://github.com/notscuffed/repkg
 */

export interface TexInfo {
  /** 版本 */
  version: string;
  /** 宽度 */
  width: number;
  /** 高度 */
  height: number;
  /** 图像格式 */
  format: 'jpeg' | 'png' | 'raw' | 'mp4' | 'unknown';
  /** 图像数据 */
  imageData: Uint8Array;
  /** 原始像素通道数 (1=R, 2=RG, 4=RGBA) */
  channels?: number;
  /** spritesheet 列数 */
  spritesheetCols?: number;
  /** spritesheet 行数 */
  spritesheetRows?: number;
  /** spritesheet 总帧数 */
  spritesheetFrames?: number;
  /** spritesheet 动画时长（秒） */
  spritesheetDuration?: number;
  /** spritesheet 单帧宽度（像素，TEXS 原始数据） */
  spritesheetFrameWidth?: number;
  /** spritesheet 单帧高度（像素，TEXS 原始数据） */
  spritesheetFrameHeight?: number;
}

export interface TexDecodeOptions {
  /** 将单通道/双通道纹理的 R 通道作为 alpha（用于粒子 mask） */
  alphaFromRed?: boolean;
  /** 将双通道纹理的 G 通道作为 alpha（用于粒子 mask） */
  alphaFromGreen?: boolean;
  /** 最大纹理尺寸（单边），超过此尺寸的纹理会选择更小的 mipmap 层级 */
  maxSize?: number;
}

export type TexAlphaMode = 'opaque' | 'fromBrightness';

export interface TexUrlOptions {
  /**
   * RGB PNG（无 alpha）处理方式：
   * - opaque: 保持不透明（默认）
   * - fromBrightness: 使用亮度生成 alpha（粒子纹理）
   */
  alphaMode?: TexAlphaMode;
}

/**
 * 解析 TEX 文件
 */
export function parseTex(buffer: ArrayBuffer, options: TexDecodeOptions = {}): TexInfo | null {
  const data = new Uint8Array(buffer);
  const view = new DataView(buffer);
  const header = parseTexHeader(data);
  const { magic, version, texiPos, texiMagic } = header;

  // 检查魔数 "TEXV"
  if (magic !== 'TEXV') {
    console.error('不是有效的TEX文件，魔数:', magic);
    return null;
  }

  // 读取版本 (如 "0005")
  console.log('TEX版本:', version);
  
  if (texiMagic === 'TEXI') {
    // 这是 TEXI/TEXB 格式，跳转到专门的处理逻辑
    const result = parseTexiTexb(data, view, version, texiPos, options);
    if (result) {
      // 后处理：尝试解析 TEXS 动画帧数据以获取 spritesheet 元信息
      enrichWithTexsSpritesheet(data, view, texiPos, result);
    }
    return result;
  }
  
  // 不是 TEXI/TEXB 格式，尝试查找嵌入的 JPEG/PNG 数据
  
  // 查找 JPEG 魔数 (FF D8 FF)
  let jpegStart = -1;
  for (let i = 0; i < data.length - 2; i++) {
    if (data[i] === 0xFF && data[i + 1] === 0xD8 && data[i + 2] === 0xFF) {
      jpegStart = i;
      break;
    }
  }
  
  if (jpegStart >= 0) {
    console.log('找到JPEG数据，偏移:', jpegStart);
    let imageData = data.slice(jpegStart);
    
    // 查找 JPEG 结束标记 (FFD9) 并截断之后的数据
    for (let i = imageData.length - 2; i >= 0; i--) {
      if (imageData[i] === 0xFF && imageData[i + 1] === 0xD9) {
        if (i + 2 < imageData.length) {
          console.log('截断JPEG尾部数据:', imageData.length - i - 2, '字节');
          imageData = imageData.slice(0, i + 2);
        }
        break;
      }
    }
    
    // 尝试从 JPEG 头部读取尺寸
    const { width, height } = parseJpegDimensions(imageData) || { width: 0, height: 0 };
    
    return {
      version,
      width,
      height,
      format: 'jpeg',
      imageData,
    };
  }
  
  // 查找 PNG 魔数 (89 50 4E 47)
  let pngStart = -1;
  for (let i = 0; i < data.length - 3; i++) {
    if (data[i] === 0x89 && data[i + 1] === 0x50 && data[i + 2] === 0x4E && data[i + 3] === 0x47) {
      pngStart = i;
      break;
    }
  }
  
  if (pngStart >= 0) {
    console.log('找到PNG数据，偏移:', pngStart);
    const imageData = data.slice(pngStart);
    
    return {
      version,
      width: 0, // PNG 尺寸解析稍后实现
      height: 0,
      format: 'png',
      imageData,
    };
  }
  
  // 查找 MP4/ISOBMFF 魔数 (bytes 4-7 = "ftyp": 66 74 79 70)
  for (let i = 0; i < data.length - 8; i++) {
    if (data[i + 4] === 0x66 && data[i + 5] === 0x74 && data[i + 6] === 0x79 && data[i + 7] === 0x70) {
      console.log('找到MP4数据，偏移:', i);
      const imageData = data.slice(i);
      return {
        version,
        width: 0,
        height: 0,
        format: 'mp4',
        imageData,
      };
    }
  }
  
  console.error('TEX 文件格式未知或不支持');
  return null;
}

/**
 * 解析 TEXI/TEXB 格式纹理
 * 基于 repkg 项目的格式分析: https://github.com/notscuffed/repkg
 */
function parseTexiTexb(
  data: Uint8Array,
  view: DataView,
  version: string,
  texiPos: number,
  options: TexDecodeOptions
): TexInfo | null {
  // TEXI header: TEXI0001\0 + 7个int32 (format, flags, texW, texH, imgW, imgH, unk)
  const headerStart = texiPos + 9; // 跳过 TEXI0001\0
  const texFormat = view.getInt32(headerStart, true);
  const texFlags = view.getInt32(headerStart + 4, true);
  const textureWidth = view.getInt32(headerStart + 8, true);
  const textureHeight = view.getInt32(headerStart + 12, true);
  const imageWidth = view.getInt32(headerStart + 16, true);
  const imageHeight = view.getInt32(headerStart + 20, true);
  // unk @ headerStart + 24
  
  console.log(`TEXI: format=${texFormat}, flags=${texFlags}, texSize=${textureWidth}x${textureHeight}, imgSize=${imageWidth}x${imageHeight}`);
  
  // TEXB 在 headerStart + 28 位置
  const texbPos = headerStart + 28;
  const texbMagic = String.fromCharCode(data[texbPos], data[texbPos + 1], data[texbPos + 2], data[texbPos + 3]);
  
  if (texbMagic !== 'TEXB') {
    console.error('未找到 TEXB section at position', texbPos);
    return null;
  }
  
  // TEXB version: 0001/0002/0003/0004
  const texbVersion = String.fromCharCode(data[texbPos + 4], data[texbPos + 5], data[texbPos + 6], data[texbPos + 7]);
  console.log('TEXB version:', texbVersion);
  
  // TEXB header (跳过 TEXBxxxx\0)
  let pos = texbPos + 9;
  
  const imageCount = view.getInt32(pos, true);
  pos += 4;
  
  // V3/V4 有额外字段
  if (texbVersion === '0003' || texbVersion === '0004') {
    const imageFormat = view.getInt32(pos, true);
    pos += 4;
    
    if (texbVersion === '0004') {
      const isVideo = view.getInt32(pos, true);
      pos += 4;
    }
  }
  
  const mipmapCount = view.getInt32(pos, true);
  pos += 4;
  
  if (mipmapCount === 0 || mipmapCount > 16) {
    console.error('无效的 mipmap count:', mipmapCount);
    return null;
  }
  
  // ★ 读取所有 mipmap 头部信息，选择合适的层级
  const maxSize = options.maxSize || 0; // 0 = 不限制
  interface MipInfo { width: number; height: number; isLZ4: boolean; decompressedSize: number; compressedSize: number; dataOffset: number; }
  const mips: MipInfo[] = [];
  let scanPos = pos;
  // TEXB v0001 使用 12 字节 mipmap 头部 (width + height + compressedSize)，
  // v0002+ 使用 20 字节 (width + height + compression + decompressedSize + compressedSize)。
  // 仅 TEXB v0001 使用 12 字节 mipmap 头部；v0002/v0003/v0004 均使用 20 字节
  const isV1 = (texbVersion === '0001');
  const mipHeaderSize = isV1 ? 12 : 20;
  for (let i = 0; i < mipmapCount; i++) {
    // 边界检查
    if (scanPos + mipHeaderSize > data.length) {
      console.warn(`TEXB: mipmap ${i}/${mipmapCount} 头部读取越界, scanPos=${scanPos}, dataLen=${data.length}`);
      break;
    }
    
    const mw = view.getInt32(scanPos, true);
    const mh = view.getInt32(scanPos + 4, true);
    let lz4 = false;
    let decompSz: number;
    let compSz: number;
    
    if (isV1) {
      // TEXB v0001/v0002: width(4) + height(4) + compressedSize(4) = 12 bytes
      // 无独立的压缩标志和解压大小字段
      compSz = view.getInt32(scanPos + 8, true);
      decompSz = compSz; // v0001 不区分压缩/解压大小
      lz4 = false;
      scanPos += 12;
    } else {
      // TEXB v0003/v0004: width(4) + height(4) + lz4(4) + decompSz(4) + compSz(4) = 20 bytes
      lz4 = view.getInt32(scanPos + 8, true) === 1;
      decompSz = view.getInt32(scanPos + 12, true);
      compSz = view.getInt32(scanPos + 16, true);
      scanPos += 20;
    }
    
    // 某些纹理 compressedSize/decompressedSize = -1，
    // 这表示数据未压缩，大小需要从纹理格式推算
    if (compSz < 0 || decompSz < 0) {
      // 根据 texFormat 推算每像素字节数
      let bpp = 4; // 默认 RGBA
      if (texFormat === 4) bpp = 1; // DXT5 compressed (block-based, ~1 byte/pixel avg)
      else if (texFormat === 7 || texFormat === 3 || texFormat === 12) bpp = 0.5; // DXT1
      else if (texFormat === 8) bpp = 2; // RG88
      else if (texFormat === 9) bpp = 1; // R8
      
      const inferredSize = Math.ceil(mw * mh * bpp);
      if (decompSz < 0) decompSz = inferredSize;
      if (compSz < 0) compSz = inferredSize;
      
      // 确保不超出文件边界
      if (scanPos + compSz > data.length) {
        compSz = Math.max(0, data.length - scanPos);
      }
    }
    
    mips.push({ width: mw, height: mh, isLZ4: lz4, decompressedSize: decompSz, compressedSize: compSz, dataOffset: scanPos });
    if (compSz > 0) {
      scanPos += compSz; // 跳过该 mipmap 的数据
    }
  }
  
  // 选择最佳 mipmap：找到最小的且仍 >= maxSize 的层级
  let chosenIdx = 0;
  if (maxSize > 0 && mips.length > 1) {
    for (let i = 1; i < mips.length; i++) {
      const m = mips[i];
      if (m.width >= maxSize || m.height >= maxSize) {
        chosenIdx = i; // 这个 mip 仍然够大，可以用
      } else {
        break; // 更小的 mip 不够大了，用上一个
      }
    }
  }
  
  const chosen = mips[chosenIdx];
  const mipWidth = chosen.width;
  const mipHeight = chosen.height;
  const isLZ4 = chosen.isLZ4;
  const decompressedSize = chosen.decompressedSize;
  const compressedSize = chosen.compressedSize;
  pos = chosen.dataOffset;
  
  if (chosenIdx > 0) {
    console.log(`Mipmap: 选择 level ${chosenIdx}/${mipmapCount-1}: ${mipWidth}x${mipHeight} (跳过 ${mips[0].width}x${mips[0].height}), LZ4=${isLZ4}`);
  } else {
    console.log(`Mipmap: ${mipWidth}x${mipHeight}, LZ4=${isLZ4}, decompressed=${decompressedSize}, compressed=${compressedSize}`);
  }
  
  // ★ 保留原始图片逻辑尺寸（用于图层定位/尺寸计算）
  // 当选择了较小的 mipmap 时，像素数据是缩小的，但 texInfo.width/height
  // 应返回原始 TEXI header 中的图片尺寸，确保图层在场景中正确布局
  const origWidth = imageWidth > 0 ? imageWidth : textureWidth;
  const origHeight = imageHeight > 0 ? imageHeight : textureHeight;
  
  // 提取压缩数据
  const compressedData = data.slice(pos, pos + compressedSize);
  
  // 解压
  let pixelData: Uint8Array;
  if (isLZ4) {
    console.log('正在 LZ4 解压...');
    pixelData = lz4Decompress(compressedData, decompressedSize);
    console.log('解压完成, 大小:', pixelData.length);
  } else {
    pixelData = compressedData;
  }
  
  const decodeContext: BranchTexDecodeContext = {
    texFormat,
    pixelData,
    mipWidth,
    mipHeight,
    imageWidth,
    imageHeight,
    maxSize,
    options,
  };
  const primaryDecoded = decodeDxt5Path(decodeContext)
    ?? decodeDxt1Path(decodeContext)
    ?? decodeRgbaPath(decodeContext)
    ?? decodeRgPath(decodeContext)
    ?? decodeRPath(decodeContext);
  if (primaryDecoded) {
    return {
      version,
      width: origWidth,
      height: origHeight,
      format: 'raw',
      imageData: primaryDecoded.imageData,
      channels: primaryDecoded.channels,
    };
  }
  const expectedRGBA = mipWidth * mipHeight * 4;
  const expectedRG = mipWidth * mipHeight * 2;
  const expectedR = mipWidth * mipHeight;
  const expectedDXT5 = getBlockCompressedExpectedSize(mipWidth, mipHeight, 16);
  const expectedDXT1 = getBlockCompressedExpectedSize(mipWidth, mipHeight, 8);
  
  // ===== 新增纹理格式支持 (参考 linux-wallpaperengine Texture.h) =====
  // texFormat: 2=DXT3/BC2, 5=RGB888, 6=RGB565, 10=RG1616f, 11=R16f
  //            13=BC7, 14=RGBa1010102, 15=RGBA16161616f, 16=RGB161616f

  // DXT3/BC2 格式
  const expectedDXT3 = getBlockCompressedExpectedSize(mipWidth, mipHeight, 16);
  if (texFormat === 2 && pixelData.length === expectedDXT3) {
    console.log(`检测到 DXT3/BC2 格式 (texFormat=2): ${mipWidth}x${mipHeight}`);
    // DXT3 类似 DXT5 但 alpha 是直接存储的 4-bit 值而非插值
    // 复用 DXT5 解码器 (alpha 精度略有损失但视觉差异极小)
    const rgbaData = decodeDXT5(pixelData, mipWidth, mipHeight);
    const pixFinalW = (imageWidth > 0 && imageWidth <= mipWidth) ? imageWidth : mipWidth;
    const pixFinalH = (imageHeight > 0 && imageHeight <= mipHeight) ? imageHeight : mipHeight;
    const pngData = createPNG(rgbaData, pixFinalW, pixFinalH);
    return {
      version,
      width: origWidth,
      height: origHeight,
      format: 'raw',
      imageData: pngData,
      channels: 4,
    };
  }

  // RGB888 (3 通道, 无 alpha)
  const expectedRGB = mipWidth * mipHeight * 3;
  if (texFormat === 5 && pixelData.length === expectedRGB) {
    console.log(`检测到 RGB888 格式 (texFormat=5): ${mipWidth}x${mipHeight}`);
    const rgbaData = new Uint8Array(mipWidth * mipHeight * 4);
    for (let i = 0, j = 0; i < pixelData.length; i += 3, j += 4) {
      rgbaData[j] = pixelData[i];
      rgbaData[j + 1] = pixelData[i + 1];
      rgbaData[j + 2] = pixelData[i + 2];
      rgbaData[j + 3] = 255;
    }
    const pixFinalW = (imageWidth > 0 && imageWidth <= mipWidth) ? imageWidth : mipWidth;
    const pixFinalH = (imageHeight > 0 && imageHeight <= mipHeight) ? imageHeight : mipHeight;
    const pngData = createPNG(rgbaData, pixFinalW, pixFinalH);
    return {
      version,
      width: origWidth,
      height: origHeight,
      format: 'raw',
      imageData: pngData,
      channels: 3,
    };
  }

  // RGB565 (2 字节/像素, 16-bit color)
  const expectedRGB565 = mipWidth * mipHeight * 2;
  if (texFormat === 6 && pixelData.length === expectedRGB565) {
    console.log(`检测到 RGB565 格式 (texFormat=6): ${mipWidth}x${mipHeight}`);
    const rgbaData = new Uint8Array(mipWidth * mipHeight * 4);
    for (let i = 0, j = 0; i < pixelData.length; i += 2, j += 4) {
      const val = pixelData[i] | (pixelData[i + 1] << 8);
      rgbaData[j] = ((val >> 11) & 0x1F) * 255 / 31;
      rgbaData[j + 1] = ((val >> 5) & 0x3F) * 255 / 63;
      rgbaData[j + 2] = (val & 0x1F) * 255 / 31;
      rgbaData[j + 3] = 255;
    }
    const pixFinalW = (imageWidth > 0 && imageWidth <= mipWidth) ? imageWidth : mipWidth;
    const pixFinalH = (imageHeight > 0 && imageHeight <= mipHeight) ? imageHeight : mipHeight;
    const pngData = createPNG(rgbaData, pixFinalW, pixFinalH);
    return {
      version,
      width: origWidth,
      height: origHeight,
      format: 'raw',
      imageData: pngData,
      channels: 3,
    };
  }

  // RG1616f (4 字节/像素, 2x16-bit float)
  const expectedRG16f = mipWidth * mipHeight * 4;
  if (texFormat === 10 && pixelData.length === expectedRG16f) {
    console.log(`检测到 RG1616f 格式 (texFormat=10): ${mipWidth}x${mipHeight}`);
    const view = new DataView(pixelData.buffer, pixelData.byteOffset);
    const rgbaData = new Uint8Array(mipWidth * mipHeight * 4);
    for (let i = 0, j = 0; i < pixelData.length; i += 4, j += 4) {
      // 读取 16-bit float 并转换为 8-bit
      const r = float16ToFloat32(view.getUint16(i, true));
      const g = float16ToFloat32(view.getUint16(i + 2, true));
      rgbaData[j] = Math.min(255, Math.max(0, Math.round(r * 255)));
      rgbaData[j + 1] = Math.min(255, Math.max(0, Math.round(g * 255)));
      rgbaData[j + 2] = 0;
      rgbaData[j + 3] = 255;
    }
    const pixFinalW = (imageWidth > 0 && imageWidth <= mipWidth) ? imageWidth : mipWidth;
    const pixFinalH = (imageHeight > 0 && imageHeight <= mipHeight) ? imageHeight : mipHeight;
    const pngData = createPNG(rgbaData, pixFinalW, pixFinalH);
    return {
      version,
      width: origWidth,
      height: origHeight,
      format: 'raw',
      imageData: pngData,
      channels: 2,
    };
  }

  // R16f (2 字节/像素, 16-bit float 单通道)
  const expectedR16f = mipWidth * mipHeight * 2;
  if (texFormat === 11 && pixelData.length === expectedR16f) {
    console.log(`检测到 R16f 格式 (texFormat=11): ${mipWidth}x${mipHeight}`);
    const view = new DataView(pixelData.buffer, pixelData.byteOffset);
    const rgbaData = new Uint8Array(mipWidth * mipHeight * 4);
    for (let i = 0, j = 0; i < pixelData.length; i += 2, j += 4) {
      const v = float16ToFloat32(view.getUint16(i, true));
      const byte = Math.min(255, Math.max(0, Math.round(v * 255)));
      rgbaData[j] = byte;
      rgbaData[j + 1] = byte;
      rgbaData[j + 2] = byte;
      rgbaData[j + 3] = 255;
    }
    const pixFinalW = (imageWidth > 0 && imageWidth <= mipWidth) ? imageWidth : mipWidth;
    const pixFinalH = (imageHeight > 0 && imageHeight <= mipHeight) ? imageHeight : mipHeight;
    const pngData = createPNG(rgbaData, pixFinalW, pixFinalH);
    return {
      version,
      width: origWidth,
      height: origHeight,
      format: 'raw',
      imageData: pngData,
      channels: 1,
    };
  }

  // RGBA16161616f (8 字节/像素, HDR)
  const expectedRGBA16f = mipWidth * mipHeight * 8;
  if (texFormat === 15 && pixelData.length === expectedRGBA16f) {
    console.log(`检测到 RGBA16161616f 格式 (texFormat=15): ${mipWidth}x${mipHeight}`);
    const view = new DataView(pixelData.buffer, pixelData.byteOffset);
    const rgbaData = new Uint8Array(mipWidth * mipHeight * 4);
    for (let i = 0, j = 0; i < pixelData.length; i += 8, j += 4) {
      rgbaData[j] = Math.min(255, Math.max(0, Math.round(float16ToFloat32(view.getUint16(i, true)) * 255)));
      rgbaData[j + 1] = Math.min(255, Math.max(0, Math.round(float16ToFloat32(view.getUint16(i + 2, true)) * 255)));
      rgbaData[j + 2] = Math.min(255, Math.max(0, Math.round(float16ToFloat32(view.getUint16(i + 4, true)) * 255)));
      rgbaData[j + 3] = Math.min(255, Math.max(0, Math.round(float16ToFloat32(view.getUint16(i + 6, true)) * 255)));
    }
    const pixFinalW = (imageWidth > 0 && imageWidth <= mipWidth) ? imageWidth : mipWidth;
    const pixFinalH = (imageHeight > 0 && imageHeight <= mipHeight) ? imageHeight : mipHeight;
    const pngData = createPNG(rgbaData, pixFinalW, pixFinalH);
    return {
      version,
      width: origWidth,
      height: origHeight,
      format: 'raw',
      imageData: pngData,
      channels: 4,
    };
  }

  // 检查是否为内嵌的 JPEG 数据（TEXB V3/V4 可能直接存储 JPEG）
  if (pixelData.length > 2 && pixelData[0] === 0xFF && pixelData[1] === 0xD8 && pixelData[2] === 0xFF) {
    console.log(`检测到内嵌 JPEG 数据, 大小: ${pixelData.length}`);
    return {
      version,
      width: origWidth,
      height: origHeight,
      format: 'jpeg',
      imageData: pixelData,
    };
  }
  
  // 检查是否为内嵌的 PNG 数据
  if (pixelData.length > 3 && pixelData[0] === 0x89 && pixelData[1] === 0x50 && pixelData[2] === 0x4E && pixelData[3] === 0x47) {
    console.log(`检测到内嵌 PNG 数据, 大小: ${pixelData.length}`);
    return {
      version,
      width: origWidth,
      height: origHeight,
      format: 'png',
      imageData: pixelData,
    };
  }
  
  // 检查是否为内嵌的 MP4/视频数据（ISOBMFF 容器：bytes 4-7 = "ftyp"）
  if (pixelData.length > 8 && pixelData[4] === 0x66 && pixelData[5] === 0x74 && pixelData[6] === 0x79 && pixelData[7] === 0x70) {
    console.log(`检测到内嵌 MP4 视频数据, 大小: ${pixelData.length}`);
    return {
      version,
      width: origWidth,
      height: origHeight,
      format: 'mp4',
      imageData: pixelData,
    };
  }

  // 最后尝试：如果 texFormat=4 但大小不精确匹配，仍然尝试 DXT5 解码
  if (texFormat === 4) {
    console.warn(`texFormat=4 (DXT5) 但数据大小 ${pixelData.length} 不匹配预期 ${expectedDXT5}，尝试强制解码...`);
    try {
      const needsDownsample = maxSize > 0 && (mipWidth > maxSize || mipHeight > maxSize);
      let rgbaData: Uint8Array;
      let pixFinalW: number, pixFinalH: number;
      
      if (needsDownsample) {
        const blocksX = Math.ceil(mipWidth / 4);
        const blocksY = Math.ceil(mipHeight / 4);
        let step = 1;
        while (Math.ceil(blocksX / step) > maxSize || Math.ceil(blocksY / step) > maxSize) step++;
        const ds = decodeDXT5Downsampled(pixelData, mipWidth, mipHeight, step);
        rgbaData = ds.data; pixFinalW = ds.width; pixFinalH = ds.height;
      } else {
        rgbaData = decodeDXT5(pixelData, mipWidth, mipHeight);
        pixFinalW = (imageWidth > 0 && imageWidth <= mipWidth) ? imageWidth : mipWidth;
        pixFinalH = (imageHeight > 0 && imageHeight <= mipHeight) ? imageHeight : mipHeight;
        if (pixFinalW !== mipWidth || pixFinalH !== mipHeight) {
          rgbaData = cropRGBA(rgbaData, mipWidth, mipHeight, pixFinalW, pixFinalH);
        }
      }
      const pngData = createPNG(rgbaData, pixFinalW, pixFinalH);
      return {
        version,
        width: origWidth,
        height: origHeight,
        format: 'raw',
        imageData: pngData,
        channels: 4,
      };
    } catch (e) {
      console.error('DXT5 强制解码失败:', e);
    }
  }
  
  // 其他格式暂不支持
  // ★ 详细诊断：帮助识别未支持的纹理格式（如法线贴图可能使用 BC5/ATI2）
  const expectedBC5 = Math.ceil(mipWidth / 4) * Math.ceil(mipHeight / 4) * 16; // BC5 = 2 channels × 8 bytes/block
  console.error(
    `不支持的像素格式! texFormat=${texFormat}, flags=${texFlags}, ` +
    `size=${mipWidth}x${mipHeight}, dataLen=${pixelData.length}, ` +
    `expected: RGBA=${expectedRGBA}, RG=${expectedRG}, R=${expectedR}, ` +
    `DXT5=${expectedDXT5}, DXT1=${expectedDXT1}, BC5=${expectedBC5}`
  );
  console.error('数据头部:', Array.from(pixelData.slice(0, 32)).map(b => b.toString(16).padStart(2, '0')).join(' '));
  return null;
}

// ==================== DXT/BC 块压缩解码 ====================

/**
 * 解码 DXT5/BC3 块压缩纹理为 RGBA 数据
 * 
 * DXT5 每个 4x4 像素块占 16 字节:
 * - 前 8 字节: alpha 数据 (2 个参考值 + 48 位查找表)
 * - 后 8 字节: 颜色数据 (2 个 RGB565 颜色 + 32 位查找表)
 */
function decodeDXT5(data: Uint8Array, width: number, height: number): Uint8Array {
  return decodeDXT5Impl(data, width, height);
}

/**
 * 快速降采样解码 DXT5/BC3：每个 4x4 块只提取 1 个代表像素
 * 输出分辨率为原始的 1/4（每个维度），避免分配全尺寸 RGBA 缓冲区
 * 
 * @param step 每 step 个块取一个代表（step=1 → 1/4分辨率，step=2 → 1/8分辨率）
 * @returns { data: Uint8Array, width: number, height: number }
 */
function decodeDXT5Downsampled(
  data: Uint8Array, width: number, height: number, step: number = 1
): { data: Uint8Array; width: number; height: number } {
  return decodeDXT5DownsampledImpl(data, width, height, step);
}

/**
 * 快速降采样解码 DXT1/BC1：每个 4x4 块只提取 1 个代表像素
 * @param step 每 step 个块取一个代表
 */
function decodeDXT1Downsampled(
  data: Uint8Array, width: number, height: number, step: number = 1
): { data: Uint8Array; width: number; height: number } {
  return decodeDXT1DownsampledImpl(data, width, height, step);
}

/**
 * 解码 DXT1/BC1 块压缩纹理为 RGBA 数据
 * 
 * DXT1 每个 4x4 像素块占 8 字节:
 * - 2 个 RGB565 颜色 (4 bytes)
 * - 32 位查找表 (4 bytes, 每像素 2 bit)
 */
function decodeDXT1(data: Uint8Array, width: number, height: number): Uint8Array {
  return decodeDXT1Impl(data, width, height);
}

/**
 * 裁剪 RGBA 数据到指定尺寸
 * 从左上角开始裁剪（GPU纹理通常在左上角存储实际图片）
 */
function cropRGBA(data: Uint8Array, srcWidth: number, _srcHeight: number, dstWidth: number, dstHeight: number): Uint8Array {
  return cropRGBAImpl(data, srcWidth, _srcHeight, dstWidth, dstHeight);
}

/**
 * 将 16-bit 半精度浮点转换为 32-bit 浮点
 * IEEE 754 half-precision: 1-bit sign, 5-bit exponent, 10-bit mantissa
 */
function float16ToFloat32(h: number): number {
  return float16ToFloat32Impl(h);
}

/**
 * 将 RG 数据转换为 RGBA
 */
function convertRGtoRGBA(
  rgData: Uint8Array,
  width: number,
  height: number,
  alphaFromRed = false,
  alphaFromGreen = false
): Uint8Array {
  return convertRGtoRGBAImpl(rgData, width, height, alphaFromRed, alphaFromGreen);
}

/**
 * 将单通道 (R/灰度) 数据转换为 RGBA
 * 用于 format=9 的 mask 纹理
 */
function convertRtoRGBA(rData: Uint8Array, width: number, height: number, alphaFromRed = false): Uint8Array {
  return convertRtoRGBAImpl(rData, width, height, alphaFromRed);
}

/**
 * 纯内存级 RGBA 降采样（区域平均法）
 * 替代 canvas DOM 操作，避免 DOM 开销和 premultiply alpha 问题
 */
function downsampleRGBA(
  src: Uint8Array, srcW: number, srcH: number, dstW: number, dstH: number
): Uint8Array {
  return downsampleRGBAImpl(src, srcW, srcH, dstW, dstH);
}

/**
 * 创建简单的 PNG 文件
 * 使用 canvas 来生成
 */
function createPNG(rgbaData: Uint8Array, width: number, height: number): Uint8Array {
  return createPNGImpl(rgbaData, width, height);
}

/**
 * 从 JPEG 数据中解析尺寸
 */
function parseJpegDimensions(data: Uint8Array): { width: number; height: number } | null {
  return parseJpegDimensionsImpl(data);
}

/**
 * 纹理最大尺寸限制（单边像素数）
 * 超过此尺寸的纹理会在 canvas 绘制时降采样，加速加载并减少内存占用
 * 与 TexUrlConverter 保持一致
 */
const MAX_TEXTURE_SIZE = 16384;

/**
 * 将 TEX 图像数据转换为 Blob URL（异步版本）
 * 对于大纹理使用 canvas.toBlob() 来避免 data URL 大小限制
 * 超过 MAX_TEXTURE_SIZE 的纹理会自动降采样
 */
export async function texToUrl(texInfo: TexInfo, options: TexUrlOptions = {}): Promise<string> {
  return texToUrlImpl(texInfo, options);
}

/**
 * 为 RGB PNG（无 alpha 通道）添加 alpha
 * 使用 alpha = max(R, G, B)：亮像素 → 不透明，暗像素 → 透明
 * 适用于粒子纹理（发光、雨滴等）和法线贴图（alpha 未被采样）
 */
async function pngAddAlphaFromBrightness(pngData: Uint8Array): Promise<string> {
  return pngAddAlphaFromBrightnessImpl(pngData);
}

/**
 * 直接从 ArrayBuffer 解析 TEX 并返回 Blob URL（异步版本）
 */
export async function parseTexToUrl(
  buffer: ArrayBuffer,
  options: TexDecodeOptions & TexUrlOptions = {},
): Promise<string | null> {
  const { alphaMode, ...decodeOptions } = options;
  const texInfo = parseTex(buffer, decodeOptions);
  if (!texInfo) {
    return null;
  }
  return texToUrl(texInfo, { alphaMode });
}

/**
 * 解析 TEXS 动画帧数据，计算 spritesheet 网格信息并写入 TexInfo
 * 
 * TEX 文件结构: TEXV → TEXI → TEXB (mipmaps) → [TEXS (animation frames)]
 * TEXS 存在时，texFlags & 1 为 true，纹理是一个 spritesheet（网格排列的多帧动画）
 * 
 * 参考: linux-wallpaperengine TextureParser::parseAnimations
 */
function enrichWithTexsSpritesheet(
  data: Uint8Array,
  view: DataView,
  texiPos: number,
  info: TexInfo
): void {
  const headerStart = texiPos + 9;
  const textureWidth = view.getInt32(headerStart + 8, true);
  const textureHeight = view.getInt32(headerStart + 12, true);
  // ★ 使用实际图像尺寸（而非填充后的 POT 纹理尺寸）计算 spritesheet 网格
  // 因为 texToUrl 输出的纹理是裁剪到 imageWidth×imageHeight 的，
  // UV 空间 0-1 对应实际图像尺寸，不是填充后的纹理尺寸
  const imageWidth = view.getInt32(headerStart + 16, true);
  const imageHeight = view.getInt32(headerStart + 20, true);
  
  // 搜索 TEXS 标记（位于 TEXB mipmaps 数据之后）
  // 不再依赖 texFlags & 1 标志，因为很多 spritesheet 纹理没有设置该标志
  // 改为直接搜索 "TEXS" + 版本号模式，加上版本验证来防止误匹配
  const searchStart = headerStart + 28; // TEXB 开始位置附近
  let texsPos = -1;
  for (let i = searchStart; i < data.length - 13; i++) {
    if (data[i] === 0x54 && data[i + 1] === 0x45 && 
        data[i + 2] === 0x58 && data[i + 3] === 0x53) { // "TEXS"
      // 额外验证：TEXS 后面应该跟着 "0002" 或 "0003" 版本号
      const v = String.fromCharCode(data[i + 4], data[i + 5], data[i + 6], data[i + 7]);
      if (v === '0002' || v === '0003') {
        texsPos = i;
        break;
      }
    }
  }
  if (texsPos < 0) return;
  
  // 读取 TEXS 版本
  const texsVersion = String.fromCharCode(
    data[texsPos + 4], data[texsPos + 5], data[texsPos + 6], data[texsPos + 7]
  );
  let fpos = texsPos + 9; // skip TEXS000X\0
  
  if (fpos + 4 > data.length) return;
  const frameCount = view.getInt32(fpos, true);
  fpos += 4;
  
  // TEXS0003 有额外的 gifWidth/gifHeight 字段
  if (texsVersion === '0003') {
    fpos += 8; // skip gifWidth(u32) + gifHeight(u32)
  }
  
  // 解析帧数据
  // 每帧: frameNumber(u32) + frametime(f32) + x(f32) + y(f32) + width1(f32) + width2(f32) + height2(f32) + height1(f32)
  // = 8 * 4 = 32 字节
  let firstFrameW = 0, firstFrameH = 0;
  let totalDuration = 0;
  let firstFrameTime = 0;
  for (let f = 0; f < frameCount && fpos + 32 <= data.length; f++) {
    const frametime = view.getFloat32(fpos + 4, true);
    if (f === 0) {
      firstFrameTime = frametime;
      firstFrameW = view.getFloat32(fpos + 16, true); // width1 (帧宽度)
      firstFrameH = view.getFloat32(fpos + 28, true); // height1 (帧高度)
    }
    totalDuration += frametime;
    fpos += 32;
  }
  
  // 从帧尺寸和实际图像尺寸计算 spritesheet 网格
  // 优先使用 imageWidth/imageHeight（实际图像内容尺寸），
  // 而非 textureWidth/textureHeight（GPU 填充的 POT 纹理尺寸）
  // 这样 UV 计算与 texToUrl 输出的纹理尺寸一致
  const texW = (imageWidth > 0 ? imageWidth : textureWidth) || info.width;
  const texH = (imageHeight > 0 ? imageHeight : textureHeight) || info.height;
  if (firstFrameW > 0 && firstFrameH > 0 && texW > 0 && texH > 0) {
    const cols = Math.round(texW / firstFrameW);
    const rows = Math.round(texH / firstFrameH);
    // 仅当网格能容纳所有帧时才视为 spritesheet
    // 防止 GIF（frameWidth == textureWidth）被误判为 1×1 spritesheet
    if (cols > 0 && rows > 0 && cols * rows >= frameCount && (cols > 1 || rows > 1)) {
      info.spritesheetCols = cols;
      info.spritesheetRows = rows;
      info.spritesheetFrames = frameCount;
      info.spritesheetDuration = totalDuration;
      info.spritesheetFrameWidth = firstFrameW;
      info.spritesheetFrameHeight = firstFrameH;
      console.log(`TEXS: ${texsVersion}, ${frameCount} frames, grid=${cols}x${rows}, frameSize=${firstFrameW}x${firstFrameH}, firstFrameTime=${firstFrameTime.toFixed(4)}s, duration=${totalDuration.toFixed(2)}s`);
    }
  }
}
