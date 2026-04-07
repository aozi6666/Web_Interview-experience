import { WEScene } from 'formats/we';
import { loadWEEffectShaders } from 'formats/we/shader';
import { Engine, createEngine } from 'moyu-engine';
import { createThreeBackend } from 'moyu-engine/rendering/threejs';
import { EngineDefaults } from 'moyu-engine/scenario/EngineDefaults';
import defaultProfile from './default-profile.json';

export class WERendererApp {
  private readonly canvas: HTMLCanvasElement;

  private engine: Engine | null = null;

  private scene: WEScene | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
  }

  async init(): Promise<void> {
    if (this.engine) return;

    EngineDefaults.configure(defaultProfile);
    this.syncCanvasSize();

    const backend = createThreeBackend({
      maxDpr: 1.5,
      powerPreference: 'low-power',
    });

    this.engine = createEngine({
      canvas: this.canvas,
      width: this.canvas.width,
      height: this.canvas.height,
      backend,
      effectShaderLoader: loadWEEffectShaders,
      backgroundColor: { r: 0, g: 0, b: 0, a: 1 },
    });
    this.scene = new WEScene(this.engine);
    this.engine.start();

    window.addEventListener('resize', this.handleResize);
  }

  async loadWallpaper(baseUrl: string): Promise<void> {
    if (!this.engine || !this.scene) return;

    this.engine.clearLayers();
    await this.scene.load(baseUrl);
  }

  dispose(): void {
    window.removeEventListener('resize', this.handleResize);
    this.engine?.stop();
    this.engine?.dispose();
    this.engine = null;
    this.scene = null;
  }

  private readonly handleResize = (): void => {
    this.syncCanvasSize();
    if (this.engine) {
      this.engine.resize(this.canvas.width, this.canvas.height);
    }
  };

  private syncCanvasSize(): void {
    const width = Math.max(
      1,
      Math.floor(this.canvas.clientWidth || window.innerWidth),
    );
    const height = Math.max(
      1,
      Math.floor(this.canvas.clientHeight || window.innerHeight),
    );
    this.canvas.width = width;
    this.canvas.height = height;
  }
}
