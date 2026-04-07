export const BUILTIN_EFFECT_SHADERS = {
  spritesheetExtract: {
    vertex: `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`,
    fragment: `
uniform sampler2D map;
uniform vec2 u_FrameOffset;
uniform vec2 u_FrameScale;
varying vec2 vUv;
void main() {
  vec2 uv2 = u_FrameOffset + vUv * u_FrameScale;
  gl_FragColor = texture2D(map, uv2);
}
`,
  },
  circleMask: {
    vertex: `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`,
    fragment: `
uniform sampler2D g_Texture0;
varying vec2 vUv;
void main() {
  vec4 c = texture2D(g_Texture0, vUv);
  float d = distance(vUv, vec2(0.5, 0.5));
  float mask = 1.0 - smoothstep(0.495, 0.505, d);
  gl_FragColor = vec4(c.rgb, c.a * mask);
}
`,
  },
  passthrough: {
    vertex: `
varying vec2 v_TexCoord_WE;
void main() {
  v_TexCoord_WE = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`,
    fragment: `
precision mediump float;
uniform sampler2D g_Texture0;
varying vec2 v_TexCoord_WE;
void main() {
  gl_FragColor = texture2D(g_Texture0, v_TexCoord_WE);
}
`,
  },
  puppetSway: {
    vertex: `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`,
    fragment: `
uniform sampler2D g_Texture0;
uniform float g_Time;
uniform float u_SwayAmplitude;
uniform float u_SwayFrequency;
varying vec2 vUv;
void main() {
  vec2 texUv = vUv;
  float progress = 1.0 - texUv.y;
  float swayFactor = progress * progress;
  float offset = u_SwayAmplitude * swayFactor * sin(g_Time * u_SwayFrequency);
  texUv.x += offset;
  gl_FragColor = texture2D(g_Texture0, texUv);
}
`,
  },
} as const;
