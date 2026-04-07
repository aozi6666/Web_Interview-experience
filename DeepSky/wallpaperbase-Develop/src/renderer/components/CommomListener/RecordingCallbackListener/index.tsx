import { getIpcEvents } from '@renderer/ipc-events';
import { globalProgressActions } from '@stores/GlobalProgressStore';
import { recordingActions, recordingStore } from '@stores/RecordingStore';
import { IPCChannels } from '@shared/channels';
import { IpcTarget } from '@shared/ipc-events';
import { message } from 'antd';
import { useEffect } from 'react';

const ipcEvents = getIpcEvents();

interface RecordingCallbackPayload {
  result: 'success' | 'failed';
  data?: {
    filePath?: string;
    duration?: number;
    error?: string;
  };
}

export function RecordingCallbackListener() {
  useEffect(() => {
    const handleRecordingCallback = (payload: unknown) => {
      const data = payload as RecordingCallbackPayload;
      if (!recordingStore.isRecording) {
        return;
      }

      if (data?.result === 'success') {
        recordingActions.finish('success');
        globalProgressActions.success('更新完成');
        message.success('录制完成');
        return;
      }

      const errorMsg = data?.data?.error || '录制失败';
      recordingActions.finish('failed', errorMsg);
      globalProgressActions.error('更新失败');
      message.error(errorMsg);
    };

    ipcEvents.on(
      IpcTarget.MAIN,
      IPCChannels.UE_RECORDING_CALLBACK,
      handleRecordingCallback,
    );

    return () => {
      ipcEvents.off(
        IpcTarget.MAIN,
        IPCChannels.UE_RECORDING_CALLBACK,
        handleRecordingCallback,
      );
    };
  }, []);

  return null;
}

export default RecordingCallbackListener;
