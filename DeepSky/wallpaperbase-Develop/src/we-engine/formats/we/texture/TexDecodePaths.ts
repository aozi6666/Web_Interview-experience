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
} from './TexImageProcessor';

export interface TexDecodeContext {
  texFormat: number;
  pixelData: Uint8Array;
  mipWidth: number;
  mipHeight: number;
  imageWidth: number;
  imageHeight: number;
  maxSize: number;
  options: {
    alphaFromRed?: boolean;
    alphaFromGreen?: boolean;
  };
}

export interface DecodedRawImage {
  imageData: Uint8Array;
  channels: number;
}

function decodeDXT5(data: Uint8Array, width: number, height: number): Uint8Array {
  return decodeDXT5Impl(data, width, height);
}

function decodeDXT5Downsampled(
  data: Uint8Array, width: number, height: number, step: number = 1
): { data: Uint8Array; width: number; height: number } {
  return decodeDXT5DownsampledImpl(data, width, height, step);
}

function decodeDXT1Downsampled(
  data: Uint8Array, width: number, height: number, step: number = 1
): { data: Uint8Array; width: number; height: number } {
  return decodeDXT1DownsampledImpl(data, width, height, step);
}

function decodeDXT1(data: Uint8Array, width: number, height: number): Uint8Array {
  return decodeDXT1Impl(data, width, height);
}

function cropRGBA(data: Uint8Array, srcWidth: number, srcHeight: number, dstWidth: number, dstHeight: number): Uint8Array {
  return cropRGBAImpl(data, srcWidth, srcHeight, dstWidth, dstHeight);
}

function convertRGtoRGBA(
  rgData: Uint8Array,
  width: number,
  height: number,
  alphaFromRed = false,
  alphaFromGreen = false
): Uint8Array {
  return convertRGtoRGBAImpl(rgData, width, height, alphaFromRed, alphaFromGreen);
}

function convertRtoRGBA(rData: Uint8Array, width: number, height: number, alphaFromRed = false): Uint8Array {
  return convertRtoRGBAImpl(rData, width, height, alphaFromRed);
}

function downsampleRGBA(
  src: Uint8Array, srcW: number, srcH: number, dstW: number, dstH: number
): Uint8Array {
  return downsampleRGBAImpl(src, srcW, srcH, dstW, dstH);
}

function createPNG(rgbaData: Uint8Array, width: number, height: number): Uint8Array {
  return createPNGImpl(rgbaData, width, height);
}

export function decodeDxt5Path(ctx: TexDecodeContext): DecodedRawImage | null {
  const expectedDXT5 = getBlockCompressedExpectedSize(ctx.mipWidth, ctx.mipHeight, 16);
  if (!(ctx.texFormat === 4 && ctx.pixelData.length === expectedDXT5)) {
    return null;
  }
  console.log(`检测到 DXT5/BC3 格式 (texFormat=4): ${ctx.mipWidth}x${ctx.mipHeight}, 数据大小: ${ctx.pixelData.length}`);
  const needsDownsample = ctx.maxSize > 0 && (ctx.mipWidth > ctx.maxSize || ctx.mipHeight > ctx.maxSize);
  let pixFinalW: number;
  let pixFinalH: number;
  let rgbaData: Uint8Array;
  if (needsDownsample) {
    const blocksX = Math.ceil(ctx.mipWidth / 4);
    const blocksY = Math.ceil(ctx.mipHeight / 4);
    let step = 1;
    while (Math.ceil(blocksX / step) > ctx.maxSize || Math.ceil(blocksY / step) > ctx.maxSize) step++;
    console.log(`DXT5 快速降采样: ${ctx.mipWidth}x${ctx.mipHeight} → ${Math.ceil(blocksX / step)}x${Math.ceil(blocksY / step)} (step=${step}, 内存: ${Math.ceil(ctx.mipWidth * ctx.mipHeight * 4 / 1e6)}MB → ${Math.ceil(Math.ceil(blocksX / step) * Math.ceil(blocksY / step) * 4 / 1e6)}MB)`);
    const ds = decodeDXT5Downsampled(ctx.pixelData, ctx.mipWidth, ctx.mipHeight, step);
    rgbaData = ds.data;
    pixFinalW = ds.width;
    pixFinalH = ds.height;
  } else {
    rgbaData = decodeDXT5(ctx.pixelData, ctx.mipWidth, ctx.mipHeight);
    pixFinalW = (ctx.imageWidth > 0 && ctx.imageWidth <= ctx.mipWidth) ? ctx.imageWidth : ctx.mipWidth;
    pixFinalH = (ctx.imageHeight > 0 && ctx.imageHeight <= ctx.mipHeight) ? ctx.imageHeight : ctx.mipHeight;
    if (pixFinalW !== ctx.mipWidth || pixFinalH !== ctx.mipHeight) {
      console.log(`裁剪纹理: ${ctx.mipWidth}x${ctx.mipHeight} -> ${pixFinalW}x${pixFinalH}`);
      rgbaData = cropRGBA(rgbaData, ctx.mipWidth, ctx.mipHeight, pixFinalW, pixFinalH);
    }
  }
  const pngData = createPNG(rgbaData, pixFinalW, pixFinalH);
  console.log(`createPNG 完成 (DXT5), 输出大小: ${pngData.length}`);
  return { imageData: pngData, channels: 4 };
}

export function decodeDxt1Path(ctx: TexDecodeContext): DecodedRawImage | null {
  const expectedDXT1 = getBlockCompressedExpectedSize(ctx.mipWidth, ctx.mipHeight, 8);
  if (!((ctx.texFormat === 3 || ctx.texFormat === 7 || ctx.texFormat === 12) && ctx.pixelData.length === expectedDXT1)) {
    return null;
  }
  console.log(`检测到 DXT1/BC1 格式 (texFormat=${ctx.texFormat}): ${ctx.mipWidth}x${ctx.mipHeight}, 数据大小: ${ctx.pixelData.length}`);
  const needsDownsample = ctx.maxSize > 0 && (ctx.mipWidth > ctx.maxSize || ctx.mipHeight > ctx.maxSize);
  let pixFinalW: number;
  let pixFinalH: number;
  let rgbaData: Uint8Array;
  if (needsDownsample) {
    const blocksX = Math.ceil(ctx.mipWidth / 4);
    const blocksY = Math.ceil(ctx.mipHeight / 4);
    let step = 1;
    while (Math.ceil(blocksX / step) > ctx.maxSize || Math.ceil(blocksY / step) > ctx.maxSize) step++;
    console.log(`DXT1 快速降采样: ${ctx.mipWidth}x${ctx.mipHeight} → ${Math.ceil(blocksX / step)}x${Math.ceil(blocksY / step)} (step=${step})`);
    const ds = decodeDXT1Downsampled(ctx.pixelData, ctx.mipWidth, ctx.mipHeight, step);
    rgbaData = ds.data;
    pixFinalW = ds.width;
    pixFinalH = ds.height;
  } else {
    rgbaData = decodeDXT1(ctx.pixelData, ctx.mipWidth, ctx.mipHeight);
    pixFinalW = (ctx.imageWidth > 0 && ctx.imageWidth <= ctx.mipWidth) ? ctx.imageWidth : ctx.mipWidth;
    pixFinalH = (ctx.imageHeight > 0 && ctx.imageHeight <= ctx.mipHeight) ? ctx.imageHeight : ctx.mipHeight;
    if (pixFinalW !== ctx.mipWidth || pixFinalH !== ctx.mipHeight) {
      console.log(`裁剪纹理: ${ctx.mipWidth}x${ctx.mipHeight} -> ${pixFinalW}x${pixFinalH}`);
      rgbaData = cropRGBA(rgbaData, ctx.mipWidth, ctx.mipHeight, pixFinalW, pixFinalH);
    }
  }
  const pngData = createPNG(rgbaData, pixFinalW, pixFinalH);
  console.log(`createPNG 完成 (DXT1), 输出大小: ${pngData.length}`);
  return { imageData: pngData, channels: 4 };
}

export function decodeRgbaPath(ctx: TexDecodeContext): DecodedRawImage | null {
  const expectedRGBA = ctx.mipWidth * ctx.mipHeight * 4;
  if (ctx.pixelData.length !== expectedRGBA) {
    return null;
  }
  console.log(`检测到 RGBA 格式: ${ctx.mipWidth}x${ctx.mipHeight}, 数据大小: ${ctx.pixelData.length}`);
  let pixFinalW = (ctx.imageWidth > 0 && ctx.imageWidth <= ctx.mipWidth) ? ctx.imageWidth : ctx.mipWidth;
  let pixFinalH = (ctx.imageHeight > 0 && ctx.imageHeight <= ctx.mipHeight) ? ctx.imageHeight : ctx.mipHeight;
  let finalData = ctx.pixelData;
  if (pixFinalW !== ctx.mipWidth || pixFinalH !== ctx.mipHeight) {
    console.log(`裁剪纹理: ${ctx.mipWidth}x${ctx.mipHeight} -> ${pixFinalW}x${pixFinalH}`);
    finalData = cropRGBA(ctx.pixelData, ctx.mipWidth, ctx.mipHeight, pixFinalW, pixFinalH);
  }
  if (ctx.maxSize > 0 && (pixFinalW > ctx.maxSize || pixFinalH > ctx.maxSize)) {
    const scale = Math.min(ctx.maxSize / pixFinalW, ctx.maxSize / pixFinalH);
    const outW = Math.max(1, Math.round(pixFinalW * scale));
    const outH = Math.max(1, Math.round(pixFinalH * scale));
    console.log(`RGBA 内存级降采样: ${pixFinalW}x${pixFinalH} → ${outW}x${outH}`);
    finalData = downsampleRGBA(finalData, pixFinalW, pixFinalH, outW, outH);
    pixFinalW = outW;
    pixFinalH = outH;
  }
  const pngData = createPNG(finalData, pixFinalW, pixFinalH);
  console.log(`createPNG 完成, 输出大小: ${pngData.length}`);
  return { imageData: pngData, channels: 4 };
}

export function decodeRgPath(ctx: TexDecodeContext): DecodedRawImage | null {
  const expectedRG = ctx.mipWidth * ctx.mipHeight * 2;
  if (ctx.pixelData.length !== expectedRG) {
    return null;
  }
  console.log('检测到 RG 格式，转换为 RGBA');
  let rgbaData = convertRGtoRGBA(
    ctx.pixelData,
    ctx.mipWidth,
    ctx.mipHeight,
    ctx.options.alphaFromRed,
    ctx.options.alphaFromGreen
  );
  const rgPixW = (ctx.imageWidth > 0 && ctx.imageWidth <= ctx.mipWidth) ? ctx.imageWidth : ctx.mipWidth;
  const rgPixH = (ctx.imageHeight > 0 && ctx.imageHeight <= ctx.mipHeight) ? ctx.imageHeight : ctx.mipHeight;
  if (rgPixW !== ctx.mipWidth || rgPixH !== ctx.mipHeight) {
    rgbaData = cropRGBA(rgbaData, ctx.mipWidth, ctx.mipHeight, rgPixW, rgPixH);
  }
  const pngData = createPNG(rgbaData, rgPixW, rgPixH);
  return { imageData: pngData, channels: 2 };
}

export function decodeRPath(ctx: TexDecodeContext): DecodedRawImage | null {
  const expectedR = ctx.mipWidth * ctx.mipHeight;
  if (ctx.pixelData.length !== expectedR) {
    return null;
  }
  console.log('检测到单通道格式 (R)，转换为 RGBA');
  let rgbaData = convertRtoRGBA(ctx.pixelData, ctx.mipWidth, ctx.mipHeight, ctx.options.alphaFromRed);
  const rPixW = (ctx.imageWidth > 0 && ctx.imageWidth <= ctx.mipWidth) ? ctx.imageWidth : ctx.mipWidth;
  const rPixH = (ctx.imageHeight > 0 && ctx.imageHeight <= ctx.mipHeight) ? ctx.imageHeight : ctx.mipHeight;
  if (rPixW !== ctx.mipWidth || rPixH !== ctx.mipHeight) {
    rgbaData = cropRGBA(rgbaData, ctx.mipWidth, ctx.mipHeight, rPixW, rPixH);
  }
  const pngData = createPNG(rgbaData, rPixW, rPixH);
  return { imageData: pngData, channels: 1 };
}
