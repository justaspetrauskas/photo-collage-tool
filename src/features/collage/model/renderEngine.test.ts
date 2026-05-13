import { describe, expect, it } from 'vitest';
import { shouldShowResizeSnapGuides } from './renderEngine';

describe('render engine resize snap guide visibility', () => {
  it('shows guides only while actively resizing with available guides', () => {
    expect(
      shouldShowResizeSnapGuides({
        interactionMode: 'resize',
        dragActive: true,
        resizeSnapGuides: [{ orientation: 'vertical', value: 100, kind: 'edge' }],
      }),
    ).toBe(true);
  });

  it('hides guides when not actively resizing', () => {
    expect(
      shouldShowResizeSnapGuides({
        interactionMode: 'move',
        dragActive: true,
        resizeSnapGuides: [{ orientation: 'vertical', value: 100, kind: 'edge' }],
      }),
    ).toBe(false);

    expect(
      shouldShowResizeSnapGuides({
        interactionMode: 'resize',
        dragActive: false,
        resizeSnapGuides: [{ orientation: 'horizontal', value: 100, kind: 'size' }],
      }),
    ).toBe(false);

    expect(
      shouldShowResizeSnapGuides({
        interactionMode: 'resize',
        dragActive: true,
        resizeSnapGuides: [],
      }),
    ).toBe(false);
  });
});
