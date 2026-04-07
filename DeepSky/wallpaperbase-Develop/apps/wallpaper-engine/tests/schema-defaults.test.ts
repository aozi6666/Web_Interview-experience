import { describe, expect, it } from 'vitest';
import {
  applyProfileOverlay,
  BASE_DEFAULTS_BUNDLE,
  cloneValue,
  DEFAULTS_SCHEMA,
  mergeDefaultsInPlaceBySchema,
  stripDefaultsInPlaceBySchema,
} from 'moyu-engine/defaults';

describe('SchemaDefaultsEngine', () => {
  it('applies profile overlay and ignores unknown root sections', () => {
    const resolved = applyProfileOverlay(
      BASE_DEFAULTS_BUNDLE,
      {
        layerDefaults: {
          image: {
            effectQuality: 0.5,
          },
        },
        // @ts-expect-error test unknown key behavior at runtime
        unknownSection: { a: 1 },
      },
      DEFAULTS_SCHEMA,
    );

    expect((resolved.layerDefaults.image as Record<string, unknown>).effectQuality).toBe(0.5);
    expect((resolved.layerDefaults as Record<string, unknown>).unknownSection).toBeUndefined();
  });

  it('merges and strips with schema-restricted defaults', () => {
    const defaults = cloneValue(BASE_DEFAULTS_BUNDLE.layerDefaults._common as Record<string, unknown>);
    const schema = DEFAULTS_SCHEMA.layerDefaults.fields?._common;
    const target = {
      visible: true,
      opacity: 0.8,
      runtimeTransform: { scale: { x: 1, y: 1 } },
      extraField: 42,
    } as Record<string, unknown>;

    stripDefaultsInPlaceBySchema(target, defaults, schema);
    expect(target.visible).toBeUndefined();
    expect(target.opacity).toBe(0.8);
    expect(target.extraField).toBe(42);

    mergeDefaultsInPlaceBySchema(target, defaults, schema);
    expect(target.visible).toBe(true);
    expect(target.opacity).toBe(0.8);
    expect(target.extraField).toBe(42);
  });
});
