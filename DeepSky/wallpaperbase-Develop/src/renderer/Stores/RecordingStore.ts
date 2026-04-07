import { proxy } from 'valtio';

export type RecordingResult = 'success' | 'failed' | 'idle';

export interface RecordingState {
  isRecording: boolean;
  startTime: number | null;
  targetSceneId: string;
  result: RecordingResult;
  error: string;
}

export const recordingStore = proxy<RecordingState>({
  isRecording: false,
  startTime: null,
  targetSceneId: '',
  result: 'idle',
  error: '',
});

export const recordingActions = {
  start: (sceneId: string) => {
    recordingStore.isRecording = true;
    recordingStore.startTime = Date.now();
    recordingStore.targetSceneId = sceneId;
    recordingStore.result = 'idle';
    recordingStore.error = '';
  },
  finish: (result: Exclude<RecordingResult, 'idle'>, error = '') => {
    recordingStore.isRecording = false;
    recordingStore.result = result;
    recordingStore.error = error;
    recordingStore.startTime = null;
    recordingStore.targetSceneId = '';
  },
  reset: () => {
    recordingStore.isRecording = false;
    recordingStore.startTime = null;
    recordingStore.targetSceneId = '';
    recordingStore.result = 'idle';
    recordingStore.error = '';
  },
};
