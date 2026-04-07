export type BoneSimulationType = 'none' | 'spring' | 'rigid' | 'rope' | 'ik';

export interface BlendRuleConfig {
  targetBone: string;
  weight: number;
}

export interface BoneConstraintConfig {
  simulation: BoneSimulationType;
  physicsTranslation: boolean;
  physicsRotation: boolean;
  limitRotation: boolean;
  minAngle: number;
  maxAngle: number;
  tipForwardAngle: number;
  tipSize: number;
  tipMass: number;
  gravityEnabled: boolean;
  gravityDirection: number;
  maxTorque: number;
  limitTorque: boolean;
  maxDistance: number;
  translationalInertia: number;
  translationalFriction: number;
  translationalStiffness: number;
  rotationalInertia: number;
  rotationalFriction: number;
  rotationalStiffness: number;
  ropeElements: number;
  freeEndpoint: boolean;
  stretchEnabled: boolean;
  ikEnabled: boolean;
  ikAngleAlignment: number;
  blendRules: BlendRuleConfig[];
}

export const DEFAULT_BONE_CONSTRAINT: BoneConstraintConfig = {
  simulation: 'none',
  physicsTranslation: false,
  physicsRotation: false,
  limitRotation: false,
  minAngle: -180,
  maxAngle: 180,
  tipForwardAngle: 0,
  tipSize: 0,
  tipMass: 1,
  gravityEnabled: false,
  gravityDirection: 90,
  maxTorque: 9999,
  limitTorque: false,
  maxDistance: 0,
  translationalInertia: 0,
  translationalFriction: 0,
  translationalStiffness: 0,
  rotationalInertia: 0,
  rotationalFriction: 0,
  rotationalStiffness: 0,
  ropeElements: 0,
  freeEndpoint: false,
  stretchEnabled: true,
  ikEnabled: false,
  ikAngleAlignment: 0,
  blendRules: [],
};

const SIMULATION_ALIASES: Record<string, BoneSimulationType> = {
  none: 'none',
  spring: 'spring',
  rigid: 'rigid',
  rope: 'rope',
  kinematicchain: 'rope',
  ik: 'ik',
  inversekinematics: 'ik',
};

function toBool(v: unknown, fallback: boolean): boolean {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v !== 0;
  if (typeof v === 'string') return ['1', 'true', 'yes', 'on'].includes(v.toLowerCase());
  return fallback;
}

function toNum(v: unknown, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export function parseConstraintFromUnknown(raw: unknown): BoneConstraintConfig | null {
  if (!raw || typeof raw !== 'object') return null;
  const src = raw as Record<string, unknown>;

  const simulationRaw = String(src.simulation ?? src.mode ?? src.type ?? 'none').toLowerCase().replace(/\s+/g, '');
  const simulation = SIMULATION_ALIASES[simulationRaw] ?? DEFAULT_BONE_CONSTRAINT.simulation;

  const minAngle = toNum(src.minAngle ?? src.minangle, DEFAULT_BONE_CONSTRAINT.minAngle);
  const maxAngle = toNum(src.maxAngle ?? src.maxangle, DEFAULT_BONE_CONSTRAINT.maxAngle);
  const blendRulesRaw = Array.isArray(src.blendRules) ? src.blendRules : (Array.isArray(src.blendrules) ? src.blendrules : []);
  const blendRules: BlendRuleConfig[] = blendRulesRaw
    .map((rule): BlendRuleConfig | null => {
      if (!rule || typeof rule !== 'object') return null;
      const r = rule as Record<string, unknown>;
      const targetBone = String(r.targetBone ?? r.target ?? r.bone ?? '').trim();
      if (!targetBone) return null;
      return { targetBone, weight: toNum(r.weight, 1) };
    })
    .filter((x): x is BlendRuleConfig => !!x);

  return {
    simulation,
    physicsTranslation: toBool(src.physicsTranslation ?? src.physicstranslation, DEFAULT_BONE_CONSTRAINT.physicsTranslation),
    physicsRotation: toBool(src.physicsRotation ?? src.physicsrotation, DEFAULT_BONE_CONSTRAINT.physicsRotation),
    limitRotation: toBool(src.limitRotation ?? src.limitrotation, DEFAULT_BONE_CONSTRAINT.limitRotation),
    minAngle,
    maxAngle,
    tipForwardAngle: toNum(src.tipForwardAngle ?? src.tipforwardangle, DEFAULT_BONE_CONSTRAINT.tipForwardAngle),
    tipSize: toNum(src.tipSize ?? src.tipsize, DEFAULT_BONE_CONSTRAINT.tipSize),
    tipMass: toNum(src.tipMass ?? src.tipmass, DEFAULT_BONE_CONSTRAINT.tipMass),
    gravityEnabled: toBool(src.gravityEnabled ?? src.gravityenabled, DEFAULT_BONE_CONSTRAINT.gravityEnabled),
    gravityDirection: toNum(src.gravityDirection ?? src.gravitydirection, DEFAULT_BONE_CONSTRAINT.gravityDirection),
    maxTorque: toNum(src.maxTorque ?? src.maxtorque, DEFAULT_BONE_CONSTRAINT.maxTorque),
    limitTorque: toBool(src.limitTorque ?? src.limittorque, DEFAULT_BONE_CONSTRAINT.limitTorque),
    maxDistance: toNum(src.maxDistance ?? src.maxdistance, DEFAULT_BONE_CONSTRAINT.maxDistance),
    translationalInertia: toNum(src.translationalInertia ?? src.translationalinertia, DEFAULT_BONE_CONSTRAINT.translationalInertia),
    translationalFriction: toNum(src.translationalFriction ?? src.translationalfriction, DEFAULT_BONE_CONSTRAINT.translationalFriction),
    translationalStiffness: toNum(src.translationalStiffness ?? src.translationalstiffness, DEFAULT_BONE_CONSTRAINT.translationalStiffness),
    rotationalInertia: toNum(src.rotationalInertia ?? src.rotationalinertia, DEFAULT_BONE_CONSTRAINT.rotationalInertia),
    rotationalFriction: toNum(src.rotationalFriction ?? src.rotationalfriction, DEFAULT_BONE_CONSTRAINT.rotationalFriction),
    rotationalStiffness: toNum(src.rotationalStiffness ?? src.rotationalstiffness, DEFAULT_BONE_CONSTRAINT.rotationalStiffness),
    ropeElements: Math.max(0, Math.round(toNum(src.ropeElements ?? src.ropeelements, DEFAULT_BONE_CONSTRAINT.ropeElements))),
    freeEndpoint: toBool(src.freeEndpoint ?? src.freeendpoint, DEFAULT_BONE_CONSTRAINT.freeEndpoint),
    stretchEnabled: toBool(src.stretchEnabled ?? src.stretchenabled, DEFAULT_BONE_CONSTRAINT.stretchEnabled),
    ikEnabled: toBool(src.ikEnabled ?? src.ikenabled, simulation === 'ik'),
    ikAngleAlignment: toNum(src.ikAngleAlignment ?? src.ikanglealignment, DEFAULT_BONE_CONSTRAINT.ikAngleAlignment),
    blendRules,
  };
}
