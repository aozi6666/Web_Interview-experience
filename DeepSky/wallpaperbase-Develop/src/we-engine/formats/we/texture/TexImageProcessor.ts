export function cropRGBA(
  data: Uint8Array,
  srcWidth: number,
  _srcHeight: number,
  dstWidth: number,
  dstHeight: number,
): Uint8Array {
  const result = new Uint8Array(dstWidth * dstHeight * 4);
  for (let y = 0; y < dstHeight; y++) {
    const srcOffset = y * srcWidth * 4;
    const dstOffset = y * dstWidth * 4;
    result.set(data.subarray(srcOffset, srcOffset + dstWidth * 4), dstOffset);
  }
  return result;
}

export function float16ToFloat32(h: number): number {
  const sign = (h >> 15) & 0x1;
  const exponent = (h >> 10) & 0x1F;
  const mantissa = h & 0x3FF;
  if (exponent === 0) {
    if (mantissa === 0) return sign ? -0 : 0;
    return (sign ? -1 : 1) * Math.pow(2, -14) * (mantissa / 1024);
  }
  if (exponent === 31) {
    return mantissa === 0 ? (sign ? -Infinity : Infinity) : NaN;
  }
  return (sign ? -1 : 1) * Math.pow(2, exponent - 15) * (1 + mantissa / 1024);
}

export function convertRGtoRGBA(
  rgData: Uint8Array,
  width: number,
  height: number,
  alphaFromRed = false,
  alphaFromGreen = false,
): Uint8Array {
  const rgba = new Uint8Array(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    const r = rgData[i * 2];
    const g = rgData[i * 2 + 1];
    if (alphaFromGreen) {
      rgba[i * 4] = r;
      rgba[i * 4 + 1] = r;
      rgba[i * 4 + 2] = r;
      rgba[i * 4 + 3] = g;
    } else if (alphaFromRed) {
      rgba[i * 4] = 255;
      rgba[i * 4 + 1] = 255;
      rgba[i * 4 + 2] = 255;
      rgba[i * 4 + 3] = r;
    } else {
      rgba[i * 4] = r;
      rgba[i * 4 + 1] = g;
      rgba[i * 4 + 2] = 127;
      rgba[i * 4 + 3] = 255;
    }
  }
  return rgba;
}

export function convertRtoRGBA(rData: Uint8Array, width: number, height: number, alphaFromRed = false): Uint8Array {
  const rgba = new Uint8Array(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    const value = rData[i];
    if (alphaFromRed) {
      rgba[i * 4] = 255;
      rgba[i * 4 + 1] = 255;
      rgba[i * 4 + 2] = 255;
      rgba[i * 4 + 3] = value;
    } else {
      rgba[i * 4] = value;
      rgba[i * 4 + 1] = value;
      rgba[i * 4 + 2] = value;
      rgba[i * 4 + 3] = 255;
    }
  }
  return rgba;
}

export function downsampleRGBA(
  src: Uint8Array, srcW: number, srcH: number, dstW: number, dstH: number,
): Uint8Array {
  const dst = new Uint8Array(dstW * dstH * 4);
  const sampleScale = { x: srcW / dstW, y: srcH / dstH };
  for (let dy = 0; dy < dstH; dy++) {
    const srcY0 = Math.floor(dy * sampleScale.y);
    const srcY1 = Math.min(Math.floor((dy + 1) * sampleScale.y), srcH);
    for (let dx = 0; dx < dstW; dx++) {
      const srcX0 = Math.floor(dx * sampleScale.x);
      const srcX1 = Math.min(Math.floor((dx + 1) * sampleScale.x), srcW);
      let r = 0; let g = 0; let b = 0; let a = 0; let count = 0;
      for (let sy = srcY0; sy < srcY1; sy++) {
        for (let sx = srcX0; sx < srcX1; sx++) {
          const off = (sy * srcW + sx) * 4;
          r += src[off];
          g += src[off + 1];
          b += src[off + 2];
          a += src[off + 3];
          count++;
        }
      }
      if (count > 0) {
        const dOff = (dy * dstW + dx) * 4;
        dst[dOff] = Math.round(r / count);
        dst[dOff + 1] = Math.round(g / count);
        dst[dOff + 2] = Math.round(b / count);
        dst[dOff + 3] = Math.round(a / count);
      }
    }
  }
  return dst;
}

export function createPNG(rgbaData: Uint8Array, width: number, height: number): Uint8Array {
  const result = new Uint8Array(rgbaData.length + 8);
  const view = new DataView(result.buffer);
  view.setUint32(0, width, true);
  view.setUint32(4, height, true);
  result.set(rgbaData, 8);
  return result;
}

export function parseJpegDimensions(data: Uint8Array): { width: number; height: number } | null {
  let offset = 2;
  while (offset < data.length - 8) {
    if (data[offset] !== 0xFF) {
      offset++;
      continue;
    }
    const marker = data[offset + 1];
    if (marker >= 0xC0 && marker <= 0xC3) {
      const height = (data[offset + 5] << 8) | data[offset + 6];
      const width = (data[offset + 7] << 8) | data[offset + 8];
      return { width, height };
    }
    if (marker === 0xD8 || marker === 0xD9) {
      offset += 2;
    } else {
      const length = (data[offset + 2] << 8) | data[offset + 3];
      offset += 2 + length;
    }
  }
  return null;
}
