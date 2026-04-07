/**
 * 解析 Wallpaper Engine TEX 文件并转换为 PNG
 * 基于 repkg 项目的格式分析
 */

const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');

// 简单的 LZ4 解压实现
function lz4Decompress(input, outputSize) {
  const output = Buffer.alloc(outputSize);
  let inputPos = 0;
  let outputPos = 0;

  while (inputPos < input.length && outputPos < outputSize) {
    const token = input[inputPos++];
    
    // 字面量长度
    let literalLength = (token >> 4) & 0x0F;
    if (literalLength === 15) {
      let b;
      do {
        b = input[inputPos++];
        literalLength += b;
      } while (b === 255 && inputPos < input.length);
    }
    
    // 复制字面量
    for (let i = 0; i < literalLength && inputPos < input.length && outputPos < outputSize; i++) {
      output[outputPos++] = input[inputPos++];
    }
    
    if (inputPos >= input.length || outputPos >= outputSize) break;
    
    // 匹配偏移
    const offset = input[inputPos] | (input[inputPos + 1] << 8);
    inputPos += 2;
    
    if (offset === 0) break;
    
    // 匹配长度
    let matchLength = (token & 0x0F) + 4;
    if ((token & 0x0F) === 15) {
      let b;
      do {
        b = input[inputPos++];
        matchLength += b;
      } while (b === 255 && inputPos < input.length);
    }
    
    // 复制匹配
    const matchStart = outputPos - offset;
    for (let i = 0; i < matchLength && outputPos < outputSize; i++) {
      output[outputPos++] = output[matchStart + i];
    }
  }
  
  return output.slice(0, outputPos);
}

function parseTex(filePath) {
  const buffer = fs.readFileSync(filePath);
  
  console.log('文件大小:', buffer.length, '字节');
  
  // 检查 TEXV magic
  const magic1 = buffer.toString('ascii', 0, 8);
  console.log('Magic1:', magic1);
  
  if (!magic1.startsWith('TEXV')) {
    console.error('不是有效的 TEX 文件');
    return null;
  }
  
  // TEXI 固定在偏移 9
  const texiPos = 9;
  const texiMagic = buffer.toString('ascii', texiPos, texiPos + 4);
  if (texiMagic !== 'TEXI') {
    console.error('未找到 TEXI section at expected position');
    return null;
  }
  console.log('TEXI 位置:', texiPos);
  
  // TEXI version
  const texiVersion = buffer.toString('ascii', texiPos + 4, texiPos + 8);
  console.log('TEXI 版本:', texiVersion);
  
  // TEXI header (跳过 TEXI0001\0 = 9 bytes)
  const headerStart = texiPos + 9;
  const texFormat = buffer.readInt32LE(headerStart);
  const texFlags = buffer.readInt32LE(headerStart + 4);
  const textureWidth = buffer.readInt32LE(headerStart + 8);
  const textureHeight = buffer.readInt32LE(headerStart + 12);
  const imageWidth = buffer.readInt32LE(headerStart + 16);
  const imageHeight = buffer.readInt32LE(headerStart + 20);
  
  console.log('Format:', texFormat);
  console.log('Flags:', texFlags);
  console.log('Texture size:', textureWidth, 'x', textureHeight);
  console.log('Image size:', imageWidth, 'x', imageHeight);
  
  // TEXB 固定在 TEXI header 之后 (headerStart + 28)
  const texbPos = headerStart + 28;
  const texbMagic = buffer.toString('ascii', texbPos, texbPos + 4);
  if (texbMagic !== 'TEXB') {
    console.error('未找到 TEXB section at expected position', texbPos);
    console.log('Found:', texbMagic, 'at', texbPos);
    // 尝试搜索
    const searchPos = buffer.indexOf('TEXB');
    console.log('TEXB search result:', searchPos);
    return null;
  }
  console.log('TEXB 位置:', texbPos);
  
  // TEXB version
  const texbVersion = buffer.toString('ascii', texbPos + 4, texbPos + 8);
  console.log('TEXB 版本:', texbVersion);
  
  // 根据版本确定 header 大小
  let pos = texbPos + 9; // 跳过 TEXBxxxx\0
  
  const imageCount = buffer.readInt32LE(pos);
  pos += 4;
  console.log('Image count:', imageCount);
  
  // V3/V4 有额外的 imageFormat
  let imageFormat = 0;
  if (texbVersion === '0003' || texbVersion === '0004') {
    imageFormat = buffer.readInt32LE(pos);
    pos += 4;
    console.log('Image format:', imageFormat);
    
    if (texbVersion === '0004') {
      const isVideo = buffer.readInt32LE(pos);
      pos += 4;
      console.log('Is video:', isVideo);
    }
  }
  
  // 读取 mipmap 数量
  const mipmapCount = buffer.readInt32LE(pos);
  pos += 4;
  console.log('Mipmap count:', mipmapCount);
  console.log('当前位置:', pos, '(0x' + pos.toString(16) + ')');
  
  if (mipmapCount === 0 || mipmapCount > 16) {
    console.error('Mipmap count 异常:', mipmapCount);
    return null;
  }
  
  // 读取第一个 mipmap
  // V2/V3/V4 格式: width(4) + height(4) + isLZ4(4) + decompressedSize(4) + compressedSize(4) + data
  const mipWidth = buffer.readInt32LE(pos);
  const mipHeight = buffer.readInt32LE(pos + 4);
  const isLZ4 = buffer.readInt32LE(pos + 8) === 1;
  const decompressedSize = buffer.readInt32LE(pos + 12);
  const compressedSize = buffer.readInt32LE(pos + 16);
  pos += 20;
  
  console.log('Mipmap 0:');
  console.log('  Size:', mipWidth, 'x', mipHeight);
  console.log('  LZ4 compressed:', isLZ4);
  console.log('  Decompressed size:', decompressedSize);
  console.log('  Compressed size:', compressedSize);
  console.log('  Data starts at:', pos);
  
  // 提取压缩数据
  const compressedData = buffer.slice(pos, pos + compressedSize);
  console.log('  Compressed data length:', compressedData.length);
  
  // 解压
  let pixelData;
  if (isLZ4) {
    console.log('正在 LZ4 解压...');
    try {
      pixelData = lz4Decompress(compressedData, decompressedSize);
      console.log('解压后大小:', pixelData.length);
    } catch (e) {
      console.error('LZ4 解压失败:', e);
      return null;
    }
  } else {
    pixelData = compressedData;
  }
  
  // 分析像素数据
  console.log('\n像素数据分析:');
  console.log('  预期大小 (RG):', mipWidth * mipHeight * 2);
  console.log('  预期大小 (RGBA):', mipWidth * mipHeight * 4);
  console.log('  实际大小:', pixelData.length);
  
  // 统计像素值分布
  const histogram = new Array(256).fill(0);
  for (let i = 0; i < pixelData.length; i++) {
    histogram[pixelData[i]]++;
  }
  
  console.log('\n全部像素值分布 (非零值):');
  for (let i = 0; i < 256; i++) {
    if (histogram[i] > 0) {
      console.log(`  ${i}: ${histogram[i]} (${(histogram[i] / pixelData.length * 100).toFixed(2)}%)`);
    }
  }
  
  // 找出非 127 值的位置分布
  console.log('\n非中性值 (非127) 的位置分析:');
  let firstNon127 = -1;
  let lastNon127 = -1;
  let countNon127 = 0;
  for (let i = 0; i < pixelData.length; i++) {
    if (pixelData[i] !== 127) {
      countNon127++;
      if (firstNon127 === -1) firstNon127 = i;
      lastNon127 = i;
    }
  }
  console.log(`  非127值数量: ${countNon127}`);
  console.log(`  首个非127值位置: ${firstNon127}`);
  console.log(`  最后非127值位置: ${lastNon127}`);
  
  return {
    width: mipWidth,
    height: mipHeight,
    pixelData,
    format: texFormat
  };
}

function writePng(filePath, width, height, rgbaBuffer) {
  const png = new PNG({ width, height });
  rgbaBuffer.copy(png.data);
  const out = PNG.sync.write(png);
  fs.writeFileSync(filePath, out);
}

// 主程序
const texFile = process.argv[2] || '/Users/yuhangli/Perforce/wallpaper_engine/resources/wallpapers/3571376089/extracted/materials/masks/shake_mask_81bfb131.tex';

console.log('解析 TEX 文件:', texFile);
console.log('='.repeat(50));

const result = parseTex(texFile);

if (result) {
  console.log('\n解析成功!');
  
  // 保存原始像素数据到文件以便分析
  const outputPath = texFile.replace('.tex', '_raw.bin');
  fs.writeFileSync(outputPath, result.pixelData);
  console.log('原始像素数据已保存到:', outputPath);
  
  // 将像素数据转换为 PNG
  const width = result.width;
  const height = result.height;
  const data = result.pixelData;
  const expectedRGBA = width * height * 4;
  const expectedRG = width * height * 2;
  const expectedR = width * height;

  const isPng = data.length > 8 &&
    data[0] === 0x89 && data[1] === 0x50 && data[2] === 0x4E && data[3] === 0x47 &&
    data[4] === 0x0D && data[5] === 0x0A && data[6] === 0x1A && data[7] === 0x0A;
  const isJpeg = data.length > 3 && data[0] === 0xFF && data[1] === 0xD8 && data[2] === 0xFF;

  if (isPng) {
    const outPath = texFile.replace('.tex', '_embedded.png');
    fs.writeFileSync(outPath, data);
    console.log('内嵌 PNG 已保存到:', outPath);
  } else if (isJpeg) {
    const outPath = texFile.replace('.tex', '_embedded.jpg');
    fs.writeFileSync(outPath, data);
    console.log('内嵌 JPEG 已保存到:', outPath);
  } else if (data.length === expectedRGBA) {
    const outPath = texFile.replace('.tex', '_rgba.png');
    writePng(outPath, width, height, data);
    console.log('RGBA PNG 已保存到:', outPath);

    const alpha = Buffer.alloc(expectedRGBA);
    const rgb = Buffer.alloc(expectedRGBA);
    for (let i = 0; i < width * height; i++) {
      const idx = i * 4;
      const a = data[idx + 3];
      alpha[idx] = a;
      alpha[idx + 1] = a;
      alpha[idx + 2] = a;
      alpha[idx + 3] = 255;

      rgb[idx] = data[idx];
      rgb[idx + 1] = data[idx + 1];
      rgb[idx + 2] = data[idx + 2];
      rgb[idx + 3] = 255;
    }
    writePng(texFile.replace('.tex', '_alpha.png'), width, height, alpha);
    writePng(texFile.replace('.tex', '_rgb.png'), width, height, rgb);
    console.log('RGBA Alpha PNG 已保存到:', texFile.replace('.tex', '_alpha.png'));
    console.log('RGBA RGB PNG 已保存到:', texFile.replace('.tex', '_rgb.png'));
  } else if (data.length === expectedRG) {
    const rgba = Buffer.alloc(expectedRGBA);
    const rgbaAlphaR = Buffer.alloc(expectedRGBA);
    const rgbaAlphaG = Buffer.alloc(expectedRGBA);
    const rgbaEnhanced = Buffer.alloc(expectedRGBA);

    for (let i = 0; i < width * height; i++) {
      const r = data[i * 2];
      const g = data[i * 2 + 1];
      const idx = i * 4;

      // 直接可视化 RG
      rgba[idx] = r;
      rgba[idx + 1] = g;
      rgba[idx + 2] = 127;
      rgba[idx + 3] = 255;

      // R 作为 alpha
      rgbaAlphaR[idx] = 255;
      rgbaAlphaR[idx + 1] = 255;
      rgbaAlphaR[idx + 2] = 255;
      rgbaAlphaR[idx + 3] = r;

      // G 作为 alpha（WE 常用）
      rgbaAlphaG[idx] = r;
      rgbaAlphaG[idx + 1] = r;
      rgbaAlphaG[idx + 2] = r;
      rgbaAlphaG[idx + 3] = g;

      // 增强对比度（方便看 mask）
      const rEnhanced = Math.min(255, Math.max(0, 127 + (r - 127) * 8));
      const gEnhanced = Math.min(255, Math.max(0, 127 + (g - 127) * 8));
      rgbaEnhanced[idx] = rEnhanced;
      rgbaEnhanced[idx + 1] = gEnhanced;
      rgbaEnhanced[idx + 2] = 127;
      rgbaEnhanced[idx + 3] = 255;
    }

    const basePath = texFile.replace('.tex', '');
    writePng(`${basePath}_rg.png`, width, height, rgba);
    writePng(`${basePath}_alpha_r.png`, width, height, rgbaAlphaR);
    writePng(`${basePath}_alpha_g.png`, width, height, rgbaAlphaG);
    writePng(`${basePath}_rg_enhanced.png`, width, height, rgbaEnhanced);
    console.log('RG PNG 已保存到:', `${basePath}_rg.png`);
    console.log('R->A PNG 已保存到:', `${basePath}_alpha_r.png`);
    console.log('G->A PNG 已保存到:', `${basePath}_alpha_g.png`);
    console.log('增强 RG PNG 已保存到:', `${basePath}_rg_enhanced.png`);
  } else if (data.length === expectedR) {
    const rgba = Buffer.alloc(expectedRGBA);
    for (let i = 0; i < width * height; i++) {
      const v = data[i];
      const idx = i * 4;
      rgba[idx] = 255;
      rgba[idx + 1] = 255;
      rgba[idx + 2] = 255;
      rgba[idx + 3] = v;
    }
    const outPath = texFile.replace('.tex', '_alpha_r.png');
    writePng(outPath, width, height, rgba);
    console.log('R->A PNG 已保存到:', outPath);
  } else {
    console.warn('像素数据大小不匹配，无法输出 PNG');
  }
}
