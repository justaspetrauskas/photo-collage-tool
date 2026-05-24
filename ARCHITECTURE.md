# Architecture

## Overview

Photo Collage Tool is a React + TypeScript collage editor built with Vite. The current implementation uses Konva/react-konva for the preview surface, keeps editor state local-first, and splits orchestration into smaller hooks under `src/features/collage/hooks/editor/`.

## Core Stack

- React 19
- TypeScript 6
- Vite 8
- Konva 10 + react-konva
- Zustand for editor UI state
- IndexedDB via `idb`
- `jszip` for export packaging

## Current Feature Structure

```text
src/
├── app/
│   └── App.tsx
├── features/
│   └── collage/
│       ├── CollageEditor.tsx
│       ├── components/
│       ├── hooks/
│       │   ├── collageEditorUtils.ts
│       │   └── editor/
│       │       ├── useCollageEditor.ts
│       │       ├── useCollageEditorPersistence.ts
│       │       ├── useCollageEditorLayoutEffects.ts
│       │       ├── useCollageEditorLifecycle.ts
│       │       ├── useCollageInteractionEnd.ts
│       │       ├── useCollageInteractionMove.ts
│       │       ├── useCollageInteractionStart.ts
│       │       ├── useCollagePreviewInteractions.ts
│       │       ├── useCollageDerivedState.ts
│       │       ├── useCollageState.ts
│       │       ├── useCollageUIState.ts
│       │       └── useManualPlacementHandlers.ts
│       ├── interactions/
│       ├── lib/
│       ├── model/
│       └── store/
└── shared/
```

## Responsibilities

### `src/features/collage/components/`
Presentational components for the editor chrome, library panes, inspector panes, and preview.

### `src/features/collage/hooks/editor/`
Editor orchestration and behavior hooks. These are split by concern so the main editor hook stays as a facade.

### `src/features/collage/interactions/`
Pure interaction helpers for crop, move, replace, resize, zoom/pan, snapping, and cursor logic.

### `src/features/collage/model/`
Core domain logic, constants, layout generation, render helpers, and shared types.

### `src/shared/`
Reusable math, drag, UI, and utility helpers shared across the app.

## Notable Behaviors

- The collage preview is rendered with Konva instead of imperative canvas drawing.
- The editor supports crop, move, resize, replace, and manual placement workflows.
- The app persists local project state in IndexedDB and restores it on startup.
- Export is handled by rendering pages and packaging them as downloadable ZIP files.
- Resizing, layout reflow, and preview interaction logic are split into smaller hooks for maintainability.

## Validation

The project currently validates with:

```bash
npm run typecheck
npm run lint
npm test
```
