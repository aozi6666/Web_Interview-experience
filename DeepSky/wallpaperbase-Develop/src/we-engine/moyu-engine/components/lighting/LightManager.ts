import type { TimelineAnimation } from '../animation/TimelineAnimation';
import type { Color3, Vec3Like } from '../../math';

export type WELightType = 'lpoint' | 'lspot' | 'ltube' | 'ldirectional';

export interface RuntimeLight {
  type: WELightType;
  color: Color3;
  position: Vec3Like;
  direction: Vec3Like;
  intensity: number;
  radius: number;
  coneAngle: number;
  innerConeAngle: number;
  intensityAnimation?: TimelineAnimation;
}

export interface LightConfig {
  point?: number;
  spot?: number;
  tube?: number;
  directional?: number;
}

export interface SceneLightingState {
  ambientColor: Color3;
  skylightColor: Color3;
  config: LightConfig;
  lights: RuntimeLight[];
}

export interface ScenePointLightData {
  pointCount: number;
  lightPos: Float32Array;
  lightColor: Float32Array;
  ambientColor: Color3;
}

export class LightManager {
  private _ambientColor = { r: 1, g: 1, b: 1 };
  private _skylightColor = { r: 1, g: 1, b: 1 };
  private _config: LightConfig = {};
  private _lights: RuntimeLight[] = [];

  setState(state: SceneLightingState): void {
    this._ambientColor = state.ambientColor;
    this._skylightColor = state.skylightColor;
    this._config = { ...state.config };
    this._lights = [...state.lights];
  }

  clear(): void {
    this._ambientColor = { r: 1, g: 1, b: 1 };
    this._skylightColor = { r: 1, g: 1, b: 1 };
    this._config = {};
    this._lights = [];
  }

  update(deltaTime: number): void {
    for (const light of this._lights) {
      if (!light.intensityAnimation) continue;
      light.intensityAnimation.update(deltaTime);
      const sampled = light.intensityAnimation.sample();
      if (sampled.length > 0 && Number.isFinite(sampled[0])) {
        light.intensity = sampled[0];
      }
    }
  }

  get ambientColor(): Color3 {
    return { ...this._ambientColor };
  }

  get skylightColor(): Color3 {
    return { ...this._skylightColor };
  }

  getShaderLightDefines(): Record<string, number> {
    const grouped = this._groupedLights();
    return {
      LIGHTS_POINT: this._configuredOrActual('point', grouped.point.length),
      LIGHTS_SPOT: this._configuredOrActual('spot', grouped.spot.length),
      LIGHTS_TUBE: this._configuredOrActual('tube', grouped.tube.length),
      LIGHTS_DIRECTIONAL: this._configuredOrActual('directional', grouped.directional.length),
    };
  }

  getUniforms(): Record<string, Float32Array> {
    const grouped = this._groupedLights();
    const pointCount = this._configuredOrActual('point', grouped.point.length);
    const spotCount = this._configuredOrActual('spot', grouped.spot.length);
    const tubeCount = this._configuredOrActual('tube', grouped.tube.length);
    const directionalCount = this._configuredOrActual('directional', grouped.directional.length);

    const uniforms: Record<string, Float32Array> = {};

    if (pointCount > 0) {
      uniforms.g_LPoint_Color = new Float32Array(pointCount * 4);
      uniforms.g_LPoint_Origin = new Float32Array(pointCount * 4);
      for (let i = 0; i < pointCount; i++) {
        const light = grouped.point[i];
        if (!light) continue;
        const c = uniforms.g_LPoint_Color;
        const o = uniforms.g_LPoint_Origin;
        c[i * 4 + 0] = light.color.r;
        c[i * 4 + 1] = light.color.g;
        c[i * 4 + 2] = light.color.b;
        c[i * 4 + 3] = light.intensity;
        o[i * 4 + 0] = light.position.x;
        o[i * 4 + 1] = light.position.y;
        o[i * 4 + 2] = light.position.z;
        o[i * 4 + 3] = 1.0;
      }
    }

    if (spotCount > 0) {
      uniforms.g_LSpot_Color = new Float32Array(spotCount * 4);
      uniforms.g_LSpot_Origin = new Float32Array(spotCount * 4);
      uniforms.g_LSpot_Direction = new Float32Array(spotCount * 4);
      for (let i = 0; i < spotCount; i++) {
        const light = grouped.spot[i];
        if (!light) continue;
        const c = uniforms.g_LSpot_Color;
        const o = uniforms.g_LSpot_Origin;
        const d = uniforms.g_LSpot_Direction;
        c[i * 4 + 0] = light.color.r;
        c[i * 4 + 1] = light.color.g;
        c[i * 4 + 2] = light.color.b;
        c[i * 4 + 3] = light.intensity;
        o[i * 4 + 0] = light.position.x;
        o[i * 4 + 1] = light.position.y;
        o[i * 4 + 2] = light.position.z;
        o[i * 4 + 3] = light.coneAngle;
        d[i * 4 + 0] = light.direction.x;
        d[i * 4 + 1] = light.direction.y;
        d[i * 4 + 2] = light.direction.z;
        d[i * 4 + 3] = light.innerConeAngle;
      }
    }

    if (tubeCount > 0) {
      uniforms.g_LTube_Color = new Float32Array(tubeCount * 4);
      uniforms.g_LTube_OriginA = new Float32Array(tubeCount * 4);
      uniforms.g_LTube_OriginB = new Float32Array(tubeCount * 4);
      for (let i = 0; i < tubeCount; i++) {
        const light = grouped.tube[i];
        if (!light) continue;
        const c = uniforms.g_LTube_Color;
        const a = uniforms.g_LTube_OriginA;
        const b = uniforms.g_LTube_OriginB;
        c[i * 4 + 0] = light.color.r;
        c[i * 4 + 1] = light.color.g;
        c[i * 4 + 2] = light.color.b;
        c[i * 4 + 3] = light.intensity;
        a[i * 4 + 0] = light.position.x;
        a[i * 4 + 1] = light.position.y;
        a[i * 4 + 2] = light.position.z;
        a[i * 4 + 3] = 1.0;
        b[i * 4 + 0] = light.position.x;
        b[i * 4 + 1] = light.position.y;
        b[i * 4 + 2] = light.position.z;
        b[i * 4 + 3] = 1.0;
      }
    }

    if (directionalCount > 0) {
      uniforms.g_LDirectional_Color = new Float32Array(directionalCount * 4);
      uniforms.g_LDirectional_Direction = new Float32Array(directionalCount * 4);
      for (let i = 0; i < directionalCount; i++) {
        const light = grouped.directional[i];
        if (!light) continue;
        const c = uniforms.g_LDirectional_Color;
        const d = uniforms.g_LDirectional_Direction;
        c[i * 4 + 0] = light.color.r;
        c[i * 4 + 1] = light.color.g;
        c[i * 4 + 2] = light.color.b;
        c[i * 4 + 3] = light.intensity;
        d[i * 4 + 0] = light.direction.x;
        d[i * 4 + 1] = light.direction.y;
        d[i * 4 + 2] = light.direction.z;
        d[i * 4 + 3] = 0.0;
      }
    }

    return uniforms;
  }

  getSceneLightData(maxPointLights = 4): ScenePointLightData {
    const grouped = this._groupedLights();
    const configuredPointCount = this._configuredOrActual('point', grouped.point.length);
    const pointCount = Math.max(0, Math.min(maxPointLights, configuredPointCount));
    const lightPos = new Float32Array(maxPointLights * 4);
    const lightColor = new Float32Array(maxPointLights * 4);
    for (let i = 0; i < pointCount; i += 1) {
      const light = grouped.point[i];
      if (!light) continue;
      lightPos[i * 4 + 0] = light.position.x;
      lightPos[i * 4 + 1] = light.position.y;
      lightPos[i * 4 + 2] = light.position.z;
      lightPos[i * 4 + 3] = light.radius;
      lightColor[i * 4 + 0] = light.color.r;
      lightColor[i * 4 + 1] = light.color.g;
      lightColor[i * 4 + 2] = light.color.b;
      lightColor[i * 4 + 3] = light.intensity;
    }
    return {
      pointCount,
      lightPos,
      lightColor,
      ambientColor: this.ambientColor,
    };
  }

  private _configuredOrActual(kind: keyof LightConfig, actual: number): number {
    const fromConfig = this._config[kind];
    if (typeof fromConfig === 'number' && Number.isFinite(fromConfig) && fromConfig >= 0) {
      return Math.floor(fromConfig);
    }
    return actual;
  }

  private _groupedLights(): {
    point: RuntimeLight[];
    spot: RuntimeLight[];
    tube: RuntimeLight[];
    directional: RuntimeLight[];
  } {
    const grouped = {
      point: [] as RuntimeLight[],
      spot: [] as RuntimeLight[],
      tube: [] as RuntimeLight[],
      directional: [] as RuntimeLight[],
    };
    for (const light of this._lights) {
      if (light.type === 'lpoint') grouped.point.push(light);
      else if (light.type === 'lspot') grouped.spot.push(light);
      else if (light.type === 'ltube') grouped.tube.push(light);
      else if (light.type === 'ldirectional') grouped.directional.push(light);
    }
    return grouped;
  }
}

