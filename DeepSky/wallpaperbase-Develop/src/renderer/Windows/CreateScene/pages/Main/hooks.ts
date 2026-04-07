import { useState, useCallback } from 'react';
export async function captureVideoFirstFrame(videoFile: File): Promise<File> {
    return new Promise((resolve, reject) => {
      // 创建视频URL
      const videoUrl = URL.createObjectURL(videoFile);
      const video = document.createElement('video');
      
      video.src = videoUrl;
      video.muted = true; // 静音以避免自动播放限制
      video.playsInline = true;
      video.crossOrigin = 'anonymous'; // 处理跨域问题
      
      // 视频加载错误处理
      video.onerror = () => {
        URL.revokeObjectURL(videoUrl);
        reject(new Error('视频加载失败'));
      };
      
      // 当视频元数据加载完成
      video.onloadedmetadata = () => {
        // 设置视频尺寸
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          URL.revokeObjectURL(videoUrl);
          reject(new Error('无法创建Canvas上下文'));
          return;
        }
        
        // 跳转到第一帧（稍微大于0确保能捕获到帧）
        video.currentTime = 0.1;
        
        // 当视频跳转到指定时间后
        video.onseeked = () => {
          try {
            // 绘制视频帧到canvas
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            
            // 检查是否成功绘制
            if (canvas.width === 0 || canvas.height === 0) {
              throw new Error('Canvas尺寸无效');
            }
            
            // 将canvas转换为JPG Blob
            canvas.toBlob(
              (blob) => {
                if (!blob) {
                  reject(new Error('无法生成图片'));
                  return;
                }
                
                // 创建JPG File对象
                const jpgFile = new File(
                  [blob],
                  `${videoFile.name.replace(/\.[^/.]+$/, '')}_first_frame.jpg`,
                  {
                    type: 'image/jpeg',
                    lastModified: Date.now(),
                  }
                );
                
                // 清理URL对象
                URL.revokeObjectURL(videoUrl);
                
                resolve(jpgFile);
              },
              'image/jpeg',
              0.9 // JPEG质量 (0-1)
            );
          } catch (error) {
            URL.revokeObjectURL(videoUrl);
            reject(error);
          }
        };
        
        // 设置超时防止视频加载失败
        setTimeout(() => {
          if (video.readyState < 2) { // HAVE_CURRENT_DATA
            URL.revokeObjectURL(videoUrl);
            reject(new Error('视频加载超时'));
          }
        }, 10000); // 10秒超时
      };
      
      // 开始加载视频
      video.load();
    });
  }