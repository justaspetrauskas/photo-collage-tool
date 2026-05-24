import { describe, expect, it } from 'vitest';
import { konvaNodeIds } from './konvaNodeIds';

describe('konvaNodeIds', () => {
  it('builds stable page and image ids', () => {
    expect(konvaNodeIds.pageStage('p1')).toBe('page-stage-p1');
    expect(konvaNodeIds.page('p1')).toBe('page-p1');
    expect(konvaNodeIds.image('img-42')).toBe('image-img-42');
    expect(konvaNodeIds.imageBitmap('img-42')).toBe('image-bitmap-img-42');
  });

  it('builds overlay ids with deterministic formats', () => {
    expect(konvaNodeIds.resizeGuide(3)).toBe('resize-guide-3');
    expect(konvaNodeIds.moveOutside('img-42')).toBe('move-outside-img-42');
    expect(konvaNodeIds.moveCollision('img-42')).toBe('move-collision-img-42');
    expect(konvaNodeIds.replaceFeedback('a', 'b')).toBe('replace-feedback-a-b');
    expect(konvaNodeIds.replacePointerTooltip).toBe('replace-pointer-tooltip');
    expect(konvaNodeIds.handle('img-42', 'nw')).toBe('handle-img-42-nw');
  });
});
