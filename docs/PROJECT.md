# Project

## Overview

Photo Collage Tool is a local-first collage editor for building print-ready pages from uploaded images. The current app uses React, TypeScript, Vite, Konva, and IndexedDB persistence.

## Current Status

The application is actively under development and the codebase currently includes:

- Konva-based preview rendering
- Multi-page editing with auto and assisted pagination
- Crop, move, resize, replace, and manual placement workflows
- Per-image enhancement and original-image restore support
- Local project hydration and autosave through IndexedDB
- ZIP-based PNG/JPEG export
- A refactored editor hook split into smaller hooks under `src/features/collage/hooks/editor/`

## Tech Stack

- React 19
- TypeScript 6
- Vite 8
- Konva 10 + react-konva
- Zustand
- `idb`
- `jszip`
- `lucide-react`

## Current Folder Layout

```text
src/
├── app/
├── features/
│   └── collage/
│       ├── CollageEditor.tsx
│       ├── components/
│       ├── hooks/
│       │   ├── collageEditorUtils.ts
│       │   └── editor/
│       ├── interactions/
│       ├── lib/
│       ├── model/
│       └── store/
└── shared/
```

## Feature Summary

### Editing
- Upload images into the library
- Place images manually or through layout generation
- Move, crop, resize, and replace placed images
- Use keyboard shortcuts for common editor actions

### Layout
- Auto or assisted pagination
- Collision-aware layout generation
- Per-page rendering with shared sizing logic
- Center-based resize behavior for +/- controls

### Preview
- Konva-based canvas preview
- Selection, hover, cursor, and handle feedback
- Label placement in the upper-left corner of images

### Persistence
- IndexedDB-backed hydration and autosave
- Restores saved projects on reload
- Persists enhanced images when available

### Export
- Render pages to downloadable assets
- Package PNG/JPEG pages into a ZIP archive

## Scripts

```bash
npm run dev
npm run build
npm run preview
npm run typecheck
npm run lint
npm run test
```

## Development Notes

- Keep editor behavior in the smaller hooks under `src/features/collage/hooks/editor/`.
- Keep pure math and interaction helpers inside `src/shared/` and `src/features/collage/interactions/`.
- Treat the preview as Konva-first; avoid reintroducing imperative canvas drawing.
