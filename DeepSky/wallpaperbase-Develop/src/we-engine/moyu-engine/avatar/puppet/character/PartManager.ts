import type { ActivePartData, PartDef } from './types';

interface SlotState {
  zIndex: number;
  partIds: string[];
  activePartId: string | null;
}

export class PartManager {
  private _slots = new Map<string, SlotState>();
  private _parts = new Map<string, PartDef>();

  registerSlot(slotId: string, zIndex: number): void {
    const current = this._slots.get(slotId);
    if (current) {
      current.zIndex = zIndex;
      return;
    }
    this._slots.set(slotId, {
      zIndex,
      partIds: [],
      activePartId: null,
    });
  }

  registerPart(part: PartDef): void {
    this._parts.set(part.id, part);
    if (!this._slots.has(part.slot)) {
      this.registerSlot(part.slot, part.zIndex);
    }
    const slot = this._slots.get(part.slot)!;
    if (!slot.partIds.includes(part.id)) {
      slot.partIds.push(part.id);
    }
    if (!slot.activePartId) {
      slot.activePartId = part.id;
    }
  }

  setActivePart(slotId: string, partId: string): void {
    const slot = this._slots.get(slotId);
    const part = this._parts.get(partId);
    if (!slot || !part || part.slot !== slotId) return;
    slot.activePartId = partId;
  }

  getActivePart(slotId: string): PartDef | null {
    const slot = this._slots.get(slotId);
    if (!slot || !slot.activePartId) return null;
    return this._parts.get(slot.activePartId) ?? null;
  }

  getAvailableParts(slotId: string): PartDef[] {
    const slot = this._slots.get(slotId);
    if (!slot) return [];
    return slot.partIds
      .map((id) => this._parts.get(id))
      .filter((part): part is PartDef => Boolean(part));
  }

  getActiveRenderParts(): ActivePartData[] {
    const out: ActivePartData[] = [];
    for (const [slotId, slot] of this._slots) {
      if (!slot.activePartId) continue;
      const part = this._parts.get(slot.activePartId);
      if (!part || part.visible === false) continue;
      out.push({ slotId, part });
    }

    out.sort((a, b) => {
      const slotA = this._slots.get(a.slotId);
      const slotB = this._slots.get(b.slotId);
      const zA = (slotA?.zIndex ?? 0) + a.part.zIndex;
      const zB = (slotB?.zIndex ?? 0) + b.part.zIndex;
      return zA - zB;
    });

    return out;
  }

  getSlotZIndex(slotId: string): number {
    return this._slots.get(slotId)?.zIndex ?? 0;
  }
}
