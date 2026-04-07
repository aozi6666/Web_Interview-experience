import type { CharacterBuildResult, CharacterDef, DrawOrderDef } from './types';

const DEFAULT_SLOT_ORDER: DrawOrderDef[] = [
  { slotId: 'body_back', zIndex: 0 },
  { slotId: 'hair_back', zIndex: 10 },
  { slotId: 'body', zIndex: 20 },
  { slotId: 'clothes', zIndex: 30 },
  { slotId: 'face', zIndex: 40 },
  { slotId: 'eyebrow', zIndex: 50 },
  { slotId: 'eyes', zIndex: 60 },
  { slotId: 'mouth', zIndex: 70 },
  { slotId: 'hair_front', zIndex: 80 },
  { slotId: 'accessories', zIndex: 90 },
];

export class CharacterBuilder {
  build(def: CharacterDef): CharacterBuildResult {
    const slotMap = new Map<string, number>();
    for (const slot of DEFAULT_SLOT_ORDER) {
      slotMap.set(slot.slotId, slot.zIndex);
    }
    for (const slot of def.drawOrder) {
      slotMap.set(slot.slotId, slot.zIndex);
    }

    const slotOrder: DrawOrderDef[] = Array.from(slotMap.entries())
      .map(([slotId, zIndex]) => ({ slotId, zIndex }))
      .sort((a, b) => a.zIndex - b.zIndex);

    return {
      slotOrder,
      parameters: def.parameters,
      parts: def.parts,
      animations: def.animations,
      physics: def.physics ?? [],
    };
  }
}
