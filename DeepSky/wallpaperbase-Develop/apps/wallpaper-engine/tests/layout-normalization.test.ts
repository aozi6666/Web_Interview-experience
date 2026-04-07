import { describe, expect, it } from 'vitest';

import { parseAnglesVector3, parseScaleVector3 } from 'formats/we/LoaderUtils';
import { createImageLayer } from 'moyu-engine/scenario/layers/ImageLayer';

describe('layout vector normalization', () => {
  it('parses scale from 2-component string/object and fills z=1', () => {
    expect(parseScaleVector3('2 3')).toEqual([2, 3, 1]);
    expect(parseScaleVector3({ value: [4, 5] })).toEqual([4, 5, 1]);
    expect(parseScaleVector3(2)).toEqual([2, 2, 2]);
  });

  it('parses angles from scalar and fills xy=0', () => {
    expect(parseAnglesVector3(30)).toEqual([0, 0, 30]);
    expect(parseAnglesVector3('0 0 45')).toEqual([0, 0, 45]);
  });
});

describe('image alignment to anchor mapping', () => {
  it('maps alignment string to anchor consistently', () => {
    const topLeft = createImageLayer({
      id: 'img-top-left',
      name: 'img-top-left',
      width: 100,
      height: 100,
      x: 0,
      y: 0,
      source: 'noop',
      alignment: 'top left',
    });
    const bottomRight = createImageLayer({
      id: 'img-bottom-right',
      name: 'img-bottom-right',
      width: 100,
      height: 100,
      x: 0,
      y: 0,
      source: 'noop',
      alignment: 'bottom right',
    });
    const center = createImageLayer({
      id: 'img-center',
      name: 'img-center',
      width: 100,
      height: 100,
      x: 0,
      y: 0,
      source: 'noop',
      alignment: 'center',
    });

    expect(topLeft.transform.anchor).toEqual({ x: 0, y: 1 });
    expect(bottomRight.transform.anchor).toEqual({ x: 1, y: 0 });
    expect(center.transform.anchor).toEqual({ x: 0.5, y: 0.5 });
  });
});
