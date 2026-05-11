# Photo Collage Tool

Print-ready photo collage generator built with React, TypeScript, and Vite.

## Features

- 20×20 cm canvas at 300 DPI (`1771×1771`)
- Multi-page collage generation (auto/assisted pagination)
- Drag-and-drop image upload and placement
- Crop, move, resize, and swap interactions
- Local-first persistence with IndexedDB
- Export pages as PNG/JPG/JPEG
- Deterministic image enhancement presets

## Tech Stack

- React 19 + TypeScript
- Vite 8
- Zustand
- TailwindCSS
- IndexedDB (`idb`)
- MaxRects packing (`maxrects-packer`)

## Getting Started

```bash
npm install
npm run dev
```

## Quality Gates

```bash
npm run typecheck
npm run lint
npm run test
npm run build
```

## Project Structure

```text
src/
  app/
  features/collage/
    components/
    hooks/
    interactions/
    lib/
    model/
    store/
  shared/
    drag/
    math/
    ui/
```

## Constraints / Notes

- Intended for modern browsers with Canvas 2D support.
- State is persisted in IndexedDB under `photo-collage-tool`.
- The enhancement pipeline is deterministic and content-preserving.
