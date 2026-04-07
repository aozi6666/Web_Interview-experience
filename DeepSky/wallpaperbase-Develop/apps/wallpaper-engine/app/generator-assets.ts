import type { CharacterDef, PartDef } from 'moyu-engine/avatar/puppet/character';

export interface SlotInfo {
  id: string;
  label: string;
  partIds: string[];
}

export interface AssetCatalog {
  slots: SlotInfo[];
  allParts: PartDef[];
  defaultParts: Record<string, string>;
}

const TRANSPARENT_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAuMBg6Q0M3sAAAAASUVORK5CYII=';

function createRectMesh(cx: number, cy: number, width: number, height: number) {
  const hw = width / 2;
  const hh = height / 2;
  return {
    vertices: new Float32Array([
      cx - hw, cy - hh, 0,
      cx + hw, cy - hh, 0,
      cx + hw, cy + hh, 0,
      cx - hw, cy + hh, 0,
    ]),
    uvs: new Float32Array([
      0, 0,
      1, 0,
      1, 1,
      0, 1,
    ]),
    indices: new Uint16Array([0, 1, 2, 0, 2, 3]),
  };
}

function createQuadDelta(
  leftDx: number,
  rightDx: number,
  topDy: number,
  bottomDy: number,
  globalDx = 0,
  globalDy = 0,
): Float32Array {
  return new Float32Array([
    leftDx + globalDx, bottomDy + globalDy,
    rightDx + globalDx, bottomDy + globalDy,
    rightDx + globalDx, topDy + globalDy,
    leftDx + globalDx, topDy + globalDy,
  ]);
}

function createTiltDelta(magnitude: number): Float32Array {
  return new Float32Array([
    -magnitude, -magnitude,
    -magnitude, magnitude,
    magnitude, magnitude,
    magnitude, -magnitude,
  ]);
}

function createCanvas(width: number, height: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('无法创建 Canvas 2D 上下文');
  }
  return [canvas, ctx];
}

function createFaceTexture(kind: 'round' | 'oval', fill: string, stroke: string): string {
  const [canvas, ctx] = createCanvas(512, 512);
  ctx.clearRect(0, 0, 512, 512);
  ctx.fillStyle = fill;
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 10;
  ctx.beginPath();
  if (kind === 'round') {
    ctx.arc(256, 256, 200, 0, Math.PI * 2);
  } else {
    ctx.ellipse(256, 256, 175, 210, 0, 0, Math.PI * 2);
  }
  ctx.fill();
  ctx.stroke();
  return canvas.toDataURL('image/png');
}

function createHairTexture(
  kind: 'short' | 'long' | 'twintail',
  layer: 'front' | 'back',
  color: string,
  shadow: string,
): string {
  const [canvas, ctx] = createCanvas(512, 512);
  ctx.clearRect(0, 0, 512, 512);
  ctx.fillStyle = color;
  ctx.strokeStyle = shadow;
  ctx.lineWidth = 8;

  if (layer === 'back') {
    ctx.beginPath();
    ctx.moveTo(86, 330);
    ctx.quadraticCurveTo(256, 490, 426, 330);
    if (kind === 'short') {
      ctx.lineTo(426, 220);
      ctx.quadraticCurveTo(256, 145, 86, 220);
    } else if (kind === 'long') {
      ctx.lineTo(470, 450);
      ctx.quadraticCurveTo(256, 520, 42, 450);
      ctx.lineTo(86, 200);
      ctx.quadraticCurveTo(256, 120, 426, 200);
    } else {
      ctx.lineTo(450, 405);
      ctx.quadraticCurveTo(392, 480, 336, 405);
      ctx.lineTo(320, 250);
      ctx.quadraticCurveTo(256, 200, 192, 250);
      ctx.lineTo(176, 405);
      ctx.quadraticCurveTo(120, 480, 62, 405);
      ctx.lineTo(86, 220);
      ctx.quadraticCurveTo(256, 120, 426, 220);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    return canvas.toDataURL('image/png');
  }

  ctx.beginPath();
  ctx.moveTo(92, 230);
  ctx.quadraticCurveTo(120, 112, 256, 96);
  ctx.quadraticCurveTo(392, 112, 420, 230);
  if (kind === 'short') {
    ctx.quadraticCurveTo(360, 260, 312, 250);
    ctx.quadraticCurveTo(256, 280, 200, 250);
    ctx.quadraticCurveTo(150, 260, 92, 230);
  } else if (kind === 'long') {
    ctx.quadraticCurveTo(384, 300, 338, 330);
    ctx.quadraticCurveTo(300, 292, 256, 332);
    ctx.quadraticCurveTo(212, 292, 174, 330);
    ctx.quadraticCurveTo(128, 300, 92, 230);
  } else {
    ctx.quadraticCurveTo(396, 272, 372, 332);
    ctx.quadraticCurveTo(324, 302, 278, 328);
    ctx.quadraticCurveTo(256, 284, 234, 328);
    ctx.quadraticCurveTo(188, 302, 140, 332);
    ctx.quadraticCurveTo(116, 272, 92, 230);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  return canvas.toDataURL('image/png');
}

function createEyeTexture(kind: 'round' | 'cat' | 'sleepy', iris: string): string {
  const [canvas, ctx] = createCanvas(192, 96);
  ctx.clearRect(0, 0, 192, 96);
  ctx.fillStyle = '#f9fbff';
  ctx.strokeStyle = '#24324f';
  ctx.lineWidth = 6;

  ctx.beginPath();
  if (kind === 'cat') {
    ctx.moveTo(10, 52);
    ctx.quadraticCurveTo(58, 10, 182, 48);
    ctx.quadraticCurveTo(58, 82, 10, 52);
  } else if (kind === 'sleepy') {
    ctx.moveTo(10, 56);
    ctx.quadraticCurveTo(96, 28, 182, 56);
    ctx.quadraticCurveTo(96, 70, 10, 56);
  } else {
    ctx.moveTo(10, 48);
    ctx.quadraticCurveTo(96, 12, 182, 48);
    ctx.quadraticCurveTo(96, 84, 10, 48);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.beginPath();
  ctx.fillStyle = iris;
  if (kind === 'cat') {
    ctx.ellipse(110, 50, 16, 26, 0, 0, Math.PI * 2);
  } else if (kind === 'sleepy') {
    ctx.ellipse(110, 56, 24, 12, 0, 0, Math.PI * 2);
  } else {
    ctx.ellipse(110, 50, 24, 20, 0, 0, Math.PI * 2);
  }
  ctx.fill();

  ctx.beginPath();
  ctx.fillStyle = '#0f172a';
  if (kind === 'cat') {
    ctx.ellipse(110, 50, 4, 20, 0, 0, Math.PI * 2);
  } else {
    ctx.ellipse(110, 50, 8, 14, 0, 0, Math.PI * 2);
  }
  ctx.fill();
  return canvas.toDataURL('image/png');
}

function createMouthTexture(kind: 'smile' | 'open' | 'pout', color: string): string {
  const [canvas, ctx] = createCanvas(192, 120);
  ctx.clearRect(0, 0, 192, 120);
  ctx.strokeStyle = color;
  ctx.lineWidth = 10;
  ctx.lineCap = 'round';

  if (kind === 'smile') {
    ctx.beginPath();
    ctx.moveTo(30, 56);
    ctx.quadraticCurveTo(96, 92, 162, 56);
    ctx.stroke();
  } else if (kind === 'open') {
    ctx.fillStyle = '#76243f';
    ctx.beginPath();
    ctx.ellipse(96, 58, 44, 28, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#c65b7e';
    ctx.beginPath();
    ctx.ellipse(96, 58, 44, 28, 0, 0, Math.PI * 2);
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.moveTo(60, 64);
    ctx.quadraticCurveTo(96, 38, 132, 64);
    ctx.quadraticCurveTo(96, 80, 60, 64);
    ctx.stroke();
  }
  return canvas.toDataURL('image/png');
}

function createClothesTexture(kind: 'sailor' | 'casual'): string {
  const [canvas, ctx] = createCanvas(512, 320);
  ctx.clearRect(0, 0, 512, 320);
  if (kind === 'sailor') {
    ctx.fillStyle = '#e7f0ff';
    ctx.fillRect(86, 60, 340, 220);
    ctx.fillStyle = '#1f4d8a';
    ctx.beginPath();
    ctx.moveTo(128, 88);
    ctx.lineTo(256, 192);
    ctx.lineTo(384, 88);
    ctx.lineTo(352, 74);
    ctx.lineTo(256, 150);
    ctx.lineTo(160, 74);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#e94560';
    ctx.beginPath();
    ctx.arc(256, 176, 18, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.fillStyle = '#f3d9c5';
    ctx.fillRect(96, 72, 320, 208);
    ctx.fillStyle = '#8ecae6';
    ctx.fillRect(148, 92, 216, 168);
    ctx.fillStyle = '#ffffffaa';
    ctx.fillRect(178, 124, 156, 18);
  }
  return canvas.toDataURL('image/png');
}

function createAccessoryTexture(kind: 'cat' | 'bow' | 'none'): string {
  if (kind === 'none') return TRANSPARENT_PNG;
  const [canvas, ctx] = createCanvas(320, 192);
  ctx.clearRect(0, 0, 320, 192);
  if (kind === 'cat') {
    ctx.fillStyle = '#2f3f66';
    ctx.beginPath();
    ctx.moveTo(30, 160);
    ctx.lineTo(86, 38);
    ctx.lineTo(142, 160);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(178, 160);
    ctx.lineTo(234, 38);
    ctx.lineTo(290, 160);
    ctx.closePath();
    ctx.fill();
  } else {
    ctx.fillStyle = '#e94560';
    ctx.beginPath();
    ctx.moveTo(84, 112);
    ctx.quadraticCurveTo(42, 80, 84, 50);
    ctx.quadraticCurveTo(132, 72, 150, 112);
    ctx.quadraticCurveTo(132, 152, 84, 174);
    ctx.quadraticCurveTo(42, 144, 84, 112);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(236, 112);
    ctx.quadraticCurveTo(278, 80, 236, 50);
    ctx.quadraticCurveTo(188, 72, 170, 112);
    ctx.quadraticCurveTo(188, 152, 236, 174);
    ctx.quadraticCurveTo(278, 144, 236, 112);
    ctx.fill();
    ctx.fillStyle = '#ff8fab';
    ctx.beginPath();
    ctx.arc(160, 112, 18, 0, Math.PI * 2);
    ctx.fill();
  }
  return canvas.toDataURL('image/png');
}

function createPart(id: string, slot: string, texture: string, mesh = createRectMesh(0, 0, 64, 64), zIndex = 0): PartDef {
  return {
    id,
    slot,
    texture,
    mesh,
    deformers: [],
    zIndex,
  };
}

let cachedCatalog: AssetCatalog | null = null;

export function getAssetCatalog(): AssetCatalog {
  if (cachedCatalog) return cachedCatalog;

  const faceMesh = createRectMesh(0, 0, 360, 390);
  const hairFrontMesh = createRectMesh(0, 72, 430, 280);
  const hairBackMesh = createRectMesh(0, 42, 470, 430);
  const eyeLeftMesh = createRectMesh(-74, 44, 96, 48);
  const eyeRightMesh = createRectMesh(74, 44, 96, 48);
  const mouthMesh = createRectMesh(0, -76, 120, 70);
  const clothesMesh = createRectMesh(0, -224, 360, 220);
  const accessoriesMesh = createRectMesh(0, 168, 220, 130);
  const zero = new Float32Array(8);
  const eyeCloseDelta = new Float32Array([0, 18, 0, 18, 0, -18, 0, -18]);

  const allParts: PartDef[] = [
    createPart('face_round', 'face', createFaceTexture('round', '#ffe4d1', '#f5c4aa'), faceMesh),
    createPart('face_oval', 'face', createFaceTexture('oval', '#ffd9c4', '#efb58f'), faceMesh),

    createPart(
      'hair_back_short',
      'hair_back',
      createHairTexture('short', 'back', '#1f3c88', '#122652'),
      hairBackMesh,
    ),
    createPart(
      'hair_back_long',
      'hair_back',
      createHairTexture('long', 'back', '#8a2be2', '#5a1b95'),
      hairBackMesh,
    ),
    createPart(
      'hair_back_twintail',
      'hair_back',
      createHairTexture('twintail', 'back', '#ff7f50', '#bb4f2f'),
      hairBackMesh,
    ),
    createPart(
      'hair_front_short',
      'hair_front',
      createHairTexture('short', 'front', '#2f56b2', '#1f3c88'),
      hairFrontMesh,
      1,
    ),
    createPart(
      'hair_front_long',
      'hair_front',
      createHairTexture('long', 'front', '#9f49f6', '#7c34c7'),
      hairFrontMesh,
      1,
    ),
    createPart(
      'hair_front_twintail',
      'hair_front',
      createHairTexture('twintail', 'front', '#ff9966', '#e86d2d'),
      hairFrontMesh,
      1,
    ),

    {
      ...createPart('eyes_left_round', 'eyes_left', createEyeTexture('round', '#4c6ef5'), eyeLeftMesh),
      deformers: [
        {
          parameterId: 'ParamEyeLOpen',
          keyforms: [
            { paramValue: 0, vertexDeltas: eyeCloseDelta },
            { paramValue: 1, vertexDeltas: zero },
          ],
        },
        {
          parameterId: 'ParamAngleX',
          keyforms: [
            { paramValue: -30, vertexDeltas: createQuadDelta(-10, 6, 0, 0) },
            { paramValue: 0, vertexDeltas: zero },
            { paramValue: 30, vertexDeltas: createQuadDelta(6, -10, 0, 0) },
          ],
        },
        {
          parameterId: 'ParamAngleY',
          keyforms: [
            { paramValue: -30, vertexDeltas: createQuadDelta(0, 0, -6, 5) },
            { paramValue: 0, vertexDeltas: zero },
            { paramValue: 30, vertexDeltas: createQuadDelta(0, 0, 5, -6) },
          ],
        },
        {
          parameterId: 'ParamAngleZ',
          keyforms: [
            { paramValue: -30, vertexDeltas: createTiltDelta(-4) },
            { paramValue: 0, vertexDeltas: zero },
            { paramValue: 30, vertexDeltas: createTiltDelta(4) },
          ],
        },
      ],
    },
    {
      ...createPart('eyes_left_cat', 'eyes_left', createEyeTexture('cat', '#2ec4b6'), eyeLeftMesh),
      deformers: [
        {
          parameterId: 'ParamEyeLOpen',
          keyforms: [
            { paramValue: 0, vertexDeltas: eyeCloseDelta },
            { paramValue: 1, vertexDeltas: zero },
          ],
        },
      ],
    },
    {
      ...createPart('eyes_left_sleepy', 'eyes_left', createEyeTexture('sleepy', '#f59f00'), eyeLeftMesh),
      deformers: [
        {
          parameterId: 'ParamEyeLOpen',
          keyforms: [
            { paramValue: 0, vertexDeltas: eyeCloseDelta },
            { paramValue: 1, vertexDeltas: zero },
          ],
        },
      ],
    },
    {
      ...createPart('eyes_right_round', 'eyes_right', createEyeTexture('round', '#4c6ef5'), eyeRightMesh),
      deformers: [
        {
          parameterId: 'ParamEyeROpen',
          keyforms: [
            { paramValue: 0, vertexDeltas: eyeCloseDelta },
            { paramValue: 1, vertexDeltas: zero },
          ],
        },
        {
          parameterId: 'ParamAngleX',
          keyforms: [
            { paramValue: -30, vertexDeltas: createQuadDelta(-6, 10, 0, 0) },
            { paramValue: 0, vertexDeltas: zero },
            { paramValue: 30, vertexDeltas: createQuadDelta(10, -6, 0, 0) },
          ],
        },
        {
          parameterId: 'ParamAngleY',
          keyforms: [
            { paramValue: -30, vertexDeltas: createQuadDelta(0, 0, -6, 5) },
            { paramValue: 0, vertexDeltas: zero },
            { paramValue: 30, vertexDeltas: createQuadDelta(0, 0, 5, -6) },
          ],
        },
        {
          parameterId: 'ParamAngleZ',
          keyforms: [
            { paramValue: -30, vertexDeltas: createTiltDelta(-4) },
            { paramValue: 0, vertexDeltas: zero },
            { paramValue: 30, vertexDeltas: createTiltDelta(4) },
          ],
        },
      ],
    },
    {
      ...createPart('eyes_right_cat', 'eyes_right', createEyeTexture('cat', '#2ec4b6'), eyeRightMesh),
      deformers: [
        {
          parameterId: 'ParamEyeROpen',
          keyforms: [
            { paramValue: 0, vertexDeltas: eyeCloseDelta },
            { paramValue: 1, vertexDeltas: zero },
          ],
        },
      ],
    },
    {
      ...createPart('eyes_right_sleepy', 'eyes_right', createEyeTexture('sleepy', '#f59f00'), eyeRightMesh),
      deformers: [
        {
          parameterId: 'ParamEyeROpen',
          keyforms: [
            { paramValue: 0, vertexDeltas: eyeCloseDelta },
            { paramValue: 1, vertexDeltas: zero },
          ],
        },
      ],
    },

    {
      ...createPart('mouth_smile', 'mouth', createMouthTexture('smile', '#d1547d'), mouthMesh),
      deformers: [
        {
          parameterId: 'ParamMouthOpenY',
          keyforms: [
            { paramValue: 0, vertexDeltas: zero },
            { paramValue: 1, vertexDeltas: createQuadDelta(0, 0, -8, 12) },
          ],
        },
      ],
    },
    {
      ...createPart('mouth_open', 'mouth', createMouthTexture('open', '#c84f78'), mouthMesh),
      deformers: [
        {
          parameterId: 'ParamMouthOpenY',
          keyforms: [
            { paramValue: 0, vertexDeltas: createQuadDelta(0, 0, 14, -12) },
            { paramValue: 1, vertexDeltas: zero },
          ],
        },
      ],
    },
    {
      ...createPart('mouth_pout', 'mouth', createMouthTexture('pout', '#cb507f'), mouthMesh),
      deformers: [
        {
          parameterId: 'ParamMouthOpenY',
          keyforms: [
            { paramValue: 0, vertexDeltas: zero },
            { paramValue: 1, vertexDeltas: createQuadDelta(0, 0, -6, 10) },
          ],
        },
      ],
    },

    createPart('clothes_sailor', 'clothes', createClothesTexture('sailor'), clothesMesh),
    createPart('clothes_casual', 'clothes', createClothesTexture('casual'), clothesMesh),

    createPart('accessory_cat_ears', 'accessories', createAccessoryTexture('cat'), accessoriesMesh),
    createPart('accessory_bow', 'accessories', createAccessoryTexture('bow'), accessoriesMesh),
    createPart('accessory_none', 'accessories', createAccessoryTexture('none'), accessoriesMesh),
  ];

  const slots: SlotInfo[] = [
    { id: 'face', label: '脸型', partIds: ['face_round', 'face_oval'] },
    { id: 'hair_back', label: '后发', partIds: ['hair_back_short', 'hair_back_long', 'hair_back_twintail'] },
    { id: 'hair_front', label: '前发', partIds: ['hair_front_short', 'hair_front_long', 'hair_front_twintail'] },
    { id: 'eyes_left', label: '左眼', partIds: ['eyes_left_round', 'eyes_left_cat', 'eyes_left_sleepy'] },
    { id: 'eyes_right', label: '右眼', partIds: ['eyes_right_round', 'eyes_right_cat', 'eyes_right_sleepy'] },
    { id: 'mouth', label: '嘴型', partIds: ['mouth_smile', 'mouth_open', 'mouth_pout'] },
    { id: 'clothes', label: '服装', partIds: ['clothes_sailor', 'clothes_casual'] },
    { id: 'accessories', label: '配饰', partIds: ['accessory_none', 'accessory_cat_ears', 'accessory_bow'] },
  ];

  const defaultParts: Record<string, string> = {
    face: 'face_round',
    hair_back: 'hair_back_short',
    hair_front: 'hair_front_short',
    eyes_left: 'eyes_left_round',
    eyes_right: 'eyes_right_round',
    mouth: 'mouth_smile',
    clothes: 'clothes_sailor',
    accessories: 'accessory_none',
  };

  cachedCatalog = { slots, allParts, defaultParts };
  return cachedCatalog;
}

export function createCharacterDefFromSelection(
  name: string,
  catalog: AssetCatalog,
  selectedParts: Record<string, string>,
): CharacterDef {
  const partMap = new Map(catalog.allParts.map((part) => [part.id, part]));
  const orderedSlots = [
    { slotId: 'hair_back', zIndex: 0 },
    { slotId: 'face', zIndex: 10 },
    { slotId: 'eyes_left', zIndex: 20 },
    { slotId: 'eyes_right', zIndex: 21 },
    { slotId: 'mouth', zIndex: 30 },
    { slotId: 'hair_front', zIndex: 40 },
    { slotId: 'accessories', zIndex: 50 },
    { slotId: 'clothes', zIndex: -10 },
  ];
  const parts: PartDef[] = [];

  for (const slot of catalog.slots) {
    const picked = selectedParts[slot.id] ?? catalog.defaultParts[slot.id] ?? slot.partIds[0];
    const part = partMap.get(picked);
    if (part) parts.push(part);
  }

  return {
    meta: {
      name,
      version: '1.0.0',
      width: 512,
      height: 512,
    },
    skeleton: {
      bones: [
        {
          id: 'root',
          name: 'root',
          parentId: null,
          localTransform: {
            pos: { x: 0, y: 0 },
            rotation: 0,
            scale: { x: 1, y: 1 },
          },
          length: 0,
        },
      ],
    },
    parameters: [
      { id: 'ParamEyeLOpen', name: 'EyeL', min: 0, max: 1, default: 1, group: 'eye' },
      { id: 'ParamEyeROpen', name: 'EyeR', min: 0, max: 1, default: 1, group: 'eye' },
      { id: 'ParamMouthOpenY', name: 'Mouth', min: 0, max: 1, default: 0, group: 'mouth' },
      { id: 'ParamBreath', name: 'Breath', min: 0, max: 1, default: 0.5, group: 'body' },
      { id: 'ParamAngleX', name: 'AngleX', min: -30, max: 30, default: 0, group: 'face' },
      { id: 'ParamAngleY', name: 'AngleY', min: -30, max: 30, default: 0, group: 'face' },
      { id: 'ParamAngleZ', name: 'AngleZ', min: -30, max: 30, default: 0, group: 'face' },
    ],
    drawOrder: orderedSlots,
    parts,
    animations: [
      {
        name: 'talk',
        duration: 1.1,
        loop: true,
        tracks: [
          {
            targetType: 'parameter',
            targetId: 'ParamMouthOpenY',
            property: 'value',
            keyframes: [
              { time: 0, value: 0.05 },
              { time: 0.2, value: 0.75 },
              { time: 0.45, value: 0.1 },
              { time: 0.7, value: 0.85 },
              { time: 1.1, value: 0.05 },
            ],
          },
        ],
      },
    ],
    physics: [],
  };
}
