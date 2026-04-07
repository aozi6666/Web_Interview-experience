import { useCallback, useRef, useState,useEffect } from 'react';
import { GenerateStep, ImageUpload, ModalState, UploadProgress, QrCodeState } from './types';

export const useImageUpload = () => {
  const [images, setImages] = useState<ImageUpload[]>([]);
  const [unacceptableImages, setUnacceptableImages] = useState<ImageUpload[]>(
    [],
  );
  const [errors, setErrors] = useState<string[]>([]);
  const localImageCount = useRef(0);


  const addImage = useCallback((image: ImageUpload) => {
    setImages((prev) => {
      const newlist = [...prev, image];
      // localImageCount.current = newlist.filter(
      //   (img) => img.from === 'local',
      // ).length;
      return newlist;
    });
  }, []);

  const removeImage = useCallback((index: number) => {
    setImages((prev) => {
      console.log('remove', prev[index].url);
      const newlist = prev.filter((_, i) => i !== index);
      // newlist.map((img) => {
      //   console.log(img.url, img.from);
      // });
      // console.log('legth', newlist.length);

      // localImageCount.current = newlist.filter(
      //   (img) => img.from === 'local',
      // ).length;
      return newlist;
    });
  }, []);

  const removeImageByUrl = useCallback((url: string) => {
    setImages((prev) => {
      const newlist = prev.filter((img) => img.url !== url);
      // localImageCount.current = newlist.filter(
      //   (img) => img.from === 'local',
      // ).length;
      return newlist;
    });
  }, []);

  const moveToUnacceptable = useCallback(
    (image: ImageUpload, error: string) => {
      setImages((prev) => prev.filter((img) => img.id !== image.id));
      // setUnacceptableImages((prev) => [...prev, image]);
      setUnacceptableImages((prev) => {
        const isDuplicate = prev.some((img) => img.id === image.id);
        return isDuplicate ? prev : [...prev, image];
      });
      setErrors((prev) => [...prev, error]);
    },
    [],
  );

  const addUnacceptableImage = useCallback(
    (image: ImageUpload, error: string) => {
      setUnacceptableImages((prev) => [...prev, image]);
      setErrors((prev) => [...prev, error]);
    },
    [],
  );

  const clearImages = useCallback(() => {
    setImages([]);
    setUnacceptableImages([]);
    setErrors([]);
    // if (rafRef.current) {
    //   cancelAnimationFrame(rafRef.current);
    //   rafRef.current = null;
    //   isUpdatingProgressRef.current = false;
    // }
  }, []);

  const updateImageUrl = useCallback((imageId: string, newUrl: string) => {
    setImages((prevImages) =>
      prevImages.map((image) =>
        image.id === imageId ? { ...image, url: newUrl } : image,
      ),
    );
  }, []);
  const updateImage = useCallback((
    imageId: string,
    updates: Partial<ImageUpload> // 关键：Partial 表示"部分属性"
  ) => {
    setImages((prevImages) =>
      prevImages.map((image) =>
        // 匹配目标 id 时，合并原属性和新属性（新属性优先级更高）
        image.id === imageId ? { ...image, ...updates } : image
      )
    );
  }, []);

  return {
    images,
    removeImageByUrl,
    localImageCount,
    addUnacceptableImage,
    unacceptableImages,
    errors,
    addImage,
    removeImage,
    moveToUnacceptable,
    clearImages,
    updateImageUrl,
    updateImage,
    setImages,
    // setImageProgress,
  };
};

/**
 * 上传进度管理 Hook
 *
 * 生成步骤流程：
 * IDLE -> STATIC_GENERATING -> STATIC_COMPLETED -> DYNAMIC_GENERATING -> DYNAMIC_COMPLETED
 */
export const useUploadProgress = () => {
  const [progress, setProgress] = useState<UploadProgress>({
    progress: 0,
    step: GenerateStep.IDLE,
    isLoading: false,
    isGenerating: false,
    waitCount: 0,
    delay: 3,
  });

  const updateProgress = useCallback((updates: Partial<UploadProgress>) => {
    setProgress((prev) => ({ ...prev, ...updates }));
  }, []);

  const resetProgress = useCallback(() => {
    setProgress({
      progress: 0,
      step: GenerateStep.IDLE,
      isLoading: false,
      isGenerating: false,
      waitCount: 0,
      delay: 3,
    });
  }, []);

  return {
    progress,
    updateProgress,
    resetProgress,
  };
};

export const useModalState = () => {
  const [modals, setModals] = useState<ModalState>({
    isQrcodeOpen: false,
    isHelpOpen: false,
    isUnacceptOpen: false,
    isPreviewOpen: false,
    isShowError: false,
  });

  const openModal = useCallback((modal: keyof ModalState) => {
    setModals((prev) => ({ ...prev, [modal]: true }));
  }, []);

  const closeModal = useCallback((modal: keyof ModalState) => {
    setModals((prev) => ({ ...prev, [modal]: false }));
  }, []);

  const toggleModal = useCallback((modal: keyof ModalState) => {
    setModals((prev) => ({ ...prev, [modal]: !prev[modal] }));
  }, []);

  return {
    modals,
    openModal,
    closeModal,
    toggleModal,
  };
};

export const useQrcode = () => {
  const [qrcode, setQcode] = useState<QrCodeState>({
    url: '',
  });
  return {
    qrcode,
    setQcode,
  };
};