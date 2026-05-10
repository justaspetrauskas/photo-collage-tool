# Photo Collage Tool - Project Documentation

This document outlines the project structure, architecture, and key features of the photo collage generator application.

## Project Overview

**Name:** Photo Collage Tool  
**Type:** React TypeScript Web Application  
**Purpose:** Print-ready photo collage generator with smart layout and image placement  
**Status:** Active Development

## Key Features

### ✅ Implemented

1. **Canvas Management**
   - 20×20 cm printable canvas at 300 DPI (1771×1771 px)
   - Multi-page support (auto or assisted pagination)
   - Grid overlay option for alignment

2. **Image Handling**
   - Drag-and-drop upload from sidebar
   - Manual placement on canvas with auto-sizing
   - Smart sizing: auto-fit to available canvas space
   - Image enhancement (lighting, contrast, cinematic modes)
   - Before/after toggle for enhancements

3. **Image Manipulation**
   - Crop mode: reposition visible area
   - Resize mode: scale images with corner handles
   - Move mode: reposition on canvas
   - Swap mode: exchange image positions
   - Keyboard shortcuts: R/M/P/+/- and Escape

4. **Layout & Design**
   - Avant-garde background (torn edges, rule lines, halftone dots, animated color blobs)
   - Dark theme with amber accent (#fcc515)
   - Themed frame controls (0-10mm slider)
   - Selection controls overlay with image info

5. **Data Management**
   - IndexedDB persistence (auto-save every 500ms)
   - Save/restore enhanced image versions
   - Session state preservation
   - Local-first architecture

6. **Export**
   - PNG export at canvas resolution
   - Page-by-page export
   - Print-ready output

### 🚀 In Progress / Planned

- Linear project sync and issue tracking
- Batch enhancement processing
- Advanced layout algorithms
- Custom collage templates

## Architecture

### Technology Stack

- **Frontend:** React 18 + TypeScript
- **Build:** Vite 8 + TailwindCSS 3
- **State:** Zustand (UI state, drawer zoom/pan)
- **Canvas:** 2D API with deterministic rendering
- **Persistence:** IndexedDB with blob storage
- **Gestures:** @use-gesture/react v10 (pan/drag)

### File Structure

```
src/
├── features/collage/
│   ├── hooks/
│   │   └── useCollageEditor.ts       # Central state & logic
│   ├── components/
│   │   ├── CollageEditor.tsx         # Main layout
│   │   ├── CollagePreview.tsx        # Canvas & controls
│   │   ├── CollageHeader.tsx         # Header UI
│   │   ├── ImageDrawer.tsx           # Right sidebar
│   │   └── ImageDrawerCard.tsx       # Image card component
│   ├── model/
│   │   ├── types.ts                  # TypeScript interfaces
│   │   ├── constants.ts              # App constants
│   │   ├── renderEngine.ts           # Canvas rendering
│   │   ├── layoutEngine.ts           # Layout algorithm
│   │   └── transitions.ts            # Animations
│   ├── lib/
│   │   ├── persistence.ts            # IndexedDB operations
│   │   ├── fileToImage.ts            # Image loading
│   │   └── openaiImageEdit.ts        # Enhancement logic
│   ├── store/
│   │   └── editorUIStore.ts          # Drawer UI state
│   └── interactions/
│       └── [interaction helpers]     # Event handling
└── shared/
    ├── ui/
    │   ├── Button.tsx
    │   └── Panel.tsx
    ├── math/
    │   └── [math utilities]
    └── drag/
        └── [drag logic]
```

### Key Constants

```typescript
CANVAS_CM = 20              // 20x20 cm printable area
DPI = 300                   // Print resolution
CANVAS_SIZE_PX = 1771       // Pixel dimensions
DEFAULT_FRAME_MM = 2        // Frame thickness
DEFAULT_MIN_IMAGE_CM = 2    // Minimum image size
DEFAULT_MAX_IMAGE_CM = 15   // Maximum image size
```

### Theme Colors

```
Base Dark:      #06080c (6, 8, 12)
Dark Blue:      #0a0f1a (10, 15, 26)
Paper:          #0d1119 (13, 17, 25)
Amber Accent:   #fcc515 (252, 197, 21)
Gold:           #f59e0b (245, 158, 11)
```

## Feature Details

### Smart Image Sizing

When dragging images onto the canvas:
1. Scans existing items for available space
2. Calculates horizontal space from drop point to canvas edge
3. Scales image to fit within available area
4. Maintains aspect ratio
5. Respects minimum size constraint
6. Shows live preview as drag occurs

### Image Enhancement

Deterministic, content-preserving enhancement pipeline:
- Analyzes image statistics (luminance, color temperature)
- Applies minimal pixel-level adjustments
- Supports presets: lighting, contrast, cinematic, consistent
- No generative content replacement
- Before/after toggle preservation

### Canvas Rendering

- Zoom/pan support per drawer card
- Multi-layer rendering (background, images, overlays)
- Interaction feedback (selection, hover, drag preview)
- Efficient clipping for frame support
- Theme-consistent colors (amber accent)

### Persistence

- Saves every 500ms when hydrated
- Stores enhanced image versions as blobs
- Preserves page layouts and image state
- Clears stale selection on hydration
- Fallback handling for failed restores

## Development Workflow

### Local Development

```bash
npm install
npm run dev
```

### Building

```bash
npm run build
npm run preview
```

### Key Dependencies

- react@19.2.6
- typescript@6.0.3
- vite@8.0.11
- tailwindcss@3.4.17
- zustand@5.0.13
- @use-gesture/react@10.3.1

## Project Metrics

- **Bundle Size:** ~280 KB (JS), ~88 KB (gzipped)
- **Build Time:** ~400ms
- **Components:** 15+ React components
- **State Hooks:** 20+ state variables per editor
- **Canvas Operations:** 1000+ pixel operations per frame

## Linked Linear Issues

Track development progress and bugs in Linear:

- [Photo Collage Tool Project](https://linear.app) - Main project workspace

## Contributing

- Follow existing TypeScript conventions
- Maintain dark theme aesthetic
- Test persistence and canvas rendering
- Update documentation with new features
- Commit with descriptive messages

## License

ISC

---

Last Updated: May 10, 2026  
Documentation Version: 1.0
