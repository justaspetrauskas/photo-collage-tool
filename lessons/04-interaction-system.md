# Lesson 4 — Interaction System

> **Goal:** Understand how the four canvas drag modes work, how their state is represented with a discriminated union, and why each mode lives in its own module.

---

## The four interaction modes

| Mode | Hotkey | What it does |
|---|---|---|
| `crop` | default | Pan the image inside its frame |
| `move` | M | Drag the frame to a new position on the canvas |
| `resize` | R | Drag a corner to change the image's allocated size |
| `replace` | P | Drag one image onto another to swap their positions |

Only one mode is active at a time (`InteractionMode` in `types.ts`).

---

## Unified drag state — the discriminated union

Before reaching for separate `cropDragRef`, `moveDragRef`, etc., the codebase uses a **single** ref with a discriminated union type:

```ts
// src/shared/drag/types.ts
export type DragState =
  | CropDragState
  | ResizeDragState
  | ReplaceDragState
  | MoveDragState;
```

Each variant carries a `type` literal plus the data it needs:

```ts
export interface CropDragState {
  type: 'crop';
  imageId: string;
  startX: number; startY: number;        // mouse position at drag start
  baseOffsetX: number; baseOffsetY: number; // crop offset at drag start
  maxOffsetX: number; maxOffsetY: number;   // pan budget
}

export interface MoveDragState {
  type: 'move';
  imageId: string;
  startX: number; startY: number;
  baseX: number; baseY: number;           // image position at drag start
}

export interface ResizeDragState {
  type: 'resize';
  imageId: string;
  startX: number; startY: number;
  fixedHorizontal: 'left' | 'right';     // which corner is anchored
  fixedVertical: 'top' | 'bottom';
  baseMaxWidthCm: number; baseMaxHeightCm: number;
  baseX: number; baseY: number;
  baseWidth: number; baseHeight: number;
}

export interface ReplaceDragState {
  type: 'replace';
  sourceImageId: string;                  // the image being dragged
}
```

### Type guards

```ts
export function isCropDrag(state: DragState | null): state is CropDragState {
  return state?.type === 'crop';
}
// similarly: isMoveDrag, isResizeDrag, isReplaceDrag
```

**Why this is better than four separate refs:**

```ts
// ❌ Before — four refs, lots of ceremony
const cropDragRef    = useRef<CropDragState | null>(null);
const resizeDragRef  = useRef<ResizeDragState | null>(null);
// ...

if (interactionMode === 'crop' && cropDragRef.current) { ... }

// ✅ After — one ref, type-safe narrowing
const dragStateRef = useRef<DragState | null>(null);

if (isCropDrag(dragStateRef.current)) { ... }
```

TypeScript now *knows* the shape of the state inside the `if` block. No casts needed.

---

## Interaction modules

Each mode's logic lives in its own file under `src/features/collage/interactions/`:

```
interactions/
├── cropInteraction.ts
├── moveInteraction.ts
├── replaceInteraction.ts
├── resizeInteraction.ts
└── index.ts            ← re-exports everything
```

This is the **Open/Closed Principle** in practice: to add a new mode you create a new file; you don't edit existing ones.

---

## Crop interaction

```ts
// src/features/collage/interactions/cropInteraction.ts
export function calculateCropOffsets(
  startX, startY,
  currentX, currentY,
  baseOffsetX, baseOffsetY,
  maxOffsetX, maxOffsetY,
): { offsetX: number; offsetY: number } {
  const deltaX = currentX - startX;
  const deltaY = currentY - startY;

  // Dragging right → image shifts right → crop offset decreases
  return clampCropOffset(
    baseOffsetX - deltaX,
    baseOffsetY - deltaY,
    maxOffsetX,
    maxOffsetY,
  );
}
```

The negative sign is intentional — dragging the mouse to the right pans the *viewport* to the right, which means the image draws further to the *left* (its `offsetX` decreases). `clampCropOffset` from `shared/math` keeps the value within `[0, maxOffset]`.

---

## Move interaction

```ts
// src/features/collage/interactions/moveInteraction.ts
export function calculateNewPosition(startX, startY, currentX, currentY, baseX, baseY) {
  return {
    x: baseX + (currentX - startX),
    y: baseY + (currentY - startY),
  };
}
```

After each `mousemove`, the hook calls this and updates `PositionedImage.x / .y`. The canvas redraws immediately.

Two extras live here:

```ts
// Snap to canvas edges when within 18 px
export function getCanvasSnapPosition(x, y, width, height): { x, y, snapped }

// True if more than 5% of the image is outside the canvas
export function isPositionOutsideCanvas(x, y, width, height): boolean
```

If `isPositionOutsideCanvas` is true on `mouseup`, the image is *removed* from the canvas and placed in the overflow list.

---

## Resize interaction

Resize is the most complex mode. When you drag a corner:

1. **Compute the new desired dimensions** based on how far the mouse moved.
2. **Run `resolvePushLayout`** — a collision-aware algorithm that pushes neighbouring images out of the way.
3. If no valid layout exists, the resize is rejected (the image snaps back).

```ts
// src/features/collage/interactions/resizeInteraction.ts
export function resolvePushLayout(
  items: PositionedImage[],
  anchorIndex: number,
  anchorRect: { x, y, width, height },
  preferredAxis: 'x' | 'y',
): PositionedImage[] | null   // null = no valid layout
```

The algorithm is a **BFS push propagation**:
- Place the resized image at the new position.
- For every image that now overlaps, compute how far to push it right or down.
- Add pushed images to the queue — they may in turn overlap others.
- If any image would be pushed outside the canvas, return `null`.

```ts
export function getPreferredPushAxis(deltaX: number, deltaY: number): 'x' | 'y' {
  return Math.abs(deltaX) >= Math.abs(deltaY) ? 'x' : 'y';
}
```

The `preferredAxis` comes from the *direction* of the drag — if you're resizing mostly horizontally, neighbours are pushed right first.

---

## Replace interaction

```ts
// src/features/collage/interactions/replaceInteraction.ts
export function canSwapImages(
  sourceId: string,
  targetId: string,
  items: PositionedImage[],
): boolean {
  const source = items.find(i => i.imageId === sourceId);
  const target = items.find(i => i.imageId === targetId);
  return Boolean(source && target && source !== target);
}
```

On `mouseup`, if the pointer is over a *different* image, their `(x, y)` positions are swapped in the page layout. The rest of the state (frame size, crop offsets) stays the same. An animated transition plays during the swap (handled in the render engine).

---

## Life cycle of a drag

Every mouse interaction on the canvas goes through the same three-phase pattern:

```
onCanvasMouseDown
  └── identify which image was clicked (hit-test via PositionedImage bounds)
  └── set dragStateRef.current = { type: 'crop'|'move'|..., startX, startY, ... }
  └── set dragActive = true  (triggers a CSS cursor change)

onCanvasMouseMove
  └── read dragStateRef.current
  └── call the relevant calculateXxx() function
  └── call updateImage() / setPages() with new positions

onCanvasMouseUp / onCanvasMouseLeave
  └── finalise or discard the change
  └── dragStateRef.current = null
  └── dragActive = false
```

Using a `ref` (not `useState`) for the drag state is deliberate — it avoids triggering a React re-render on every pixel of mouse movement. The canvas is redrawn imperatively via `requestAnimationFrame`, bypassing React's update cycle entirely.

---

## Adding a new interaction mode

Follow these steps (nothing else changes):

1. Create `src/features/collage/interactions/rotateInteraction.ts`.
2. Export a `RotateDragState` interface with `type: 'rotate'`.
3. Export a `calculateRotationDelta()` pure function.
4. Add `RotateDragState` to the `DragState` union in `src/shared/drag/types.ts`.
5. Add `isRotateDrag()` type guard.
6. Export from `interactions/index.ts`.
7. Handle the three phases in `useCollageEditor`.

---

## What's next?

In [Lesson 5](./05-full-editor.md) we zoom out and see how all the pieces — layout engine, interactions, canvas renderer, Zustand store, and React components — are wired together into the complete editor.
