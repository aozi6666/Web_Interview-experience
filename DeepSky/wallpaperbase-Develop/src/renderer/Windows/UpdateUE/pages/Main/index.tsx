import closeIcon from '$assets/updateue/close.png';
import downloadIcon from '$assets/updateue/download.png';
import menuIcon from '$assets/updateue/menu.png';
import minimizeIcon from '$assets/updateue/mini.png';
import speedIcon from '$assets/updateue/speed.png';
import stopIcon from '$assets/updateue/stop.png';
import timeIcon from '$assets/updateue/time.png';
import { getIpcEvents } from '@renderer/ipc-events';
import { IPCChannels } from '@shared/channels';
import { IpcTarget } from '@shared/ipc-events';
import type { MenuProps } from 'antd';
import {
  Button,
  Dropdown,
  Input,
  Modal,
  Progress,
  Radio,
  Spin,
  Tag,
} from 'antd';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useStyles } from './styles';

const ipcEvents = getIpcEvents();

// 格式化文件大小（始终显示两位小数）
const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const value = bytes / k ** i;
  // 始终显示两位小数
  return `${value.toFixed(2)} ${sizes[i]}`;
};

// 格式化下载速度（始终显示两位小数）
const formatDownloadSpeed = (bytesPerSecond: number): string => {
  if (bytesPerSecond === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytesPerSecond) / Math.log(k));
  const value = bytesPerSecond / k ** i;
  // 始终显示两位小数
  return `${value.toFixed(2)} ${sizes[i]}`;
};

// 格式化限速显示
const formatSpeedLimit = (speedLimitKb: number): string => {
  if (speedLimitKb === 0) {
    return '不限速';
  }
  if (speedLimitKb >= 1024) {
    return `${(speedLimitKb / 1024).toFixed(2)} MB/s`;
  }
  return `${speedLimitKb} KB/s`;
};

// 格式化预估剩余时间
const formatEstimatedTime = (
  downloadedBytes: number,
  totalBytes: number,
  downloadSpeed: number,
): string | null => {
  // 如果下载速度太小（小于1KB/s），无法准确计算
  if (downloadSpeed < 1024) {
    return null;
  }

  const remainingBytes = totalBytes - downloadedBytes;
  if (remainingBytes <= 0) {
    return null;
  }

  const remainingSeconds = Math.ceil(remainingBytes / downloadSpeed);

  const hours = Math.floor(remainingSeconds / 3600);
  const minutes = Math.floor((remainingSeconds % 3600) / 60);
  const seconds = remainingSeconds % 60;

  if (hours > 0) {
    return `${hours}小时${minutes}分钟`;
  }
  if (minutes > 0) {
    return `${minutes}分钟`;
  }
  return `${seconds}秒`;
};

// 获取进度条状态
const getProgressStatus = (
  status:
    | 'downloading'
    | 'paused'
    | 'extracting'
    | 'completed'
    | 'network-error'
    | 'idle',
): 'success' | 'exception' | 'active' => {
  if (status === 'completed') return 'success';
  if (status === 'paused') return 'exception';
  if (status === 'network-error') return 'exception';
  if (status === 'idle') return 'active';
  return 'active';
};

const Main = () => {
  const { styles } = useStyles();
  const [progress, setProgress] = useState<number>(0);
  const [status, setStatus] = useState<
    | 'downloading'
    | 'paused'
    | 'extracting'
    | 'completed'
    | 'network-error'
    | 'idle'
  >('idle');
  const [downloadedBytes, setDownloadedBytes] = useState<number>(0);
  const [totalBytes, setTotalBytes] = useState<number>(0);
  const [downloadSpeed, setDownloadSpeed] = useState<number>(0);
  const [fileSize, setFileSize] = useState<number | null>(null);
  // hasExistingProgress 不再需要，aria2 会自动断点续传
  const [dropdownOpen, setDropdownOpen] = useState<boolean>(false);
  const [networkCheckVisible, setNetworkCheckVisible] =
    useState<boolean>(false);
  const [networkCheckLoading, setNetworkCheckLoading] =
    useState<boolean>(false);
  const [networkCheckResult, setNetworkCheckResult] = useState<any>(null);
  const [speedLimitKb, setSpeedLimitKb] = useState<number>(0); // 限速值（KB/s），默认0 = 不限速
  const [speedLimitInputVisible, setSpeedLimitInputVisible] =
    useState<boolean>(false);
  const [speedLimitInputValue, setSpeedLimitInputValue] = useState<string>('0'); // 输入值（字符串）
  const [speedLimitUnit, setSpeedLimitUnit] = useState<'KB' | 'MB'>('KB'); // 单位选择
  const prevStatusRef = useRef<
    | 'downloading'
    | 'paused'
    | 'extracting'
    | 'completed'
    | 'network-error'
    | 'idle'
  >('idle');
  const progressContainerRef = useRef<HTMLDivElement | null>(null);
  const progressInfoContainerRef = useRef<HTMLDivElement | null>(null);

  // 获取限速值
  useEffect(() => {
    const getSpeedLimit = async () => {
      try {
        const result = await ipcEvents.invokeTo(
          IpcTarget.MAIN,
          IPCChannels.GET_UE_DOWNLOAD_SPEED_LIMIT,
        );
        if (result.success && result.speedLimitKb !== undefined) {
          setSpeedLimitKb(result.speedLimitKb);
        }
      } catch (error) {
        console.error('获取限速值失败:', error);
      }
    };
    getSpeedLimit();
  }, []);

  // 通过主进程推送实时接收状态变化（替代轮询）
  useEffect(() => {
    // 处理推送的状态更新
    const handleStateUpdate = (state: any) => {
      if (!state) return;

      if (state.status) {
        prevStatusRef.current = state.status;
        setStatus(state.status);
      }
      if (typeof state.progress === 'number') {
        setProgress(state.progress);
      }
      if (typeof state.downloadedBytes === 'number') {
        setDownloadedBytes(state.downloadedBytes);
      }
      if (typeof state.totalBytes === 'number' && state.totalBytes > 0) {
        setTotalBytes(state.totalBytes);
      }
      if (typeof state.downloadSpeed === 'number') {
        setDownloadSpeed(state.downloadSpeed);
      }
    };

    // 1. 订阅主进程推送
    ipcEvents.on(
      IpcTarget.MAIN,
      IPCChannels.UE_DOWNLOAD_STATE_PUSH,
      handleStateUpdate,
    );
    const unsubscribe = () => {
      ipcEvents.off(
        IpcTarget.MAIN,
        IPCChannels.UE_DOWNLOAD_STATE_PUSH,
        handleStateUpdate,
      );
    };

    // 2. 获取初始状态（窗口刚打开时）
    ipcEvents
      .invoke(IPCChannels.UPDATE_UE_WINDOW_PARAMS)
      .then((params) => {
        if (params) {
          handleStateUpdate(params);
        }
        return params;
      })
      .catch((error) => {
        console.error('获取初始状态失败:', error);
      });

    return () => {
      unsubscribe();
    };
  }, []);

  // 添加全局样式确保下拉菜单项和 Modal 按钮可点击并显示指针
  useEffect(() => {
    const styleId = 'ue-global-style';
    // 如果样式已存在，直接返回，不创建新的
    if (document.getElementById(styleId)) {
      return;
    }
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      /* 下拉菜单项样式 */
      .ant-dropdown-menu-item {
        cursor: pointer !important;
        pointer-events: auto !important;
        user-select: none !important;
        -webkit-app-region: no-drag !important;
      }
      .ant-dropdown-menu-item:hover {
        cursor: pointer !important;
        background-color: rgba(255, 255, 255, 0.1) !important;
      }
      .ant-dropdown-menu-item-danger {
        color: #ff4d4f !important;
      }
      .ant-dropdown-menu-item-danger:hover {
        cursor: pointer !important;
        background-color: rgba(255, 77, 79, 0.1) !important;
        color: #ff7875 !important;
      }

      /* Modal 样式 - 确保可点击 */
      .ant-modal,
      .ant-modal-root,
      .ant-modal-wrap,
      .ant-modal-mask {
        -webkit-app-region: no-drag !important;
        pointer-events: auto !important;
      }

      .ant-modal-content {
        -webkit-app-region: no-drag !important;
        pointer-events: auto !important;
      }

      /* Modal 按钮样式 */
      .ant-modal .ant-btn,
      .ant-modal-footer .ant-btn {
        -webkit-app-region: no-drag !important;
        pointer-events: auto !important;
        cursor: pointer !important;
      }

      .ant-modal .ant-btn:hover,
      .ant-modal-footer .ant-btn:hover {
        cursor: pointer !important;
      }

      .ant-modal .ant-btn-primary,
      .ant-modal-footer .ant-btn-primary {
        -webkit-app-region: no-drag !important;
        pointer-events: auto !important;
        cursor: pointer !important;
      }

      .ant-modal .ant-btn-dangerous,
      .ant-modal-footer .ant-btn-dangerous {
        -webkit-app-region: no-drag !important;
        pointer-events: auto !important;
        cursor: pointer !important;
      }

      /* 左下角下拉按钮样式 - 确保可见且可点击 */
      [class*="topLeftDropdown"] {
        -webkit-app-region: no-drag !important;
        pointer-events: auto !important;
        z-index: 99999 !important;
        position: fixed !important;
        bottom: 0px !important;
        left: 0px !important;
        display: flex !important;
        visibility: visible !important;
        opacity: 1 !important;
        width: 36px !important;
        height: 36px !important;
      }

      [class*="dropdownButtonTopLeft"] {
        -webkit-app-region: no-drag !important;
        pointer-events: auto !important;
        cursor: pointer !important;
        opacity: 1 !important;
        visibility: visible !important;
        display: flex !important;
        z-index: 10001 !important;
        position: relative !important;
      }
    `;
    document.head.appendChild(style);
    return () => {
      const existingStyle = document.getElementById(styleId);
      if (existingStyle) {
        document.head.removeChild(existingStyle);
      }
    };
  }, []);

  const handleClose = async () => {
    // 用户主动点击关闭按钮，无论下载是否完成都退出应用
    // 因为在下载器窗口阶段，托盘是隐藏的，用户无法通过托盘回到应用
    console.log('用户点击关闭按钮，退出应用');
    try {
      await ipcEvents.invokeTo(
        IpcTarget.MAIN,
        IPCChannels.USER_REQUEST_QUIT_APP,
      );
    } catch (error) {
      console.error('发送退出应用请求失败:', error);
      window.close();
    }
  };

  const handleMinimize = () => {
    ipcEvents.emitTo(IpcTarget.MAIN, IPCChannels.WINDOW_MINIMIZE);
  };

  // 初始化时获取文件大小
  useEffect(() => {
    const init = async () => {
      try {
        const sizeResult = await ipcEvents.invokeTo(
          IpcTarget.MAIN,
          IPCChannels.GET_UE_FILE_SIZE,
        );
        if (sizeResult.success && sizeResult.size) {
          setFileSize(sizeResult.size);
        }
      } catch (error) {
        console.error('获取文件大小失败:', error);
      }
    };
    init();
  }, []);

  const handleDownloadClick = async () => {
    try {
      if (status === 'idle' || status === 'network-error') {
        // 新下载 / 网络恢复后重新下载
        setStatus('downloading');
        ipcEvents
          .invoke(IPCChannels.DOWNLOAD_UE)
          .then((result) => {
            if (!result.success) {
              setStatus('idle');
              console.error('下载失败:', result.error);
            }
            return result;
          })
          .catch((error) => {
            console.error('下载失败:', error);
            setStatus('idle');
            throw error;
          });
      } else if (status === 'paused') {
        // 恢复下载（RPC unpause 或重新启动，aria2 自动断点续传）
        setStatus('downloading');
        ipcEvents
          .invoke(IPCChannels.RESUME_UE_DOWNLOAD)
          .then((result) => {
            if (!result.success) {
              setStatus('paused');
              console.error('继续下载失败:', result.error);
            }
            return result;
          })
          .catch((error) => {
            console.error('继续下载失败:', error);
            setStatus('paused');
            throw error;
          });
      } else if (status === 'downloading') {
        // 暂停下载
        const result = await ipcEvents.invokeTo(
          IpcTarget.MAIN,
          IPCChannels.PAUSE_UE_DOWNLOAD,
        );
        if (result.success) {
          setStatus('paused');
        }
      }
    } catch (error) {
      console.error('下载操作失败:', error);
    }
  };

  const handleCancelAndCleanup = useCallback(() => {
    Modal.confirm({
      title: '确认停止并卸载',
      content: '确定要停止下载并删除所有已下载的文件吗？此操作不可恢复。',
      okText: '确定',
      cancelText: '取消',
      okType: 'danger',
      onOk: async () => {
        try {
          const result = await ipcEvents.invokeTo(
            IpcTarget.MAIN,
            IPCChannels.CANCEL_UE_DOWNLOAD_AND_CLEANUP,
          );
          if (result.success) {
            // 重置状态
            setProgress(0);
            setStatus('idle');
            setDownloadedBytes(0);
            setTotalBytes(0);
            setDownloadSpeed(0);
            // 状态已重置
          } else {
            console.error('停止并卸载失败:', result.error);
            Modal.error({
              title: '操作失败',
              content: result.error || '停止并卸载失败，请重试',
            });
          }
        } catch (error) {
          console.error('停止并卸载失败:', error);
          Modal.error({
            title: '操作失败',
            content: '停止并卸载失败，请重试',
          });
        }
      },
    });
  }, []);

  // 打开网络检测模态框
  const handleNetworkCheck = useCallback(() => {
    setDropdownOpen(false);
    setNetworkCheckVisible(true);
    setNetworkCheckResult(null);
    setNetworkCheckLoading(false);
  }, []);

  // 开始执行网络检测
  const startNetworkCheck = useCallback(async () => {
    setNetworkCheckLoading(true);
    setNetworkCheckResult(null);

    try {
      const result = await ipcEvents.invokeTo(
        IpcTarget.MAIN,
        IPCChannels.NETWORK_CHECK_ALL,
      );
      setNetworkCheckResult(result);
    } catch (error) {
      console.error('网络检测失败:', error);
      setNetworkCheckResult({
        gatewayDNS: { success: false, error: '检测失败' },
        port: { success: false, error: '检测失败' },
        hosts: { success: false, error: '检测失败' },
      });
    } finally {
      setNetworkCheckLoading(false);
    }
  }, []);

  // 打开限速设置
  const handleOpenSpeedLimit = useCallback(() => {
    // UI显示的是MB/s，所以始终使用MB单位
    setSpeedLimitUnit('MB');
    // 将当前KB值转换为MB显示值
    if (speedLimitKb === 0) {
      setSpeedLimitInputValue('0');
    } else {
      // 转换为MB（保留2位小数）
      const mbValue = speedLimitKb / 1024;
      setSpeedLimitInputValue(mbValue.toFixed(2));
    }
    setSpeedLimitInputVisible(true);
  }, [speedLimitKb]);

  // 确认限速设置
  const handleConfirmSpeedLimit = useCallback(async () => {
    // 解析输入值
    const inputNum = parseFloat(speedLimitInputValue);
    if (Number.isNaN(inputNum) || inputNum < 0) {
      console.error('限速值无效');
      return;
    }

    // 根据单位转换为KB
    let speedLimitInKb: number;
    if (speedLimitUnit === 'MB') {
      speedLimitInKb = Math.round(inputNum * 1024);
    } else {
      speedLimitInKb = Math.round(inputNum);
    }

    try {
      const result = await ipcEvents.invokeTo(
        IpcTarget.MAIN,
        IPCChannels.SET_UE_DOWNLOAD_SPEED_LIMIT,
        speedLimitInKb,
      );
      if (result.success) {
        setSpeedLimitKb(speedLimitInKb);
        setSpeedLimitInputVisible(false);
        setDropdownOpen(false);
        // 主进程会自动处理重启下载（如果正在下载）
      } else {
        console.error('设置限速失败:', result.error);
      }
    } catch (error) {
      console.error('设置限速失败:', error);
    }
  }, [speedLimitInputValue, speedLimitUnit]);

  // 取消限速设置
  const handleCancelSpeedLimit = useCallback(() => {
    setSpeedLimitInputVisible(false);
    // 取消时关闭菜单
    setDropdownOpen(false);
  }, []);

  // 取消限速限制（设置为0）
  const handleRemoveSpeedLimit = useCallback(async () => {
    try {
      const result = await ipcEvents.invokeTo(
        IpcTarget.MAIN,
        IPCChannels.SET_UE_DOWNLOAD_SPEED_LIMIT,
        0, // 0表示不限速
      );
      if (result.success) {
        setSpeedLimitKb(0);
        setSpeedLimitInputVisible(false);
        setSpeedLimitInputValue('0');
        // 取消限速时关闭菜单
        setDropdownOpen(false);
      } else {
        console.error('取消限速失败:', result.error);
      }
    } catch (error) {
      console.error('取消限速失败:', error);
    }
  }, []);

  // 下拉菜单项
  const menuItems: MenuProps['items'] = [
    // {
    //   key: 'network-check',
    //   label: (
    //     <div
    //       style={{
    //         padding: '8px 0',
    //         color: 'rgba(255, 255, 255, 0.85)',
    //         fontSize: '14px',
    //         cursor: 'pointer',
    //       }}
    //       onClick={handleNetworkCheck}
    //     >
    //       网络检测
    //     </div>
    //   ),
    // },
    // {
    //   type: 'divider',
    // },
    {
      key: 'speed-limit',
      label: (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            padding: '8px 0',
            minWidth: '280px',
          }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div
            style={{
              fontSize: '14px',
              color: 'rgba(255, 255, 255, 0.85)',
              fontWeight: 500,
              marginBottom: '4px',
            }}
          >
            下载速度
          </div>
          {speedLimitInputVisible ? (
            <div
              style={{
                backgroundColor: 'rgba(23, 25, 24, 1)',
                borderRadius: '4px',
                padding: '12px',
              }}
            >
              <Radio.Group
                value={
                  speedLimitInputValue && parseFloat(speedLimitInputValue) > 0
                    ? 'limit'
                    : 'no-limit'
                }
                onChange={(e) => {
                  if (e.target.value === 'no-limit') {
                    handleRemoveSpeedLimit();
                  } else {
                    // 选择"限制"时，确保单位是MB（因为UI显示的是MB/s）
                    setSpeedLimitUnit('MB');
                    // 保持当前状态，显示输入框
                    if (
                      !speedLimitInputValue ||
                      parseFloat(speedLimitInputValue) === 0
                    ) {
                      setSpeedLimitInputValue('1.0');
                    }
                  }
                }}
                style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}
              >
                <Radio
                  value="no-limit"
                  style={{ color: 'rgba(255, 255, 255, 0.85)' }}
                >
                  不限制
                </Radio>
                <Radio
                  value="limit"
                  style={{ color: 'rgba(255, 255, 255, 0.85)' }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}
                  >
                    <span>限制</span>
                    <Input
                      value={speedLimitInputValue}
                      onChange={(e) => {
                        const { value } = e.target;
                        // 只允许数字和小数点
                        if (value === '' || /^\d*\.?\d*$/.test(value)) {
                          setSpeedLimitInputValue(value);
                        }
                      }}
                      onPressEnter={handleConfirmSpeedLimit}
                      style={{
                        width: '45px',
                        height: '24px',
                        fontSize: '12px',
                        padding: '2px 6px',
                        backgroundColor: 'rgba(255, 255, 255, 1)',
                        color: 'rgba(0, 0, 0, 0.85)',
                      }}
                      placeholder="1.0"
                      autoFocus
                      onMouseDown={(e) => e.stopPropagation()}
                      onFocus={(e) => e.stopPropagation()}
                    />
                    <span
                      style={{
                        color: 'rgba(255, 255, 255, 0.65)',
                        fontSize: '12px',
                      }}
                    >
                      MB/s (1-100)
                    </span>
                  </div>
                </Radio>
              </Radio.Group>
              <div
                style={{
                  display: 'flex',
                  gap: '8px',
                  justifyContent: 'flex-end',
                  marginTop: '8px',
                }}
              >
                <Button size="small" onClick={handleCancelSpeedLimit}>
                  取消
                </Button>
                <Button
                  type="primary"
                  size="small"
                  onClick={handleConfirmSpeedLimit}
                >
                  确认
                </Button>
              </div>
            </div>
          ) : (
            <div
              style={{
                backgroundColor: 'rgba(23, 25, 24, 1)',
                borderRadius: '4px',
                padding: '12px',
              }}
            >
              <Radio.Group
                value={speedLimitKb === 0 ? 'no-limit' : 'limit'}
                onChange={(e) => {
                  if (e.target.value === 'no-limit') {
                    handleRemoveSpeedLimit();
                  } else {
                    // 点击"限制"时，确保单位是MB（因为UI显示的是MB/s）
                    setSpeedLimitUnit('MB');
                    // 显示输入界面并保持菜单打开
                    handleOpenSpeedLimit();
                    setTimeout(() => {
                      setDropdownOpen(true);
                    }, 0);
                  }
                }}
                style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}
                onClick={(e) => {
                  // 阻止事件冒泡，防止触发菜单项的 onClick
                  e.stopPropagation();
                }}
              >
                <Radio
                  value="no-limit"
                  style={{ color: 'rgba(255, 255, 255, 0.85)' }}
                >
                  不限制
                </Radio>
                <Radio
                  value="limit"
                  style={{ color: 'rgba(255, 255, 255, 0.85)' }}
                >
                  限制
                </Radio>
              </Radio.Group>
            </div>
          )}
        </div>
      ),
      onClick: (e) => {
        e.domEvent.stopPropagation();
        e.domEvent.preventDefault();
        // 如果点击时输入框还未显示，显示输入框并保持菜单打开
        if (!speedLimitInputVisible) {
          // 确保单位是MB（因为UI显示的是MB/s）
          setSpeedLimitUnit('MB');
          handleOpenSpeedLimit();
          setTimeout(() => {
            setDropdownOpen(true);
          }, 0);
        }
        // 返回 false 阻止菜单关闭（Ant Design 5.x）
        return false;
      },
    },
    {
      type: 'divider',
    },
    {
      key: 'cancel',
      label: (
        <div
          className={styles.cancelMenuItem}
          style={{
            padding: '8px 0',
            color: 'rgba(255, 255, 255, 0.85)',
            fontSize: '14px',
            cursor: 'pointer',
          }}
          onClick={() => {
            setDropdownOpen(false);
            handleCancelAndCleanup();
          }}
        >
          清理下载缓存
        </div>
      ),
    },
  ];

  // 合并后的页面
  return (
    <div className={styles.mainContainer}>
      <div className={styles.headerContainer}>
        <div className={styles.titleContainer}>
          <div className={styles.titleBar} />
          <h1 className={styles.title}>3D资源下载</h1>
        </div>
        <div className={styles.headerButtons}>
          <div className={styles.minimizeButton} onClick={handleMinimize}>
            <img src={minimizeIcon} alt="最小化" className={styles.iconImage} />
          </div>
          <div className={styles.closeButton} onClick={handleClose}>
            <img src={closeIcon} alt="关闭" className={styles.iconImage} />
          </div>
        </div>
      </div>
      <div className={styles.content}>
        {status === 'idle' && fileSize && (
          <div className={styles.fileSizeInfoContainer}>
            <div className={styles.fileSizeText}>
              <div className={styles.fileSizeTitle}>
                你还未下载3D动态资源,请先下载3D动态资源
              </div>
              <div className={styles.fileSizeValue}>
                文件总大小为: {formatFileSize(fileSize)}
              </div>
            </div>
          </div>
        )}
        {(status === 'downloading' ||
          status === 'paused' ||
          status === 'extracting' ||
          status === 'completed' ||
          status === 'network-error') && (
          <div
            ref={progressInfoContainerRef}
            className={styles.progressInfoContainer}
          >
            <div className={styles.progressInfo}>
              <div className={styles.progressText}>
                <span className={styles.progressPercent}>
                  {`${Math.round(
                    status === 'extracting' || status === 'completed'
                      ? progress
                      : Math.min(99, progress),
                  )}%`}
                </span>
                {status === 'completed' ? (
                  <span className={styles.progressSize}>✅ 解压完成！</span>
                ) : status === 'extracting' ? (
                  <span className={styles.progressSize}>解压中...</span>
                ) : status === 'network-error' ? (
                  <span className={styles.progressSize}>
                    ({formatFileSize(downloadedBytes)}/
                    {formatFileSize(totalBytes || fileSize || 0)}) -
                    网络错误，等待恢复...
                  </span>
                ) : (
                  <span className={styles.progressSize}>
                    ({formatFileSize(downloadedBytes)}/
                    {formatFileSize(totalBytes || fileSize || 0)})
                  </span>
                )}
              </div>
              {status === 'downloading' && (
                <>
                  {downloadSpeed > 0 ? (
                    <div className={styles.speedInfo}>
                      <img
                        src={speedIcon}
                        alt="速度"
                        className={styles.iconImage}
                      />{' '}
                      <span>{formatDownloadSpeed(downloadSpeed)}/S</span>
                      {formatEstimatedTime(
                        downloadedBytes,
                        totalBytes,
                        downloadSpeed,
                      ) && (
                        <>
                          <span className={styles.separator}>|</span>
                          <span className={styles.timeInfo}>
                            <img
                              src={timeIcon}
                              alt="时间"
                              className={styles.iconImage}
                            />
                            {formatEstimatedTime(
                              downloadedBytes,
                              totalBytes,
                              downloadSpeed,
                            )}
                          </span>
                        </>
                      )}
                    </div>
                  ) : (
                    <div className={styles.speedInfo}>
                      <span className={styles.waitingText}>
                        正在等待下载开始，请稍候
                      </span>
                    </div>
                  )}
                </>
              )}
            </div>
            <div
              ref={progressContainerRef}
              className={styles.progressContainer}
            >
              <Progress
                percent={
                  status === 'extracting' || status === 'completed'
                    ? progress
                    : Math.min(99, progress)
                }
                status={getProgressStatus(status)}
                strokeColor="rgba(25, 200, 200, 1)"
                railColor="rgba(55, 59, 57, 1)"
                className={styles.progressBar}
                showInfo={false}
                size={{ height: 16 }}
              />
            </div>
          </div>
        )}
        {(status === 'idle' ||
          status === 'downloading' ||
          status === 'paused' ||
          status === 'network-error') && (
          <div className={styles.buttonContainer}>
            {/* 下拉选项按钮 */}
            {(status === 'downloading' ||
              status === 'paused' ||
              status === 'network-error') && (
              <Dropdown
                menu={{
                  items: menuItems,
                  onClick: (info) => {
                    // 如果点击的是限速设置项，阻止菜单关闭
                    if (info.key === 'speed-limit' && !speedLimitInputVisible) {
                      // 阻止默认的关闭行为
                    }
                  },
                }}
                placement="topLeft"
                trigger={['click']}
                open={dropdownOpen}
                onOpenChange={(open) => {
                  // 如果限速输入框可见，保持菜单打开
                  if (speedLimitInputVisible && !open) {
                    return;
                  }
                  setDropdownOpen(open);
                }}
                classNames={{ root: styles.dropdownMenu }}
                getPopupContainer={(triggerNode) =>
                  triggerNode.parentElement || document.body
                }
              >
                <Button
                  type="text"
                  icon={
                    <img
                      src={menuIcon}
                      alt="菜单"
                      className={styles.dropdownButtonIcon}
                    />
                  }
                  className={styles.dropdownButtonTopLeft}
                />
              </Dropdown>
            )}
            <Button
              type="default"
              size="large"
              icon={
                <img
                  src={status === 'downloading' ? stopIcon : downloadIcon}
                  alt={status === 'downloading' ? '暂停' : '下载'}
                  className={styles.buttonIcon}
                />
              }
              onClick={handleDownloadClick}
              className={styles.downloadButton}
            >
              {status === 'downloading'
                ? '暂停下载'
                : status === 'network-error'
                  ? '重新下载'
                  : '下载资源'}
            </Button>
          </div>
        )}
        {status === 'completed' && (
          <div className={styles.buttonContainer}>
            <Button
              type="primary"
              size="large"
              onClick={async () => {
                console.log('🔄 用户点击重启按钮');
                try {
                  const result = await ipcEvents.invokeTo(
                    IpcTarget.MAIN,
                    IPCChannels.RESTART_APP,
                  );
                  if (!result.success) {
                    console.error('重启失败:', result.error);
                  }
                } catch (error) {
                  console.error('调用重启失败:', error);
                }
              }}
              className={styles.downloadButton}
              style={{
                backgroundColor: 'rgba(25, 200, 200, 1)',
                borderColor: 'rgba(25, 200, 200, 1)',
              }}
            >
              点击重启应用
            </Button>
          </div>
        )}
      </div>

      {/* 网络检测模态框 */}
      <Modal
        title="网络检测"
        open={networkCheckVisible}
        onCancel={() => {
          setNetworkCheckVisible(false);
          setNetworkCheckResult(null);
        }}
        footer={[
          <Button
            key="check"
            type="primary"
            onClick={startNetworkCheck}
            loading={networkCheckLoading}
            disabled={networkCheckLoading}
          >
            {networkCheckResult ? '重新检测' : '开始检测'}
          </Button>,
          <Button
            key="close"
            onClick={() => {
              setNetworkCheckVisible(false);
              setNetworkCheckResult(null);
            }}
          >
            关闭
          </Button>,
        ]}
        width={600}
        styles={{
          body: { maxHeight: '70vh', overflowY: 'auto' },
        }}
      >
        <Spin spinning={networkCheckLoading}>
          {!networkCheckResult && !networkCheckLoading && (
            <div
              style={{
                textAlign: 'center',
                padding: '40px 20px',
                color: 'rgba(255, 255, 255, 0.7)',
              }}
            >
              <p style={{ fontSize: 16, marginBottom: 8 }}>
                点击&ldquo;开始检测&rdquo;按钮进行网络检测
              </p>
              <p style={{ fontSize: 14 }}>
                将检测网关、DNS、端口和hosts文件状态
              </p>
            </div>
          )}
          {networkCheckResult && (
            <div>
              {/* 网关和DNS检测 */}
              <div style={{ marginBottom: 24 }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 12,
                  }}
                >
                  <h3 style={{ margin: 0 }}>网关和DNS检测</h3>
                  <Tag
                    color={
                      networkCheckResult.gatewayDNS?.success
                        ? 'success'
                        : 'error'
                    }
                  >
                    {networkCheckResult.gatewayDNS?.success ? '正常' : '异常'}
                  </Tag>
                </div>
                {networkCheckResult.gatewayDNS?.ip && (
                  <p style={{ margin: '4px 0' }}>
                    IP设置: {networkCheckResult.gatewayDNS.ip}
                  </p>
                )}
                {networkCheckResult.gatewayDNS?.gateway && (
                  <p style={{ margin: '4px 0' }}>
                    网关设置: {networkCheckResult.gatewayDNS.gateway}
                  </p>
                )}
                {networkCheckResult.gatewayDNS?.dns &&
                  networkCheckResult.gatewayDNS.dns.length > 0 && (
                    <div style={{ marginTop: 8 }}>
                      <p style={{ margin: '4px 0' }}>域名解析(DNS)设置:</p>
                      {networkCheckResult.gatewayDNS.dns.map(
                        (dns: string, index: number) => (
                          <p
                            key={`dns-${dns}-${index}`}
                            style={{ margin: '4px 0', paddingLeft: 16 }}
                          >
                            {dns}
                            {networkCheckResult.gatewayDNS?.dnsLocation?.[
                              index
                            ] &&
                              ` ${networkCheckResult.gatewayDNS.dnsLocation[index]}`}
                          </p>
                        ),
                      )}
                    </div>
                  )}
                {networkCheckResult.gatewayDNS?.error && (
                  <p
                    style={{
                      margin: '8px 0 0 0',
                      color: '#ff4d4f',
                      fontSize: 12,
                    }}
                  >
                    检测到你的DNS设置存在问题,请联系运营商或检查DNS设置,详细操作请参考
                    <Button
                      type="link"
                      onClick={() => {
                        // 这里可以打开DNS设置指引
                      }}
                      style={{ padding: 0, height: 'auto', marginLeft: 4 }}
                    >
                      《DNS设置异常指引》
                    </Button>
                  </p>
                )}
              </div>

              {/* 端口检测 */}
              <div style={{ marginBottom: 24 }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 12,
                  }}
                >
                  <h3 style={{ margin: 0 }}>端口检测</h3>
                  <Tag
                    color={
                      networkCheckResult.port?.success ? 'success' : 'error'
                    }
                  >
                    {networkCheckResult.port?.success ? '正常' : '异常'}
                  </Tag>
                </div>
                <p style={{ margin: '4px 0' }}>
                  {networkCheckResult.port?.message || '检测端口是否正常连通'}
                </p>
                {networkCheckResult.port?.error && (
                  <p
                    style={{ margin: '4px 0', color: '#ff4d4f', fontSize: 12 }}
                  >
                    {networkCheckResult.port.error}
                  </p>
                )}
              </div>

              {/* hosts文件检测 */}
              <div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 12,
                  }}
                >
                  <h3 style={{ margin: 0 }}>hosts文件检测</h3>
                  <Tag
                    color={
                      networkCheckResult.hosts?.success ? 'success' : 'error'
                    }
                  >
                    {networkCheckResult.hosts?.success ? '正常' : '异常'}
                  </Tag>
                </div>
                <p style={{ margin: '4px 0' }}>
                  {networkCheckResult.hosts?.message || 'hosts文件正常'}
                </p>
                {networkCheckResult.hosts?.error && (
                  <p
                    style={{ margin: '4px 0', color: '#ff4d4f', fontSize: 12 }}
                  >
                    {networkCheckResult.hosts.error}
                  </p>
                )}
              </div>
            </div>
          )}
        </Spin>
      </Modal>
    </div>
  );
};

export default Main;
