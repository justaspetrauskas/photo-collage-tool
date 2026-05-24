# Photo Collage Tool

Print-ready collage editor built with React, TypeScript, Vite, Konva, and IndexedDB persistence.

## Current State

The app is an active collage editor with a Konva-powered preview surface, local-first persistence, and a modular hook-based editor architecture.

## Features

- Canvas-based collage editing with Konva and react-konva
- Multi-page layouts with auto or assisted pagination
- Drag-and-drop image import
- Manual placement, move, crop, resize, and replace workflows
- Smart layout generation and collision-aware resizing
- Per-image enhancement and restore-original support
- Local persistence through IndexedDB
- PNG/JPEG export through ZIP packaging

## Tech Stack

- React 19
- TypeScript 6
- Vite 8
- Konva 10 with react-konva
- Zustand for editor UI state
- IndexedDB via `idb`
- `jszip` for exports

## Project Structure

```text
src/
├── app/
├── features/collage/
│   ├── components/
│   ├── hooks/
│   │   ├── collageEditorUtils.ts
│   │   └── editor/
│   │       ├── useCollageEditor.ts
│   │       ├── useCollageEditorPersistence.ts
│   │       ├── useCollageEditorLayoutEffects.ts
│   │       ├── useCollageEditorLifecycle.ts
│   │       ├── useCollageInteractionEnd.ts
│   │       ├── useCollageInteractionMove.ts
│   │       ├── useCollageInteractionStart.ts
│   │       ├── useCollagePreviewInteractions.ts
│   │       ├── useCollageDerivedState.ts
│   │       ├── useCollageState.ts
│   │       ├── useCollageUIState.ts
│   │       └── useManualPlacementHandlers.ts
│   ├── interactions/
│   ├── lib/
│   ├── model/
│   └── store/
└── shared/
```

## Scripts

```bash
npm run dev
npm run build
npm run preview
npm run typecheck
npm run lint
npm run test
```

## Notes

- The preview is rendered through Konva rather than a custom canvas painter.
- The editor hook has been split into smaller hooks under `src/features/collage/hooks/editor/`.
- The app remains local-first; project state is saved and restored from IndexedDB.
