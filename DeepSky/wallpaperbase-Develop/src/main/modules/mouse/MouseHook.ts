import {
  callSetMouseHook,
  callUnhookMouse,
  isDllLoaded,
} from '../../koffi/mouseHook';

const isWin = process.platform === 'win32';

export function SetMouseHook(handles: number): void {
  if (!isWin) {
    return;
  }

  const success = callSetMouseHook(handles);
  if (!success) {
    // eslint-disable-next-line no-console
    console.error('设置鼠标钩子失败');
  }
}

export function UnhookMouse(): void {
  if (!isWin) {
    return;
  }

  const success = callUnhookMouse();
  if (!success) {
    // eslint-disable-next-line no-console
    console.error('卸载鼠标钩子失败');
  }
}

export function isMouseHookAvailable(): boolean {
  return isWin && isDllLoaded();
}
