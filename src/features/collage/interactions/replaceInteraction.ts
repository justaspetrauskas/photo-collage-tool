/**
 * Replace Interaction Module
 * Handles all replace/swap-related logic and state management
 */

import { rectanglesOverlap } from '../../../shared/math';
import type { PositionedImage } from '../model/types';

export interface ReplaceInteractionState {
  sourceImageId: string;
}

/**
 * Check if two positioned images can be swapped without overlaps
 */
export function canSwapImages(
  sourceSlot: PositionedImage,
  targetSlot: PositionedImage,
  otherItems: PositionedImage[],
): boolean {
  const sourceCandidate = {
    ...sourceSlot,
    x: targetSlot.x,
    y: targetSlot.y,
  };

  const targetCandidate = {
    ...targetSlot,
    x: sourceSlot.x,
    y: sourceSlot.y,
  };

  // Check if swap candidates overlap with other items
  const overlapsOthers = otherItems.some(
    (item) => rectanglesOverlap(sourceCandidate, item) || rectanglesOverlap(targetCandidate, item),
  );

  // Check if swap candidates overlap each other
  const overlapsEachOther = rectanglesOverlap(sourceCandidate, targetCandidate);

  return !overlapsOthers && !overlapsEachOther;
}
