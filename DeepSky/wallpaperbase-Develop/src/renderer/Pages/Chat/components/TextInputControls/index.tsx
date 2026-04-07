import keyboardIcon from '$assets/icons/WallPaperInput/keyboard.png';
import phoneIcon from '$assets/icons/WallPaperInput/phone.png';
import sendDisIcon from '$assets/icons/WallPaperInput/send-dark-dis.png';
import sendNorIcon from '$assets/icons/WallPaperInput/send-dark-nor.png';
import voiceIcon from '$assets/icons/WallPaperInput/voice.png';
import AudioWaveform from '@components/AudioWaveform';
import { analytics } from '@utils/Weblogger/analyticsAPI';
import { AnalyticsEvent } from '@utils/Weblogger/webloggerConstance';
import { Tooltip } from 'antd';
import React, { useRef } from 'react';
import { useTextInputStyles } from './styles';

const CHAT_EVENTS = {
  embed: {
    mode: AnalyticsEvent.CHAT_EMBED_MODE_SWITCH_CLICK,
    voiceRecord: AnalyticsEvent.CHAT_EMBED_VOICE_RECORD_CLICK,
    textInput: AnalyticsEvent.CHAT_EMBED_TEXT_INPUT_CLICK,
    chatSend: AnalyticsEvent.CHAT_EMBED_CHAT_SEND_CLICK,
    voiceChatStart: AnalyticsEvent.CHAT_EMBED_VOICE_CHAT_START_CLICK,
  },
  big: {
    mode: AnalyticsEvent.CHAT_BIG_MODE_SWITCH_CLICK,
    voiceRecord: AnalyticsEvent.CHAT_BIG_VOICE_RECORD_CLICK,
    textInput: AnalyticsEvent.CHAT_BIG_TEXT_INPUT_CLICK,
    chatSend: AnalyticsEvent.CHAT_BIG_CHAT_SEND_CLICK,
    voiceChatStart: AnalyticsEvent.CHAT_BIG_VOICE_CHAT_START_CLICK,
  },
  small: {
    mode: AnalyticsEvent.CHAT_SMALL_MODE_SWITCH_CLICK,
    voiceRecord: AnalyticsEvent.CHAT_SMALL_VOICE_RECORD_CLICK,
    textInput: AnalyticsEvent.CHAT_SMALL_TEXT_INPUT_CLICK,
    chatSend: AnalyticsEvent.CHAT_SMALL_CHAT_SEND_CLICK,
    voiceChatStart: AnalyticsEvent.CHAT_SMALL_VOICE_CHAT_START_CLICK,
  },
} as const;

interface TextInputControlsProps {
  chatMode: string;
  textInput: string;
  isVoiceButtonPressed: boolean;
  waveformSamples?: number[];
  onTextInputChange: (value: string) => void;
  onTextSend: () => void;
  onToggleChatMode: () => void;
  onToggleCallMode: () => void;
  onVoiceButtonDown: () => void;
  onVoiceButtonUp: () => void;
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  /** 埋点上下文：embed=侧边栏，big=聊天页，small=聊天小窗(Alt+X) */
  analyticsContext?: 'embed' | 'big' | 'small';
}

export default function TextInputControls({
  chatMode,
  textInput,
  isVoiceButtonPressed,
  waveformSamples,
  onTextInputChange,
  onTextSend,
  onToggleChatMode,
  onToggleCallMode,
  onVoiceButtonDown,
  onVoiceButtonUp,
  inputRef,
  onKeyDown,
  analyticsContext = 'embed',
}: TextInputControlsProps) {
  const { styles } = useTextInputStyles();
  const ctx = analyticsContext ?? 'embed';
  const ev = CHAT_EVENTS[ctx];
  const modeEv = ev.mode;
  const voiceRecordEv = ev.voiceRecord;
  const textInputEv = ev.textInput;
  const chatSendEv = ev.chatSend;
  const voiceChatStartEv = ev.voiceChatStart;
  const isButtonPressedRef = useRef(false);
  const clickTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleMouseDown = () => {
    analytics.track(voiceRecordEv,
      {},
    ).catch(() => {});
    isButtonPressedRef.current = true;
    onVoiceButtonDown();
  };

  const handleMouseUp = () => {
    if (isButtonPressedRef.current) {
      isButtonPressedRef.current = false;
      onVoiceButtonUp();
    }
  };

  const handleMouseLeave = () => {
    // 如果鼠标离开按钮区域且按钮被按下，则触发松开事件
    if (isButtonPressedRef.current) {
      isButtonPressedRef.current = false;
      onVoiceButtonUp();
    }
  };

  const handleClick = () => {
    // 延迟执行 onClick 检查，给正常的鼠标事件序列一个完成的机会
    // 这避免了快速点击时重复调用 onVoiceButtonUp
    if (clickTimeoutRef.current) {
      clearTimeout(clickTimeoutRef.current);
    }

    clickTimeoutRef.current = setTimeout(() => {
      // 如果点击后按钮仍然处于按下状态，说明之前的 mouseup 没有触发
      if (isVoiceButtonPressed && !isButtonPressedRef.current) {
        onVoiceButtonUp();
      }
      clickTimeoutRef.current = null;
    }, 50); // 50ms 延迟，应该足够让正常的 mouseup 事件先执行
  };

  return (
    <div className={styles.controls}>
      <Tooltip
        title={chatMode === 'typewrite' ? '切换 语音输入' : '切换 打字输入'}
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
          className={styles.iconBtn}
          onClick={() => {
            analytics.track(modeEv,
              {},
            ).catch(() => {});
            onToggleChatMode();
          }}
          aria-label={chatMode === 'typewrite' ? '切换到语音' : '切换到文字'}
        >
          <img
            src={chatMode === 'typewrite' ? voiceIcon : keyboardIcon}
            alt=""
            className={styles.iconImg}
          />
        </button>
      </Tooltip>
      {chatMode === 'typewrite' && (
        <textarea
          ref={inputRef}
          className={styles.textInputWp}
          placeholder="点击输入，回车发送"
          value={textInput}
          onChange={(e) => onTextInputChange(e.target.value)}
          onFocus={() => {
            analytics.track(textInputEv,
              {},
            ).catch(() => {});
          }}
          onKeyDown={onKeyDown}
          rows={1}
        />
      )}
      {chatMode === 'talkback' && (
        <div className={styles.voiceSendBtnContainer}>
          {isVoiceButtonPressed && (
            <div className={styles.voiceBubble}>
              <AudioWaveform isEnabled samples={waveformSamples ?? []} />
            </div>
          )}
          <button
            type="button"
            className={`${styles.voiceSendBtn} ${isVoiceButtonPressed ? styles.voiceSendBtnPressed : ''}`}
            onMouseDown={handleMouseDown}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseLeave}
            onTouchStart={handleMouseDown}
            onTouchEnd={handleMouseUp}
            onClick={handleClick}
            aria-label="语音发送"
          >
            {isVoiceButtonPressed ? '松开 结束对话' : '按住 开启对话'}
          </button>
        </div>
      )}
      <div className={styles.rightButtons}>
        {chatMode === 'typewrite' && (
          <Tooltip
            title="发送"
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
              className={styles.iconBtn}
              onClick={() => {
                analytics.track(chatSendEv,
                  {},
                ).catch(() => {});
                onTextSend();
              }}
              aria-label="发送消息"
            >
              <img
                src={textInput.trim() ? sendNorIcon : sendDisIcon}
                alt=""
                className={styles.sendIconImg}
              />
            </button>
          </Tooltip>
        )}

        <Tooltip
          title="语音通话"
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
            className={styles.iconBtn}
            onClick={() => {
              analytics.track(voiceChatStartEv,
                {},
              ).catch(() => {});
              onToggleCallMode();
            }}
            aria-label="拨打电话"
          >
            <img src={phoneIcon} alt="" className={styles.iconImg} />
          </button>
        </Tooltip>
      </div>
    </div>
  );
}
