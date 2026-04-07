import {
  CheckCircleOutlined,
  CloudDownloadOutlined,
  LoadingOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import { Button, Modal, Space, Tag, Typography } from 'antd';
import { createStyles } from 'antd-style';

const { Text, Title } = Typography;

export interface UpdateModalProps {
  open: boolean;
  currentVersion: string;
  latestVersion: string;
  releaseNotes?: string;
  /** 是否强制更新 */
  forceUpdate?: boolean;
  /** 是否正在安装 */
  installing?: boolean;
  /** 点击"立即安装" */
  onUpdate: () => void;
  /** 点击"稍后更新"（非强制时可用） */
  onCancel?: () => void;
}

const useStyles = createStyles(() => ({
  modalBody: {
    padding: '8px 0',
  },
  versionRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    margin: '20px 0',
  },
  versionBox: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 4,
  },
  arrow: {
    fontSize: 20,
    color: '#999',
  },
  releaseNotes: {
    maxHeight: 150,
    overflow: 'auto',
    padding: '12px 16px',
    background: 'rgba(0, 0, 0, 0.02)',
    borderRadius: 8,
    border: '1px solid rgba(0, 0, 0, 0.06)',
    marginTop: 12,
    whiteSpace: 'pre-wrap',
    fontSize: 13,
    lineHeight: 1.6,
  },
  statusIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  statusCenter: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '12px 0',
  },
}));

export default function UpdateModal({
  open,
  currentVersion,
  latestVersion,
  releaseNotes,
  forceUpdate = false,
  installing = false,
  onUpdate,
  onCancel,
}: UpdateModalProps) {
  const { styles } = useStyles();

  const renderTitle = () => {
    if (forceUpdate) {
      return (
        <Space>
          <WarningOutlined style={{ color: '#faad14' }} />
          <span>发现重要更新（需立即更新）</span>
        </Space>
      );
    }
    return (
      <Space>
        <CloudDownloadOutlined style={{ color: '#1677ff' }} />
        <span>发现新版本</span>
      </Space>
    );
  };

  const renderFooter = () => {
    if (installing) {
      return [
        <Button key="installing" type="primary" loading disabled>
          正在安装...
        </Button>,
      ];
    }

    return [
      ...(!forceUpdate
        ? [
            <Button key="later" onClick={onCancel}>
              稍后更新
            </Button>,
          ]
        : []),
      <Button key="install" type="primary" onClick={onUpdate}>
        立即安装
      </Button>,
    ];
  };

  const renderBody = () => {
    if (installing) {
      return (
        <div className={styles.statusCenter}>
          <LoadingOutlined
            className={styles.statusIcon}
            style={{ color: '#1677ff' }}
          />
          <Title level={5} style={{ margin: 0 }}>
            正在安装更新，请勿关闭应用...
          </Title>
        </div>
      );
    }

    return (
      <div className={styles.modalBody}>
        <div className={styles.versionRow}>
          <div className={styles.versionBox}>
            <Text type="secondary">当前版本</Text>
            <Tag color="default" style={{ fontSize: 14, padding: '2px 12px' }}>
              v{currentVersion}
            </Tag>
          </div>
          <span className={styles.arrow}>→</span>
          <div className={styles.versionBox}>
            <Text type="secondary">最新版本</Text>
            <Tag color="blue" style={{ fontSize: 14, padding: '2px 12px' }}>
              v{latestVersion}
            </Tag>
          </div>
        </div>

        {releaseNotes && (
          <div>
            <Text strong>更新日志：</Text>
            <div className={styles.releaseNotes}>{releaseNotes}</div>
          </div>
        )}

        <div className={styles.statusCenter}>
          <CheckCircleOutlined
            className={styles.statusIcon}
            style={{ color: '#52c41a' }}
          />
          <Text strong>安装包已下载完成，是否立即安装？</Text>
        </div>
      </div>
    );
  };

  return (
    <Modal
      title={renderTitle()}
      open={open}
      closable={!forceUpdate && !installing}
      maskClosable={!forceUpdate && !installing}
      keyboard={!forceUpdate && !installing}
      footer={renderFooter()}
      onCancel={onCancel}
      centered
      width={460}
      destroyOnHidden
    >
      {renderBody()}
    </Modal>
  );
}
