import { createThemes, getThemesInfo } from '@api';
import { Button, message } from 'antd';
import classNames from 'classnames';
import { useCallback, useEffect, useRef, useState } from 'react';
import previewIcon from '../../../../assets/icons/Cteation/eye.png';
import refreshIcon from '../../../../assets/icons/Cteation/refresh.png';
import releaseIcon from '../../../../assets/icons/Cteation/release.png';
import { IPCChannels } from '@shared/channels';
import './index.css';
import { useStyles } from './styles';

import CharacterComponent from './pages/Character';
import LightComponent from './pages/Light';
import MusicComponent from './pages/Music';
import SceneComponent from './pages/Scene';
import { getIpcEvents } from '@renderer/ipc-events';
import { IpcTarget } from '@shared/ipc-events';

const ipcEvents = getIpcEvents();


// AlertDialog配置接口
interface AlertDialogConfig {
  message: string;
  confirmText?: string;
  cancelText?: string;
  title?: string;
}

const showAlertDialog = async (
  config: AlertDialogConfig,
): Promise<'confirm' | 'cancel'> => {
  try {
    const result = await ipcEvents.invokeTo(IpcTarget.MAIN, 
      IPCChannels.CREATE_ALERT_DIALOG,
      config,
    );
    return result;
  } catch (error) {
    message.error('显示提示窗口失败');
    throw error;
  }
};

function App() {
  const { styles } = useStyles();
  const cx = classNames;
  const themesInfoRef = useRef<any>({});
  const [sceneId,setSceneId] = useState<string>("");
  const [digitalId,setDigitalId] = useState<string>("");
  const [musicId,setMusicId] = useState<string>("");
  const [lightData,setLightData] = useState<any>([]);
  const [selectedType, setSelectedType] = useState<
    'wallpaper' | 'character' | 'scene' | 'music' | 'light' | ''
  >('scene'); // 默认显示场景类型
  useEffect(() => {
      const initialize = async () => {
        try {
          const _id = localStorage.getItem('creationId');
          console.log("creationId",_id)
          if (_id){
            const result = await getThemesInfo(_id);
            themesInfoRef.current = result.data;
            setData();

            console.log(themesInfoRef.current)
          }
          
        } catch {
          message.error('初始化失败，请重试');
        }
      };
      initialize();
    }, []);
  const setData = useCallback(async () => {
    // setSceneId(themesInfoRef.current.)
    // setDigitalId()
    if (themesInfoRef.current.config_params){
      const config = themesInfoRef.current.config_params;
      if (config.music_id){
        setMusicId(config.music_id);
      }
      if (config.light_data){
        setLightData(config.light_data);
      }
    }
  },[themesInfoRef.current])
  const handlePublish = useCallback(async () => {
    // message.info('发布功能开发中...');
    const result = await createThemes({
      name: themesInfoRef.current.name,
      description: themesInfoRef.current.description,
      thumbnail_url: themesInfoRef.current.thumbnail_url,
      category: themesInfoRef.current.category,
      tags:themesInfoRef.current.tags,
      creator_id: themesInfoRef.current.creator_id,
      extension_ids: themesInfoRef.current.extension_ids,
      agent_prompt_id: themesInfoRef.current.agent_prompt_detail.id,
      creator_name: "",
      scene_model_id:sceneId,
      digital_human_id:"",
      config_params:{
        music_id:musicId,
        light_data:lightData,
      },
      wallpaper_id:themesInfoRef.current.wallpaper_detail.id,
      status: "draft",
      
    })
    if (result.code == 0){
      message.info("发布成功")
    }
    console.log(result);
  }, []);

  const handlePreview = useCallback(async () => {
    message.info('预览功能开发中...');
  }, []);

  const handleReset = useCallback(async () => {
    // message.info('重置功能开发中...');
    setData();
  }, []);

  const handleClose = useCallback(async () => {
    try {
      // 显示确认对话框
      const result = await showAlertDialog({
        message: '确关闭后，将不会发布此壁纸',
        title: '提示',
        confirmText: '确定',
        cancelText: '取消',
      });

      // 根据用户选择执行相应操作
      if (result === 'confirm') {
        await ipcEvents.invokeTo(IpcTarget.MAIN, IPCChannels.CLOSE_CREATION_CENTER_WINDOW);
        await ipcEvents.invokeTo(IpcTarget.MAIN, IPCChannels.SHOW_MAIN_WINDOW);
      }
    } catch {
      message.error('关闭失败');
    }
  }, []);
  const onSelectScene = useCallback(async (id:string) => {
    console.log('id',id)
    setSceneId(id);
  }, []);
  const onSelectCharacter = useCallback(async (id:string) => {
    console.log('id',id)
    // digital_human_id.current = id;
    setDigitalId(id)
  }, []);
  const onSetLight = useCallback(async (data:any) => {
    console.log('data',data)
    // light_data.current = data;
    setLightData(data)
  },[]);
  const onSelectMusic = useCallback(async (id:string) => {
    console.log('id',id)
    // music_id.current = id;
    setMusicId(id)
  },[]);
  return (
    <div className={styles.container}>
      {/* 窗口标题栏 */}
      <div className={styles.header}>
        {/* 左侧操作按钮 */}
        <div className={styles.headerLeft}>
          <Button
            type="text"
            className={cx(styles.actionButton, styles.releaseButton)}
            onClick={handlePublish}
            title="发布"
          >
            <div className={styles.actionButtonContent}>
              <img src={releaseIcon} className={styles.actionIcon} alt="发布" />
              <span className={styles.actionButtonContentText}> 发布</span>
            </div>
          </Button>

          <Button
            type="text"
            className={styles.actionButton}
            onClick={handlePreview}
            title="预览"
          >
            <div className={styles.actionButtonContent}>
              <img src={previewIcon} className={styles.actionIcon} alt="预览" />
              <span className={styles.actionButtonContentText}> 预览</span>
            </div>
          </Button>

          <Button
            type="text"
            className={styles.actionButton}
            onClick={handleReset}
            title="重置"
          >
            <div className={styles.actionButtonContent}>
              <img src={refreshIcon} className={styles.actionIcon} alt="重置" />
              <span className={styles.actionButtonContentText}> 重置</span>
            </div>
          </Button>
        </div>

        {/* 右侧窗口控制 */}
        <div className={styles.headerRight}>
          <Button
            type="text"
            className={cx(styles.windowControl, styles.closeButton)}
            onClick={handleClose}
            title="关闭"
          >
            ✕
          </Button>
        </div>
      </div>

      {/* 内容区域 */}
      <div className={styles.content}>
        {/* 类型选择 */}

        <div className="typeSelector">
          <div className="typeButtons">
            <button
              type="button"
              className={`typeButton ${selectedType === 'scene' ? 'active' : ''}`}
              onClick={() => setSelectedType('scene')}
            >
              场景
            </button>
            <button
              type="button"
              className={`typeButton ${selectedType === 'character' ? 'active' : ''}`}
              onClick={() => setSelectedType('character')}
            >
              角色
            </button>
            <button
              type="button"
              className={`typeButton ${selectedType === 'light' ? 'active' : ''}`}
              onClick={() => setSelectedType('light')}
            >
              灯光
            </button>
            <button
              type="button"
              className={`typeButton ${selectedType === 'music' ? 'active' : ''}`}
              onClick={() => setSelectedType('music')}
            >
              音乐
            </button>
          </div>
        </div>

        {(selectedType === '' || selectedType === 'scene') && (
          <SceneComponent  selectedFile = {sceneId} onSelectScene={onSelectScene}/>
        )}
        {selectedType === 'character' && <CharacterComponent selectId = {digitalId} onSelectCharacter={onSelectCharacter}/>}
        {selectedType === 'light' && <LightComponent lightDatas = {lightData} onSetLight={onSetLight}/>}
        {/* {selectedType === 'wallpaper' && <Wallpaper />} */}
        {selectedType === 'music' && <MusicComponent musicId = {musicId} onSelectMusic={onSelectMusic}/>}
      </div>
    </div>
  );
}
export default App;
