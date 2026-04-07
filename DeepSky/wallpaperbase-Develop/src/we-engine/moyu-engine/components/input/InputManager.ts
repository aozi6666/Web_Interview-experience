export type CursorEventName =
  | 'cursorMove'
  | 'cursorEnter'
  | 'cursorLeave'
  | 'cursorDown'
  | 'cursorUp'
  | 'cursorClick';

type CursorDispatch = (eventName: CursorEventName, event: Record<string, unknown>) => void;

export class InputManager {
  private _canvas: HTMLCanvasElement | null = null;
  private _dispatch: CursorDispatch;
  private _getScriptWorldSize: () => { width: number; height: number };
  private _mouseX = 0.5;
  private _mouseY = 0.5;
  private _lastMouseX = 0.5;
  private _lastMouseY = 0.5;
  private _cursorLeftDown = false;
  private _teardown: Array<() => void> = [];

  constructor(getScriptWorldSize: () => { width: number; height: number }, dispatch: CursorDispatch) {
    this._getScriptWorldSize = getScriptWorldSize;
    this._dispatch = dispatch;
  }

  get mouseX(): number { return this._mouseX; }
  get mouseY(): number { return this._mouseY; }
  get lastMouseX(): number { return this._lastMouseX; }
  get lastMouseY(): number { return this._lastMouseY; }
  get cursorLeftDown(): boolean { return this._cursorLeftDown; }

  attach(canvas: HTMLCanvasElement): void {
    this.dispose();
    this._canvas = canvas;

    const updateMouse = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      this._lastMouseX = this._mouseX;
      this._lastMouseY = this._mouseY;
      this._mouseX = (e.clientX - rect.left) / rect.width;
      this._mouseY = 1.0 - (e.clientY - rect.top) / rect.height;
    };

    const buildCursorEvent = (e: MouseEvent) => {
      const world = this._getScriptWorldSize();
      const worldPosition = { x: this._mouseX * world.width, y: this._mouseY * world.height, z: 0 };
      return {
        x: this._mouseX,
        y: this._mouseY,
        cursorPosition: { x: this._mouseX, y: this._mouseY },
        cursorWorldPosition: worldPosition,
        worldPosition,
        rawX: e.clientX,
        rawY: e.clientY,
        button: e.button,
        buttons: e.buttons,
      };
    };

    const add = <K extends keyof HTMLElementEventMap>(eventName: K, handler: (event: HTMLElementEventMap[K]) => void) => {
      const wrapped = handler as EventListener;
      canvas.addEventListener(eventName, wrapped);
      this._teardown.push(() => canvas.removeEventListener(eventName, wrapped));
    };

    add('mousemove', (e) => {
      updateMouse(e as MouseEvent);
      this._dispatch('cursorMove', buildCursorEvent(e as MouseEvent));
    });
    add('mouseenter', (e) => {
      updateMouse(e as MouseEvent);
      this._dispatch('cursorEnter', buildCursorEvent(e as MouseEvent));
    });
    add('mouseleave', (e) => {
      updateMouse(e as MouseEvent);
      this._cursorLeftDown = false;
      this._dispatch('cursorLeave', buildCursorEvent(e as MouseEvent));
    });
    add('mousedown', (e) => {
      updateMouse(e as MouseEvent);
      if ((e as MouseEvent).button === 0) this._cursorLeftDown = true;
      this._dispatch('cursorDown', buildCursorEvent(e as MouseEvent));
    });
    add('mouseup', (e) => {
      updateMouse(e as MouseEvent);
      if ((e as MouseEvent).button === 0) this._cursorLeftDown = false;
      const cursorEvent = buildCursorEvent(e as MouseEvent);
      this._dispatch('cursorUp', cursorEvent);
      this._dispatch('cursorClick', cursorEvent);
    });
  }

  dispose(): void {
    for (const teardown of this._teardown) teardown();
    this._teardown = [];
    this._canvas = null;
  }
}
