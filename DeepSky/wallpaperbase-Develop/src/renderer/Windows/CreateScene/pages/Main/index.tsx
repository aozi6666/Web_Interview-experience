/* eslint-disable camelcase */
import {
  createModel,
  uploadImage
} from '@api';
import { Image, Input, message } from 'antd';
import { useRef, useState } from 'react';
import Loading from '../../../GenerateFace/pages/Loading';
import { captureVideoFirstFrame } from './hooks';
import { useStyles } from './styles';

import closeIcon from '$assets/images/uploadPhoto/icon-close_state_nor.png';
import delIcon from '$assets/images/uploadPhoto/icon-trash_state_nor_24_trash-03__36_Default.png';
import uploadIcon from '$assets/images/uploadPhoto/upload-01.png';
// 极简的文件上传组件
const SimpleUploadComponent = () => {
  // 状态管理：输入的名称和选中的文件
  const [name, setName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [loadingMessage, setLoadingMessage] = useState('正在上传，请稍候');
  const [delay, setDelay] = useState(3);
  const [imgUrl, setImgUrl] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const { styles } = useStyles();
  const videoImgUrl = useRef('');
  // 处理名称输入变化
  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setName(e.target.value);
  };

  // 处理文件选择
  const handleInput = () => {
    try {
      const input = document.createElement('input');
      input.type = 'file';
      // input.accept = 'image/*';
      input.accept = '.jpg,.jpeg,.png,.mp4,image/jpeg,image/png,video/mp4';
      input.multiple = false;

      input.onchange = async (e) => {
        const { files } = e.target as HTMLInputElement;
        if (!files) return;
        setDelay(3);
        setIsLoading(true);
        setProgress(0);
        const file = files[0];
        const allowedTypes = ['image/jpeg', 'image/png']; // 允许的类型
        if (allowedTypes.includes(file.type)) {
          const url: string = await uploadImage(file, 'ugc/img');
          console.log(url);
          setImgUrl(url);
          setVideoUrl('');
          console.log('img',file.size/1024/1024);
        }
        const videoTypes = ['video/mp4'];
        if (videoTypes.includes(file.type)) {
          const firstFrame = await captureVideoFirstFrame(file);
          videoImgUrl.current = await uploadImage(firstFrame, 'ugc/img');
          const url: string = await uploadImage(file, 'ugc/video');
          console.log(url);
          setVideoUrl(url);
          setImgUrl('');
          console.log('mp4',file.size/1024/1024);
        }
        setProgress(100);
        setIsLoading(false);

      };

      input.click();
    } catch {
      message.error('选择文件失败');
    }
  }
  // 处理确定按钮点击
  const handleSubmit = async () => {
    if (!name) {
      alert('请输入名称！');
      return;
    }
    if (!imgUrl && !videoUrl) {
      alert('请选择文件！');
      return;
    }
    let type = 'image';
    if (videoUrl) {
      type = 'video';
    }
    const result = await createModel('scene_model',{
      name: name,
      description: "",
      model_urls: [
          {
              type: "thumbnail",
              url: imgUrl || videoImgUrl.current
          }
      ],
      category: type,
      tags: [],
      metadata: {
        video:videoUrl,
      }
  })
    // const result = await createThemes({
    //   name: name,
    //   thumbnail_url: imgUrl || videoUrl,
    //   tags:[],
    //   description: "",
    //   category:type,
    //   creator_id: "",
    //   creator_name: "",
    //   wallpaper_id:"", 
    //   extension_ids:[], 
    //   agent_prompt_id:"", 
    //   config_params:{
    //     videoImgUrl:videoImgUrl.current,
    //   }, 
    //   scene_model_id: "",
    //   digital_human_id: "",
    // });
    if (result && result.code === 0) {
      message.success('创建成功',result);
      
    }
    // // 这里可以处理提交逻辑，比如发送文件和名称到后端
    // console.log('提交的名称：', name);
    // console.log('选中的文件：', selectedFile);
    // alert(`已提交：名称=${name}，文件名=${selectedFile.name}`);
  };
  const handleDelete = () => {
    setImgUrl('');
    setVideoUrl('');
    videoImgUrl.current = '';
  }
  const onClose = () => {
    // console.log('关闭');
    window.close();
  }
  return (
    <div>
      <div className={styles.title}>创建场景</div>
      <div className={styles.close} onClick={onClose}>
        <Image className={styles.closeIcon1} width={24} src={closeIcon} alt="关闭" preview={false} fallback="❌"/>
      </div>
      <div>
        <div className={styles.label1}>场景名称</div>
        <Input
          className={styles.input1}
          type="text"
          value={name}
          onChange={handleNameChange}
          placeholder="请输入名称"
          spellCheck="false"
        />
      </div>

      {/* 2. 文件上传按钮（隐藏原生input，用普通按钮触发） */}
      <div className={styles.content2}>
        <div className={styles.upload} onClick={handleInput}>
          <Image className={styles.uploadIcon} src={uploadIcon} preview={false}/>
          <div className={styles.uploadText1}>上传图片或视频</div>
          <div className={styles.uploadText2}>图片：支持JPG/PNG格式</div>
          <div className={styles.uploadText3}>视频：支持最大 500MB 的 MP4格式视频</div>

        </div>
        {imgUrl && (<div className={styles.imgContent}>
          
          <Image src = {imgUrl} className={styles.img} preview={false} />
          <div className={styles.uploadIcon2} onClick={handleInput}>
          <Image src = {uploadIcon} className={styles.img} preview={false} />
          </div>
          <div className={styles.delIcon} onClick={handleDelete}>
          <Image src = {delIcon} className={styles.img} preview={false} />
          </div>
        </div>)}
        {videoUrl && (<div className={styles.imgContent}>
          
          <video src = {videoUrl} className={styles.img}/>
          <div className={styles.uploadIcon2} onClick={handleInput}>
          <Image src = {uploadIcon} className={styles.img} preview={false} />
          </div>
          <div className={styles.delIcon} onClick={handleDelete}>
          <Image src = {delIcon} className={styles.img} preview={false} />
          </div>
        </div>)}
        
      </div>

      {/* 3. 确定按钮 */}
      <div className={styles.submit} onClick={handleSubmit}>确认创建</div>
      <Loading
        visible={isLoading}
        progress={progress}
        message={loadingMessage}
        closable={false}
        delay={delay}

      />
    </div>
  );
};

export default SimpleUploadComponent;
