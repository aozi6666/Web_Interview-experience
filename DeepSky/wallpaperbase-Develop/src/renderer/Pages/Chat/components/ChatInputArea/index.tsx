import React from 'react';
import CallControls from '../CallControls';
import TextInputControls from '../TextInputControls';
import { useInputAreaStyles } from './styles';

interface ChatInputAreaProps {
  isCallMode: boolean;
  chatMode: string;
  textInput: string;
  isVoiceButtonPressed: boolean;
  isMicEnabled: boolean;
  waveformSamples?: number[];
  onTextInputChange: (value: string) => void;
  onTextSend: () => void;
  onToggleChatMode: () => void;
  onToggleCallMode: () => void;
  onVoiceButtonDown: () => void;
  onVoiceButtonUp: () => void;
  onToggleCallMic: () => void;
  onHangUp: () => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
  /** 埋点上下文：embed=推荐/我的壁纸/我的角色页侧边栏，big=聊天页，small=聊天小窗(Alt+X) */
  analyticsContext?: 'embed' | 'big' | 'small';
}

export default function ChatInputArea({
  isCallMode,
  chatMode,
  textInput,
  isVoiceButtonPressed,
  isMicEnabled,
  waveformSamples,
  onTextInputChange,
  onTextSend,
  onToggleChatMode,
  onToggleCallMode,
  onVoiceButtonDown,
  onVoiceButtonUp,
  onToggleCallMic,
  onHangUp,
  onKeyDown,
  inputRef,
  analyticsContext = 'embed',
}: ChatInputAreaProps) {
  const { styles } = useInputAreaStyles();
  return (
    <div className={styles.bottomControls}>
      <div className={styles.waveformAndInputContainer} />
      {!isCallMode && (
        <TextInputControls
          chatMode={chatMode}
          textInput={textInput}
          isVoiceButtonPressed={isVoiceButtonPressed}
          waveformSamples={waveformSamples}
          onTextInputChange={onTextInputChange}
          onTextSend={onTextSend}
          onToggleChatMode={onToggleChatMode}
          onToggleCallMode={onToggleCallMode}
          onVoiceButtonDown={onVoiceButtonDown}
          onVoiceButtonUp={onVoiceButtonUp}
          inputRef={inputRef}
          onKeyDown={onKeyDown}
          analyticsContext={analyticsContext}
        />
      )}

      {isCallMode && (
        <CallControls
          isMicEnabled={isMicEnabled}
          waveformSamples={waveformSamples}
          onToggleMic={onToggleCallMic}
          onHangUp={onHangUp}
        />
      )}
    </div>
  );
}
