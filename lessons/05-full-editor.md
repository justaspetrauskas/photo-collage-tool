# Lesson 5 — The Full Editor: Wiring It All Together

> **Goal:** See how the layout engine, interaction system, canvas renderer, Zustand store, and React components combine into a working editor — and understand *why* each piece is designed the way it is.

---

## The big picture

```
User
  │  uploads files / clicks / drags
  ▼
CollageEditor.tsx          ← top-level React component
  │
  ├── useCollageEditor()   ← all business logic lives here (hook)
  │     │
  │     ├── useState / useRef         ← local React state
  │     ├── useEditorUIStore()        ← Zustand (drawer UI state)
  │     ├── buildPaginatedLayout()    ← layout engine
  │     ├── drawPagePreview()         ← canvas renderer
  │     ├── drag interaction modules  ← crop/move/resize/replace
  │     ├── saveSnapshot() / loadSnapshot()  ← IndexedDB persistence
  │     └── returns a flat object of state + handlers
  │
  ├── CollagePreview        ← the <canvas> element + page tabs
  ├── CollageHeader         ← top bar
  └── ImageDrawer           ← side panel: image list + scene controls
```

The hook is the **single source of truth**. Components receive everything they need as props and call handler functions returned by the hook. They hold no state of their own.

---

## `useCollageEditor` — anatomy of the hook

The hook is large (~600 lines), but its structure is straightforward once you see the pattern.

### 1. State declarations

```ts
const [images, setImages]           = useState<ImageItem[]>([]);
const [pages, setPages]             = useState<PageLayout[]>([]);
const [maxImageCm, setMaxImageCm]   = useState(DEFAULT_MAX_IMAGE_CM);
const [interactionMode, ...]        = useState<InteractionMode>('crop');
const [selectedImageId, ...]        = useState<string | null>(null);
// ... ~20 more useState calls
```

All editor state lives here. Zustand is only used for the **drawer UI** — image zoom levels and pan offsets that are purely visual and don't affect the layout.

```ts
const { drawerSelectedImageId, setDrawerSelectedImageId,
        imageZoomLevels, imagePanOffsets } = useEditorUIStore();
```

### 2. Refs (mutable, no re-render)

```ts
const previewCanvasRef   = useRef<HTMLCanvasElement | null>(null);
const previewTransformRef = useRef<PreviewTransform | null>(null);
const dragStateRef        = useRef<DragState | null>(null);
```

`dragStateRef` stores the drag state during mouse events. It's a ref, not state — updating it during `mousemove` must **not** trigger a React re-render (that would be hundreds of renders per second). The canvas is redrawn imperatively by the `useEffect` that watches all visible state.

### 3. Derived memos

```ts
const itemById  = useMemo(() => new Map(images.map(img => [img.id, img])),  [images]);
const imageById = useMemo(() => new Map(images.map(img => [img.id, img.bitmap])), [images]);
```

`itemById` and `imageById` are passed to the renderer. Memoised so the canvas `useEffect` doesn't re-run when unrelated state changes.

---

## The canvas rendering loop

```ts
useEffect(() => {
  const canvas = previewCanvasRef.current;
  if (!canvas || !selectedPage) return;

  previewTransformRef.current = drawPagePreview(
    canvas,
    selectedPage,
    itemById,
    imageById,
    {
      gridEnabled: gridModeEnabled,
      selectedImageId,
      hoveredImageId,
      interactionMode,
      dragActive,
      swapAnimation,
      replacePointer,
      // ... many more options
    },
  );
}, [selectedPage, itemById, imageById, gridModeEnabled, selectedImageId, ...]);
```

Every time any piece of visible state changes, React re-runs this effect and redraws the canvas. The canvas is **not** managed as a React component — it's an escape hatch that `drawPagePreview` writes to directly.

### What `drawPagePreview` does

1. **Resize the canvas** to fit the screen (respects `devicePixelRatio` for sharp rendering on retina displays).
2. **Scale the page** to fit inside the canvas with a margin, computing a `PreviewTransform` (scale + offset).
3. **Call `drawPage`** — iterates `page.items`, looks up each bitmap in `imageById`, clips to the content area, and draws the image with the current crop offset and zoom.
4. **Overlay decorations** — selected image highlight, hover ring, resize feedback, replace animation arrows, etc.

### `PreviewTransform`

```ts
export interface PreviewTransform {
  dpr: number;
  scale: number;    // canvas pixels per page pixel
  offsetX: number;  // canvas x where the page starts
  offsetY: number;  // canvas y where the page starts
}
```

This is saved in `previewTransformRef`. Mouse events on the canvas use it to convert `(clientX, clientY)` back into page coordinates:

```ts
const pageX = (e.clientX - rect.left) * dpr / scale - offsetX / scale;
```

---

## Mouse event handling

All three canvas events funnelled into the hook:

```ts
onMouseDown={editor.onCanvasMouseDown}
onMouseMove={editor.onCanvasMouseMove}
onMouseUp={editor.onCanvasMouseUp}
```

### `onCanvasMouseDown`

1. Convert `clientX/Y` → page coordinates using `previewTransformRef`.
2. Hit-test: find which `PositionedImage` was clicked by checking if the point is inside its bounding box.
3. Create the right `DragState` and store it in `dragStateRef.current`.
4. Set `dragActive = true`.

### `onCanvasMouseMove`

1. If `dragStateRef.current` is null, only update `hoveredImageId`.
2. Otherwise, narrow the drag state with a type guard and call the appropriate function:

```ts
if (isCropDrag(dragStateRef.current)) {
  const { offsetX, offsetY } = calculateCropOffsets(...);
  updateImage(imageId, { offsetX, offsetY });
}

if (isMoveDrag(dragStateRef.current)) {
  const { x, y } = calculateNewPosition(...);
  // update page layout directly
}

if (isResizeDrag(dragStateRef.current)) {
  const resolved = resolvePushLayout(items, anchorIndex, newRect, axis);
  if (resolved) setPages(/* updated pages */);
}
```

### `onCanvasMouseUp`

Finalise or discard:
- **crop / resize**: state is already committed on each `mousemove`, nothing extra to do.
- **move**: if `isPositionOutsideCanvas()`, remove the image from the page.
- **replace**: if pointer is over another image, swap positions + trigger swap animation.
- Clear `dragStateRef.current` and `setDragActive(false)`.

---

## Persistence with IndexedDB

```ts
// src/features/collage/lib/persistence.ts
export async function loadSnapshot(): Promise<PersistedEditorSnapshot | null>
export async function saveSnapshot(snapshot: PersistedEditorSnapshot): Promise<void>
export async function clearSnapshot(): Promise<void>
```

**Loading** (once, on mount):

```ts
useEffect(() => {
  async function hydrateFromIndexedDb() {
    const snapshot = await loadSnapshot();
    if (!snapshot) return;
    // re-create HTMLImageElement for each saved Blob
    const hydratedImages = await Promise.all(
      snapshot.images.map(saved => blobToImage(saved.sourceBlob))
    );
    setImages(hydratedImages);
    setPages(snapshot.pages);
    // restore all settings...
    setIsHydrated(true);
  }
  void hydrateFromIndexedDb();
}, []);
```

**Saving** (debounced, after every state change):

```ts
useEffect(() => {
  if (!isHydrated) return; // don't save before we've loaded

  const timeoutId = window.setTimeout(async () => {
    const snapshot = buildSnapshot(images, pages, settings);
    await saveSnapshot(snapshot);
  }, 500);                  // 500 ms debounce

  return () => window.clearTimeout(timeoutId);
}, [isHydrated, images, pages, /* all settings */]);
```

The 500 ms debounce means the save happens 500 ms after the user *stops* interacting, not on every single pixel of a drag.

---

## Zustand store — when and why

```ts
// src/features/collage/store/editorUIStore.ts
export const useEditorUIStore = create<EditorUIState>((set) => ({
  drawerSelectedImageId: null,
  imageZoomLevels: {},
  imagePanOffsets: {},
  // setters...
}));
```

Zustand is used **only** for UI state that:
- Is shared between components that don't have a direct parent/child relationship (drawer ↔ canvas).
- Does not need to be persisted.
- Is read frequently (the canvas re-render effect includes it).

Everything else lives in `useCollageEditor`'s `useState`.

---

## Component tree

```
CollageEditor
├── CollageHeader                    ← branding, no state
├── CollagePreview                   ← <canvas> + page pagination tabs
│   └── <canvas ref={previewCanvasRef}>
└── ImageDrawer                      ← side panel
    ├── CollageControls              ← sliders: max/min size, frame, grid
    └── CollageImageList             ← thumbnail list of uploaded images
```

All components are **controlled** — they receive values and callbacks as props. None call `useCollageEditor` directly; that would scatter the business logic.

---

## React Context — prepared, not yet wired

`src/features/collage/context/CollageEditorContext.tsx` defines a full context type and provider but is not yet in use. The current setup passes everything from `useCollageEditor()` as props.

The context is prepared for when the component tree grows deep enough that prop drilling becomes painful. The migration is straightforward:
1. Wrap `CollageEditor` with `<CollageEditorProvider value={editor}>`.
2. Replace `props.xxx` calls inside deep components with `useCollageEditorContext().xxx`.

---

## End-to-end flow: uploading a photo

1. User drops a file on the canvas or clicks "Upload".
2. `onUploadFiles` in `useCollageEditor` reads the `File`, creates an object URL, loads it into an `HTMLImageElement` via `fileToImage()`.
3. A new `ImageItem` is added to `images` state.
4. A `useEffect` watching `images` calls `buildPaginatedLayout()` and updates `pages`.
5. The canvas `useEffect` fires and calls `drawPagePreview()`.
6. The debounced save effect fires 500 ms later and writes the snapshot to IndexedDB.

---

## Summary: the architecture at a glance

| Layer | File(s) | Knows about |
|---|---|---|
| Constants | `model/constants.ts` | Physical units |
| Types | `model/types.ts` | Data shapes |
| Pure math | `shared/math/` | Geometry |
| Drag state | `shared/drag/` | Type-safe drag |
| Layout | `model/layoutEngine.ts` | Rectangle packing |
| Render | `model/renderEngine.ts` | Canvas drawing |
| Interactions | `interactions/*.ts` | Per-mode drag logic |
| Persistence | `lib/persistence.ts` | IndexedDB |
| Logic hook | `hooks/useCollageEditor.ts` | Orchestrates all of the above |
| UI store | `store/editorUIStore.ts` | Drawer UI state |
| Components | `components/*.tsx` | React rendering |

The key insight: **each layer only knows about the layer below it**. The components know nothing about the canvas. The canvas renderer knows nothing about React. The interaction modules know nothing about IndexedDB. This separation makes every piece testable and replaceable in isolation.

---

## Congratulations

You've now seen the full stack:

1. **[Lesson 1](./01-project-overview.md)** — Project structure and entry point  
2. **[Lesson 2](./02-data-model.md)** — Types and constants  
3. **[Lesson 3](./03-layout-engine.md)** — Rectangle packing  
4. **[Lesson 4](./04-interaction-system.md)** — Drag interactions and discriminated unions  
5. **Lesson 5** (this one) — Full editor orchestration  

A good next exercise: add a fifth interaction mode — for example, **rotate**. Follow the checklist in Lesson 4 and you'll touch exactly seven well-scoped locations, nothing more.
