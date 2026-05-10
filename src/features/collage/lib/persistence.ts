import { openDB } from 'idb';
import type { PersistedEditorSnapshot } from '../model/types';

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
  return (await db.get(STORE_NAME, SNAPSHOT_KEY)) ?? null;
}

export async function saveSnapshot(snapshot: PersistedEditorSnapshot): Promise<void> {
  const db = await dbPromise;
  await db.put(STORE_NAME, snapshot, SNAPSHOT_KEY);
}

export async function clearSnapshot(): Promise<void> {
  const db = await dbPromise;
  await db.delete(STORE_NAME, SNAPSHOT_KEY);
}
