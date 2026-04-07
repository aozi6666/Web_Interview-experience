import { createThreeBackend } from 'moyu-engine/rendering/threejs';
import { createEngine, type Engine } from 'moyu-engine';
import { createCharacterLayer, type CharacterLayer, type PartDef } from 'moyu-engine/avatar/puppet/character';
import { loadWEEffectShaders } from 'formats/we/shader';
import { createCharacterDefFromSelection, getAssetCatalog, type AssetCatalog } from './generator-assets';

interface GeneratorState {
  engine: Engine | null;
  layer: CharacterLayer | null;
  catalog: AssetCatalog;
  selectedParts: Record<string, string>;
  partById: Map<string, PartDef>;
  autoBlink: boolean;
  blinkTimer: number;
  blinkState: 'wait' | 'closing' | 'opening';
  nextBlinkIn: number;
}

const state: GeneratorState = {
  engine: null,
  layer: null,
  catalog: getAssetCatalog(),
  selectedParts: {},
  partById: new Map(),
  autoBlink: true,
  blinkTimer: 0,
  blinkState: 'wait',
  nextBlinkIn: 2.5,
};

function el<T extends HTMLElement>(id: string): T {
  return document.getElementById(id) as T;
}

function updateStatus(text: string): void {
  el<HTMLDivElement>('preview-status').textContent = text;
}

function layoutCharacter(): void {
  const engine = state.engine;
  const layer = state.layer;
  if (!engine || !layer) return;
  const center = { x: engine.width * 0.5, y: engine.height * 0.52 };
  const fitScale = Math.min(engine.width / 720, engine.height / 720);
  const scale = Math.max(0.58, Math.min(1.1, fitScale));
  layer.setPosition(center.x, center.y);
  layer.setScale(scale);
}

function initSelection(): void {
  const selected: Record<string, string> = {};
  for (const slot of state.catalog.slots) {
    selected[slot.id] = state.catalog.defaultParts[slot.id] ?? slot.partIds[0];
  }
  state.selectedParts = selected;
}

function syncValueLabel(labelId: string, value: number, fixed = 2): void {
  el<HTMLSpanElement>(labelId).textContent = value.toFixed(fixed);
}

function bindParameterSlider(
  inputId: string,
  valueId: string,
  paramId: string,
  fixed = 2,
): void {
  const input = el<HTMLInputElement>(inputId);
  input.addEventListener('input', () => {
    const value = Number(input.value);
    syncValueLabel(valueId, value, fixed);
    state.layer?.setParameter(paramId, value);
  });
}

async function applyPart(slotId: string, partId: string): Promise<void> {
  const layer = state.layer;
  if (!layer) return;
  const part = state.partById.get(partId);
  if (!part) return;
  await layer.swapPart(slotId, part);
  state.selectedParts[slotId] = partId;
  updateActivePartCards();
}

function updateActivePartCards(): void {
  const cards = document.querySelectorAll<HTMLButtonElement>('.part-card');
  cards.forEach((card) => {
    const slotId = card.dataset.slotId ?? '';
    const partId = card.dataset.partId ?? '';
    const active = state.selectedParts[slotId] === partId;
    card.classList.toggle('active', active);
  });
}

function buildPartPanel(): void {
  const root = el<HTMLDivElement>('part-panel');
  root.innerHTML = '';
  for (const slot of state.catalog.slots) {
    const group = document.createElement('section');
    group.className = 'slot-group';
    const title = document.createElement('div');
    title.className = 'slot-title';
    title.textContent = slot.label;
    group.appendChild(title);

    const grid = document.createElement('div');
    grid.className = 'slot-grid';

    for (const partId of slot.partIds) {
      const part = state.partById.get(partId);
      if (!part) continue;
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'part-card';
      card.dataset.slotId = slot.id;
      card.dataset.partId = part.id;
      card.style.backgroundImage = `url("${part.texture}")`;
      card.title = part.id;
      card.addEventListener('click', () => {
        void applyPart(slot.id, part.id);
      });
      grid.appendChild(card);
    }
    group.appendChild(grid);
    root.appendChild(group);
  }
  updateActivePartCards();
}

async function randomize(): Promise<void> {
  for (const slot of state.catalog.slots) {
    const picked = slot.partIds[Math.floor(Math.random() * slot.partIds.length)];
    await applyPart(slot.id, picked);
  }
}

async function resetAll(): Promise<void> {
  for (const slot of state.catalog.slots) {
    const partId = state.catalog.defaultParts[slot.id] ?? slot.partIds[0];
    await applyPart(slot.id, partId);
  }
  const defaults = [
    ['param-eye-l', 'val-eye-l', 1, 2, 'ParamEyeLOpen'],
    ['param-eye-r', 'val-eye-r', 1, 2, 'ParamEyeROpen'],
    ['param-mouth', 'val-mouth', 0, 2, 'ParamMouthOpenY'],
    ['param-angle-x', 'val-angle-x', 0, 0, 'ParamAngleX'],
    ['param-angle-y', 'val-angle-y', 0, 0, 'ParamAngleY'],
    ['param-angle-z', 'val-angle-z', 0, 0, 'ParamAngleZ'],
  ] as const;

  for (const item of defaults) {
    const [inputId, labelId, value, fixed, paramId] = item;
    const input = el<HTMLInputElement>(inputId);
    input.value = String(value);
    syncValueLabel(labelId, value, fixed);
    state.layer?.setParameter(paramId, value);
  }
}

function exportPNG(): void {
  const dataUrl = state.engine?.captureFrame('png');
  if (!dataUrl) return;
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = `character-${Date.now()}.png`;
  link.click();
}

function exportJSON(): void {
  const payload = {
    selectedParts: state.selectedParts,
    characterDef: createCharacterDefFromSelection('GeneratedCharacter', state.catalog, state.selectedParts),
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `character-${Date.now()}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

function updateBlink(dt: number): void {
  if (!state.autoBlink || !state.layer) return;
  state.blinkTimer += dt;
  if (state.blinkState === 'wait') {
    if (state.blinkTimer >= state.nextBlinkIn) {
      state.blinkTimer = 0;
      state.blinkState = 'closing';
    }
    return;
  }
  if (state.blinkState === 'closing') {
    const t = Math.min(1, state.blinkTimer / 0.08);
    const v = 1 - t;
    state.layer.setParameter('ParamEyeLOpen', v);
    state.layer.setParameter('ParamEyeROpen', v);
    el<HTMLInputElement>('param-eye-l').value = String(v);
    el<HTMLInputElement>('param-eye-r').value = String(v);
    syncValueLabel('val-eye-l', v, 2);
    syncValueLabel('val-eye-r', v, 2);
    if (t >= 1) {
      state.blinkTimer = 0;
      state.blinkState = 'opening';
    }
    return;
  }
  const t = Math.min(1, state.blinkTimer / 0.12);
  const v = t;
  state.layer.setParameter('ParamEyeLOpen', v);
  state.layer.setParameter('ParamEyeROpen', v);
  el<HTMLInputElement>('param-eye-l').value = String(v);
  el<HTMLInputElement>('param-eye-r').value = String(v);
  syncValueLabel('val-eye-l', v, 2);
  syncValueLabel('val-eye-r', v, 2);
  if (t >= 1) {
    state.blinkTimer = 0;
    state.blinkState = 'wait';
    state.nextBlinkIn = 2.2 + Math.random() * 2.2;
  }
}

function bindEvents(): void {
  bindParameterSlider('param-eye-l', 'val-eye-l', 'ParamEyeLOpen', 2);
  bindParameterSlider('param-eye-r', 'val-eye-r', 'ParamEyeROpen', 2);
  bindParameterSlider('param-mouth', 'val-mouth', 'ParamMouthOpenY', 2);
  bindParameterSlider('param-angle-x', 'val-angle-x', 'ParamAngleX', 0);
  bindParameterSlider('param-angle-y', 'val-angle-y', 'ParamAngleY', 0);
  bindParameterSlider('param-angle-z', 'val-angle-z', 'ParamAngleZ', 0);

  el<HTMLButtonElement>('btn-random').addEventListener('click', () => void randomize());
  el<HTMLButtonElement>('btn-reset').addEventListener('click', () => void resetAll());
  el<HTMLButtonElement>('btn-export-png').addEventListener('click', exportPNG);
  el<HTMLButtonElement>('btn-export-json').addEventListener('click', exportJSON);

  el<HTMLButtonElement>('preset-neutral').addEventListener('click', () => {
    state.layer?.setParameter('ParamMouthOpenY', 0);
    state.layer?.setParameter('ParamAngleX', 0);
    state.layer?.setParameter('ParamAngleY', 0);
    state.layer?.setParameter('ParamAngleZ', 0);
    el<HTMLInputElement>('param-mouth').value = '0';
    el<HTMLInputElement>('param-angle-x').value = '0';
    el<HTMLInputElement>('param-angle-y').value = '0';
    el<HTMLInputElement>('param-angle-z').value = '0';
    syncValueLabel('val-mouth', 0, 2);
    syncValueLabel('val-angle-x', 0, 0);
    syncValueLabel('val-angle-y', 0, 0);
    syncValueLabel('val-angle-z', 0, 0);
  });
  el<HTMLButtonElement>('preset-happy').addEventListener('click', () => {
    state.layer?.setParameter('ParamEyeLOpen', 0.85);
    state.layer?.setParameter('ParamEyeROpen', 0.85);
    state.layer?.setParameter('ParamMouthOpenY', 0.6);
    state.layer?.setParameter('ParamAngleY', 8);
    el<HTMLInputElement>('param-eye-l').value = '0.85';
    el<HTMLInputElement>('param-eye-r').value = '0.85';
    el<HTMLInputElement>('param-mouth').value = '0.6';
    el<HTMLInputElement>('param-angle-y').value = '8';
    syncValueLabel('val-eye-l', 0.85, 2);
    syncValueLabel('val-eye-r', 0.85, 2);
    syncValueLabel('val-mouth', 0.6, 2);
    syncValueLabel('val-angle-y', 8, 0);
  });
  el<HTMLButtonElement>('preset-shy').addEventListener('click', () => {
    state.layer?.setParameter('ParamEyeLOpen', 0.55);
    state.layer?.setParameter('ParamEyeROpen', 0.55);
    state.layer?.setParameter('ParamMouthOpenY', 0.2);
    state.layer?.setParameter('ParamAngleX', -8);
    state.layer?.setParameter('ParamAngleZ', -7);
    el<HTMLInputElement>('param-eye-l').value = '0.55';
    el<HTMLInputElement>('param-eye-r').value = '0.55';
    el<HTMLInputElement>('param-mouth').value = '0.2';
    el<HTMLInputElement>('param-angle-x').value = '-8';
    el<HTMLInputElement>('param-angle-z').value = '-7';
    syncValueLabel('val-eye-l', 0.55, 2);
    syncValueLabel('val-eye-r', 0.55, 2);
    syncValueLabel('val-mouth', 0.2, 2);
    syncValueLabel('val-angle-x', -8, 0);
    syncValueLabel('val-angle-z', -7, 0);
  });

  el<HTMLButtonElement>('toggle-blink').addEventListener('click', (event) => {
    state.autoBlink = !state.autoBlink;
    const button = event.currentTarget as HTMLButtonElement;
    button.textContent = `自动眨眼: ${state.autoBlink ? '开' : '关'}`;
  });
}

async function init(): Promise<void> {
  const canvas = el<HTMLCanvasElement>('generator-canvas');
  const catalog = state.catalog;
  state.partById = new Map(catalog.allParts.map((part) => [part.id, part]));
  initSelection();

  const resizeCanvas = () => {
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.max(1, Math.floor(rect.width));
    canvas.height = Math.max(1, Math.floor(rect.height));
    state.engine?.resize(canvas.width, canvas.height);
    layoutCharacter();
  };

  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  state.engine = createEngine({
    canvas,
    width: canvas.width,
    height: canvas.height,
    backend: createThreeBackend(),
    effectShaderLoader: loadWEEffectShaders,
    backgroundColor: { r: 0.1, g: 0.12, b: 0.19, a: 1 },
  });

  const characterDef = createCharacterDefFromSelection('GeneratorDemo', catalog, state.selectedParts);
  state.layer = createCharacterLayer({
    id: 'generator-character',
    name: 'Generator Character',
    width: 512,
    height: 512,
    x: canvas.width * 0.5,
    y: canvas.height * 0.58,
    zIndex: 10,
    characterDef,
    autoAnimate: false,
  });
  await state.engine.addLayer(state.layer);
  layoutCharacter();
  state.engine.start();

  buildPartPanel();
  bindEvents();
  syncValueLabel('val-eye-l', 1, 2);
  syncValueLabel('val-eye-r', 1, 2);
  syncValueLabel('val-mouth', 0, 2);
  syncValueLabel('val-angle-x', 0, 0);
  syncValueLabel('val-angle-y', 0, 0);
  syncValueLabel('val-angle-z', 0, 0);

  window.setInterval(() => {
    updateBlink(0.1);
  }, 100);

  updateStatus('已就绪：选择部件开始生成');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    void init();
  });
} else {
  void init();
}
