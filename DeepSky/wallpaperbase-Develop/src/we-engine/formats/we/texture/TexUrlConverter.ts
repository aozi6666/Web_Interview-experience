import { logLoaderVerbose } from '../LoaderUtils';
import { downsampleRGBA } from './TexImageProcessor';

const console = { ...globalThis.console, log: logLoaderVerbose };
const MAX_TEXTURE_SIZE = 16384;

export type TexAlphaMode = 'opaque' | 'fromBrightness';

export interface TexUrlOptions {
  alphaMode?: TexAlphaMode;
}

export interface TexInfoLike {
  format: 'jpeg' | 'png' | 'raw' | 'mp4' | 'unknown';
  imageData: Uint8Array;
}

export async function texToUrl(texInfo: TexInfoLike, options: TexUrlOptions = {}): Promise<string> {
  if (texInfo.format === 'raw') {
    const view = new DataView(texInfo.imageData.buffer, texInfo.imageData.byteOffset);
    const width = view.getUint32(0, true);
    const height = view.getUint32(4, true);
    let rgbaData: Uint8Array = new Uint8Array(texInfo.imageData.buffer, texInfo.imageData.byteOffset + 8);
    let outW = width;
    let outH = height;
    if (width > MAX_TEXTURE_SIZE || height > MAX_TEXTURE_SIZE) {
      const scale = Math.min(MAX_TEXTURE_SIZE / width, MAX_TEXTURE_SIZE / height);
      outW = Math.max(1, Math.round(width * scale));
      outH = Math.max(1, Math.round(height * scale));
      rgbaData = downsampleRGBA(rgbaData, width, height, outW, outH);
    }
    const canvas = document.createElement('canvas');
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext('2d')!;
    const imageData = ctx.createImageData(outW, outH);
    imageData.data.set(rgbaData);
    ctx.putImageData(imageData, 0, 0);
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(URL.createObjectURL(blob));
        } else {
          console.error('texToUrl: toBlob 返回 null');
          reject(new Error('Failed to create blob from canvas'));
        }
      }, 'image/png');
    });
  }

  if (texInfo.format === 'png') {
    const data = texInfo.imageData;
    const alphaMode = options.alphaMode ?? 'opaque';
    if (data.length > 29 && data[0] === 0x89 && data[1] === 0x50 && data[2] === 0x4E && data[3] === 0x47) {
      const colorType = data[25];
      if (colorType !== 4 && colorType !== 6 && alphaMode === 'fromBrightness') {
        return await pngAddAlphaFromBrightness(data);
      }
    }
  }

  const mimeType = texInfo.format === 'jpeg' ? 'image/jpeg'
    : texInfo.format === 'png' ? 'image/png'
      : texInfo.format === 'mp4' ? 'video/mp4'
        : 'application/octet-stream';
  const buffer = new Uint8Array(texInfo.imageData).buffer;
  const blob = new Blob([buffer], { type: mimeType });
  return URL.createObjectURL(blob);
}

export async function pngAddAlphaFromBrightness(pngData: Uint8Array): Promise<string> {
  return new Promise((resolve, reject) => {
    const copy = new Uint8Array(pngData.length);
    copy.set(pngData);
    const srcBlob = new Blob([copy.buffer], { type: 'image/png' });
    const srcUrl = URL.createObjectURL(srcBlob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(srcUrl);
      const w = img.width;
      const h = img.height;
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0);
      const imgData = ctx.getImageData(0, 0, w, h);
      const px = imgData.data;
      for (let i = 0; i < px.length; i += 4) {
        px[i + 3] = Math.max(px[i], px[i + 1], px[i + 2]);
      }
      ctx.putImageData(imgData, 0, 0);
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(URL.createObjectURL(blob));
        } else {
          reject(new Error('pngAddAlphaFromBrightness: toBlob 返回 null'));
        }
      }, 'image/png');
    };
    img.onerror = () => {
      URL.revokeObjectURL(srcUrl);
      console.warn('pngAddAlphaFromBrightness 失败，使用原始 PNG');
      const fallbackCopy = new Uint8Array(pngData.length);
      fallbackCopy.set(pngData);
      const blob = new Blob([fallbackCopy.buffer], { type: 'image/png' });
      resolve(URL.createObjectURL(blob));
    };
    img.src = srcUrl;
  });
}
