import { useEffect } from 'react';
import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import type { ImageItem } from '../../model/types';
import { elapsedTicks } from '../collageEditorUtils';

interface SwapAnimationLike {
  startedTick: number;
  durationTicks: number;
}

interface UseCollageEditorLifecycleParams {
  shouldRunAnimationLoop: boolean;
  setReplaceAnimationTick: Dispatch<SetStateAction<number>>;
  swapAnimation: SwapAnimationLike | null;
  replaceAnimationTick: number;
  clearSwapAnimation: () => void;
  interactionMoveFrameRef: MutableRefObject<number | null>;
  images: ImageItem[];
  knownImageSrcsRef: MutableRefObject<Set<string>>;
}

export function useCollageEditorLifecycle({
  shouldRunAnimationLoop,
  setReplaceAnimationTick,
  swapAnimation,
  replaceAnimationTick,
  clearSwapAnimation,
  interactionMoveFrameRef,
  images,
  knownImageSrcsRef,
}: UseCollageEditorLifecycleParams): void {
  useEffect(() => {
    if (!shouldRunAnimationLoop) {
      return;
    }

    let frameId = 0;
    const animate = () => {
      setReplaceAnimationTick((tick) => (tick + 1) % 10000);
      frameId = window.requestAnimationFrame(animate);
    };

    frameId = window.requestAnimationFrame(animate);
    return () => window.cancelAnimationFrame(frameId);
  }, [shouldRunAnimationLoop, setReplaceAnimationTick]);

  useEffect(() => {
    if (!swapAnimation) {
      return;
    }

    if (elapsedTicks(replaceAnimationTick, swapAnimation.startedTick) >= swapAnimation.durationTicks) {
      clearSwapAnimation();
    }
  }, [clearSwapAnimation, replaceAnimationTick, swapAnimation]);

  useEffect(() => {
    return () => {
      if (interactionMoveFrameRef.current !== null) {
        window.cancelAnimationFrame(interactionMoveFrameRef.current);
      }
    };
  }, [interactionMoveFrameRef]);

  useEffect(() => {
    const currentSrcs = new Set<string>();
    for (const image of images) {
      currentSrcs.add(image.src);
      currentSrcs.add(image.originalSrc);
    }
    for (const previousSrc of knownImageSrcsRef.current) {
      if (!currentSrcs.has(previousSrc) && typeof previousSrc === 'string') {
        URL.revokeObjectURL(previousSrc);
      }
    }
    knownImageSrcsRef.current = currentSrcs;
  }, [images, knownImageSrcsRef]);

  useEffect(() => {
    return () => {
      for (const src of knownImageSrcsRef.current) {
        if (typeof src === 'string') {
          URL.revokeObjectURL(src);
        }
      }
    };
  }, [knownImageSrcsRef]);
}
