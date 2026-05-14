import { openDB } from 'idb';
import type { PersistedEditorSnapshot } from '../model/types';
import { DEFAULT_CANVAS_PRESET_ID, DEFAULT_FRAME_MM, DEFAULT_MAX_IMAGE_CM, DEFAULT_MIN_IMAGE_CM } from '../model/constants';

const DB_NAME = 'photo-collage-tool';
const DB_VERSION = 1;
const STORE_NAME = 'editor-state';
const SNAPSHOT_KEY = 'active-project';

const dbPromise = openDB(DB_NAME, DB_VERSION, {
  upgrade(db) {
    if (!db.objectStoreNames.contains(STORE_NAME)) {
      db.createObjectStore(STORE_NAME);
    }
  },
});

export async function loadSnapshot(): Promise<PersistedEditorSnapshot | null> {
  const db = await dbPromise;
  const raw = (await db.get(STORE_NAME, SNAPSHOT_KEY)) ?? null;
  return normalizeSnapshot(raw);
}

export async function saveSnapshot(snapshot: PersistedEditorSnapshot): Promise<void> {
  const db = await dbPromise;
  await db.put(STORE_NAME, snapshot, SNAPSHOT_KEY);
}

export async function clearSnapshot(): Promise<void> {
  const db = await dbPromise;
  await db.delete(STORE_NAME, SNAPSHOT_KEY);
}

function normalizeSnapshot(raw: unknown): PersistedEditorSnapshot | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const snapshot = raw as Partial<PersistedEditorSnapshot> & {
    settings?: Partial<PersistedEditorSnapshot['settings']>;
  };

  if (snapshot.version !== 1 || !Array.isArray(snapshot.pages) || !Array.isArray(snapshot.images)) {
    return null;
  }

  const settings: Partial<PersistedEditorSnapshot['settings']> = snapshot.settings ?? {};
  const paginationMode = settings.paginationMode === 'assisted' ? 'assisted' : 'auto';
  const interactionMode =
    settings.interactionMode === 'resize' ||
    settings.interactionMode === 'replace' ||
    settings.interactionMode === 'move'
      ? settings.interactionMode
      : 'crop';

  return {
    version: 1,
    savedAt: typeof snapshot.savedAt === 'number' ? snapshot.savedAt : Date.now(),
    settings: {
      maxImageCm: typeof settings.maxImageCm === 'number' ? settings.maxImageCm : DEFAULT_MAX_IMAGE_CM,
      minImageCm: typeof settings.minImageCm === 'number' ? settings.minImageCm : DEFAULT_MIN_IMAGE_CM,
      frameMm: typeof settings.frameMm === 'number' ? settings.frameMm : DEFAULT_FRAME_MM,
      gridModeEnabled: Boolean(settings.gridModeEnabled),
      autoCompactPages: settings.autoCompactPages ?? true,
      paginationMode,
      interactionMode,
      assistedPageCount: typeof settings.assistedPageCount === 'number' ? settings.assistedPageCount : 1,
      selectedPageIndex: typeof settings.selectedPageIndex === 'number' ? settings.selectedPageIndex : 0,
      canvasPresetId: typeof settings.canvasPresetId === 'string' ? settings.canvasPresetId : DEFAULT_CANVAS_PRESET_ID,
      customCanvasWidthCm: typeof settings.customCanvasWidthCm === 'number' ? settings.customCanvasWidthCm : 20,
      customCanvasHeightCm: typeof settings.customCanvasHeightCm === 'number' ? settings.customCanvasHeightCm : 20,
    },
    pages: snapshot.pages,
    overflowImageIds: Array.isArray(snapshot.overflowImageIds) ? snapshot.overflowImageIds : [],
    oversizedImageIds: Array.isArray(snapshot.oversizedImageIds) ? snapshot.oversizedImageIds : [],
    images: snapshot.images,
  };
}
