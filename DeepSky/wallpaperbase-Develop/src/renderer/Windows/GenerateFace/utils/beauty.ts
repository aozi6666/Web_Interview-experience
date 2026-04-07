import { IPCChannels } from '@shared/channels';
import { getIpcEvents } from '@renderer/ipc-events';
import { IpcTarget } from '@shared/ipc-events';

const ipcEvents = getIpcEvents();


export const base64ToBlob = (base64Str: string): Promise<Blob> => {
  return new Promise((resolve) => {
    // 分离 base64 数据和前缀（如 "data:image/png;base64,"）
    const [prefix, data] = base64Str.split(',');
    // 提取 MIME 类型（如 "image/png"）
    const mimeType = prefix.match(/:(.*?);/)?.[1] || '';
    // 解码 base64 为二进制字符串
    const byteCharacters = atob(data);
    const byteArrays = [];

    for (let i = 0; i < byteCharacters.length; i++) {
      byteArrays.push(byteCharacters.charCodeAt(i));
    }

    // 创建 Blob 对象
    const blob = new Blob([new Uint8Array(byteArrays)], { type: mimeType });
    resolve(blob);
  });
};
export async function download(url: string): Promise<Blob> {
  const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`下载失败，状态码：${response.status}`);
    }
    return await response.blob();
}
export const blobToFile = (blob: Blob, fileName: string): File => {
  return new File([blob], fileName, { type: blob.type });
};
export async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      resolve(reader.result as string);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
export async function imageUrlToBase64(url: string): Promise<string> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`下载失败，状态码：${response.status}`);
    }
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        resolve(reader.result);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error('转换失败：', error);
    return '';
  }
}
export const processImage = async (originalImage: string) => {
  try {
    const beautyParams = {
      beauty: {
        blurAlpha: 0.3,
        white: 0.25,
      },
      reshape: {
        faceSlim: 0.1,
        eyeZoom: 0.5,
      },
      lipstick: {
        blend: 0.1,
      },
      blusher: {
        blend: 0.1,
      },
    };
    // 将base64转换为临时文件路径（这里需要在主进程中处理）
    const result = await ipcEvents.invokeTo(IpcTarget.MAIN, IPCChannels.FACE_BEAUTY_PROCESS, {
      imageData: originalImage,
      params: {
        filters: beautyParams,
      },
    });

    if (result.success) {
      const processResult = result.data;
      // 确保base64数据有正确的前缀
      const base64Data = processResult.base64Data.startsWith('data:')
        ? processResult.base64Data
        : `data:image/png;base64,${processResult.base64Data}`;
      return base64Data;
      // setProcessedImage(base64Data);
      // setImageInfo({
      //   width: processResult.width,
      //   height: processResult.height,
      // });
      // message.success('图像处理完成！');
    } else {
      console.log(`处理失败: ${result.message}`);
    }
  } catch {
    console.log('图像处理失败，请重试');
  }
};

const calculateScaledDimensions = (
  originalWidth: number,
  originalHeight: number,
  maxWidth: number,
  maxHeight: number,
) => {
  // 如果原始尺寸已经小于最大限制，直接返回原始尺寸
  if (originalWidth <= maxWidth && originalHeight <= maxHeight) {
    return { width: originalWidth, height: originalHeight };
  }

  // 计算宽高比例
  const aspectRatio = originalWidth / originalHeight;

  // 根据比例计算缩放后的尺寸
  let newWidth, newHeight;

  if (aspectRatio > 1) {
    // 宽图，以宽度为基准缩放
    newWidth = maxWidth;
    newHeight = Math.round(maxWidth / aspectRatio);

    // 如果高度超过最大限制，再以高度为基准缩放
    if (newHeight > maxHeight) {
      newHeight = maxHeight;
      newWidth = Math.round(maxHeight * aspectRatio);
    }
  } else {
    // 高图或正方形，以高度为基准缩放
    newHeight = maxHeight;
    newWidth = Math.round(maxHeight * aspectRatio);

    // 如果宽度超过最大限制，再以宽度为基准缩放
    if (newWidth > maxWidth) {
      newWidth = maxWidth;
      newHeight = Math.round(maxWidth / aspectRatio);
    }
  }

  return { width: newWidth, height: newHeight };
};

export const compressedImage = (img: HTMLImageElement): string => {
  console.log('开始压缩图片');
  try {
    // 最大尺寸限制
    // const maxWidth = 1080;
    // const maxHeight = 1920;
    const maxWidth = img.width;
    const maxHeight = img.height;

    // 计算保持比例的缩放尺寸
    const scaled = calculateScaledDimensions(
      img.width,
      img.height,
      maxWidth,
      maxHeight,
    );
    console.log('原始尺寸:', img.width, img.height);
    console.log('缩放后的尺寸:', scaled.width, scaled.height);
    // 创建Canvas元素
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('无法获取Canvas 2D上下文');
    }
    // 设置Canvas尺寸为计算后的尺寸
    canvas.width = scaled.width;
    canvas.height = scaled.height;

    // 在Canvas上绘制调整后的图片
    ctx.drawImage(img, 0, 0, scaled.width, scaled.height);

    // 获取处理后的图片数据
    const dataUrl = canvas.toDataURL('image/jpeg', 1);
    if (dataUrl === 'data:,') {
      throw new Error('Canvas生成空数据，可能是跨域限制导致');
    }
    // console.log('压缩后的图片大小:', dataUrl.length / 1024, 'KB',dataUrl);

    return dataUrl;
  } catch (error) {
    console.error('图片压缩失败:', error);
  }
  return '';
};

export async function savePcmAsFile() {}
