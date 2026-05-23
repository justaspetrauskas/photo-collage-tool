import { describe, expect, it } from 'vitest';
import { getHandleAtPoint } from './selectInteraction';

const item = {
  x: 100,
  y: 120,
  width: 160,
  height: 120,
};

describe('select interaction handle targeting', () => {
  it('treats edge drags as resize handles even between visible dots', () => {
    expect(getHandleAtPoint({ x: 180, y: 124 }, item, 10)).toBe('n');
    expect(getHandleAtPoint({ x: 258, y: 180 }, item, 10)).toBe('e');
    expect(getHandleAtPoint({ x: 180, y: 238 }, item, 10)).toBe('s');
    expect(getHandleAtPoint({ x: 102, y: 180 }, item, 10)).toBe('w');
  });

  it('treats near-border points just outside the body as resize handles', () => {
    expect(getHandleAtPoint({ x: 180, y: 115 }, item, 10)).toBe('n');
    expect(getHandleAtPoint({ x: 265, y: 180 }, item, 10)).toBe('e');
  });

  it('still prefers the nearest corner when dragging near a corner', () => {
    expect(getHandleAtPoint({ x: 96, y: 116 }, item, 10)).toBe('nw');
    expect(getHandleAtPoint({ x: 264, y: 244 }, item, 10)).toBe('se');
  });

  it('does not return a resize handle for the body center', () => {
    expect(getHandleAtPoint({ x: 180, y: 180 }, item, 10)).toBeNull();
  });
});
