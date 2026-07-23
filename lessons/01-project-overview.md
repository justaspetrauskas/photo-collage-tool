# Lesson 1 — Project Overview & Entry Point

> **Goal:** Understand what this project does, how it starts up, and how its files are organised — before reading a single line of business logic.

---

## What are we building?

This is a **print-ready photo collage generator** that runs entirely in the browser.

A user:
1. Uploads photos.
2. The app automatically packs them onto one or more A4-sized pages (think: a smart rectangle packer).
3. Each image can be cropped, resized, moved, or swapped with another image using direct canvas interactions.
4. The finished layout can be exported as a high-resolution image ready for printing.

---

## Tech stack at a glance

| Layer | Technology |
|---|---|
| UI framework | React 19 |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Build tool | Vite |
| State (UI) | Zustand |
| Persistence | IndexedDB via `idb` |
| Layout packing | `maxrects-packer` |
| Rendering | HTML `<canvas>` |

---

## How the app boots

Open `index.html` — it has a single `<div id="root">` and loads `src/main.tsx`.

```tsx
// src/main.tsx
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './app/App';
import './styles.css';

createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
```

`App.tsx` is intentionally thin — it just renders the single feature:

```tsx
// src/app/App.tsx
import { CollageEditor } from '../features/collage/CollageEditor';

export default function App() {
  return <CollageEditor />;
}
```

**Why keep App.tsx this thin?** Because it acts as a *composition root* — the place where you'd wire up global providers (routing, auth, theming) without mixing them with business logic. Right now there's only one feature, so it's a one-liner.

---

## Folder structure

```
src/
├── app/                    ← composition root (App.tsx)
├── features/
│   └── collage/            ← the only feature today
│       ├── CollageEditor.tsx       ← top-level component
│       ├── components/             ← pure UI components
│       ├── context/                ← React Context (prepared, not yet wired)
│       ├── hooks/                  ← business-logic hooks
│       ├── interactions/           ← one module per interaction mode
│       ├── lib/                    ← file loading, persistence
│       ├── model/                  ← pure functions & types (no React)
│       └── store/                  ← Zustand stores
├── shared/
│   ├── drag/               ← unified drag-state types
│   ├── math/               ← geometric & sizing utilities
│   └── ui/                 ← reusable Button, Field, Panel components
├── main.tsx
└── styles.css
```

### The three zones

| Zone | Rule |
|---|---|
| `model/` | **Zero React.** Pure TypeScript functions and types only. |
| `shared/` | Generic utilities reused by multiple features. |
| `features/collage/` | Everything specific to the collage feature. |

This separation makes the pure logic easy to test in isolation and keeps React components free of math.

---

## Key conventions to notice

- **`model/` has no React imports** — it is framework-agnostic.
- **`interactions/` has one file per drag mode** — crop, move, resize, replace. Adding a new mode means adding a new file, not editing existing ones.
- **`shared/math/` and `shared/drag/`** expose named exports consumed by both the model layer and the hook layer.
- Components in `components/` receive all data via props — they hold no state of their own.

---

## Try it

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173), upload a few photos, and watch the packer place them automatically.

---

## What's next?

In [Lesson 2](./02-data-model.md) we look at the **data model** — the types and constants that every other file builds on.
