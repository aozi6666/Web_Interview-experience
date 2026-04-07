import hangupIcon from '$assets/icons/WallPaperInput/hangup.png';
import micCloseIcon from '$assets/icons/WallPaperInput/mic-close.png';
import micOpenIcon from '$assets/icons/WallPaperInput/mic-open.png';
import AudioWaveform from '@components/AudioWaveform';
import { Tooltip } from 'antd';
import { useCallControlsStyles } from './styles';

interface CallControlsProps {
  isMicEnabled: boolean;
  waveformSamples?: number[];
  onToggleMic: () => void;
  onHangUp: () => void;
}

export default function CallControls({
  isMicEnabled,
  waveformSamples,
  onToggleMic,
  onHangUp,
}: CallControlsProps) {
  const { styles } = useCallControlsStyles();
  return (
    <div className={styles.callControls}>
      <AudioWaveform isEnabled={isMicEnabled} samples={waveformSamples ?? []} />
      <div className={styles.rightButtons}>
        <div className={styles.callBtnArea}>
          <Tooltip
            title={isMicEnabled ? '关闭麦克风' : '开启麦克风'}
            color="#5b625f"
            styles={{
              container: {
                color: '#eceeed',
                borderRadius: '8px',
                padding: '4px 8px',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
              },
            }}
          >
            <button
              type="button"
              className={styles.callBtn}
              onClick={onToggleMic}
              aria-label={isMicEnabled ? '关闭麦克风' : '开启麦克风'}
            >
              <img
                src={isMicEnabled ? micOpenIcon : micCloseIcon}
                alt=""
                className={styles.callIconImg}
              />
            </button>
          </Tooltip>
        </div>
        <div className={styles.callBtnArea}>
          <Tooltip
            title="挂断通话"
            color="#5b625f"
            styles={{
              container: {
                color: '#eceeed',
                borderRadius: '8px',
                padding: '4px 8px',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
              },
            }}
          >
            <button
              type="button"
              className={styles.hangupBtn}
              onClick={onHangUp}
              aria-label="挂断电话"
            >
              <img src={hangupIcon} alt="" className={styles.callIconImg} />
            </button>
          </Tooltip>
        </div>
      </div>
    </div>
  );
}
