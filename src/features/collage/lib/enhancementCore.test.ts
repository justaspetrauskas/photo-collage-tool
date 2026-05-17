import { describe, expect, it } from 'vitest';

import { enhanceImageBuffer } from './enhancementCore';

function runPreset(preset: Parameters<typeof enhanceImageBuffer>[1], rgb: [number, number, number]) {
  const [r, g, b] = rgb;
  const image = enhanceImageBuffer(
    {
      data: new Uint8ClampedArray([r, g, b, 255, r, g, b, 255]),
      width: 2,
      height: 1,
    },
    preset,
  );

  return [image.data[0], image.data[1], image.data[2]] as const;
}

describe('enhanceImageBuffer', () => {
  it('keeps neutral grays neutral with the lighting preset', () => {
    const [r, g, b] = runPreset('lighting', [120, 120, 120]);

    expect(r).toBe(g);
    expect(g).toBe(b);
    expect(r).toBeGreaterThan(120);
  });

  it('reduces obvious blue casts for the lighting preset without over-warming', () => {
    const [r, , b] = runPreset('lighting', [88, 96, 148]);

    expect(b - r).toBeLessThan(60);
    expect(b).toBeGreaterThan(r);
  });

  it('warms cinematic images more aggressively than lighting', () => {
    const [lightingR, , lightingB] = runPreset('lighting', [96, 108, 152]);
    const [cinematicR, , cinematicB] = runPreset('cinematic', [96, 108, 152]);

    expect(cinematicR - cinematicB).toBeGreaterThan(lightingR - lightingB);
  });
});
