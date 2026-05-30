import type { InteractionMode } from '../../model/types';

export interface EditorShortcutInput {
  key: string;
  metaKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
  isEditableTarget: boolean;
}

export interface EditorShortcutContext {
  hasSelection: boolean;
  showSelectionControls: boolean;
  interactionMode: InteractionMode;
  selectedPageIndex: number;
  pageCount: number;
}

export type EditorShortcutAction =
  | { type: 'select-page'; pageIndex: number }
  | { type: 'set-mode'; mode: InteractionMode }
  | { type: 'clear-selection' }
  | { type: 'expand-selected'; factor: number };

export function resolveEditorShortcut(
  input: EditorShortcutInput,
  context: EditorShortcutContext,
): EditorShortcutAction | null {
  if (input.metaKey || input.ctrlKey || input.altKey || input.isEditableTarget) {
    return null;
  }

  const key = input.key.toLowerCase();

  if (key === 'arrowdown') {
    const nextIndex = Math.min(context.pageCount - 1, context.selectedPageIndex + 1);
    return nextIndex === context.selectedPageIndex ? null : { type: 'select-page', pageIndex: nextIndex };
  }

  if (key === 'arrowup') {
    const nextIndex = Math.max(0, context.selectedPageIndex - 1);
    return nextIndex === context.selectedPageIndex ? null : { type: 'select-page', pageIndex: nextIndex };
  }

  if (key === 'escape') {
    if (context.interactionMode !== 'select') {
      return { type: 'set-mode', mode: 'select' };
    }

    if (context.hasSelection || context.showSelectionControls) {
      return { type: 'clear-selection' };
    }

    return null;
  }

  if (key === 's') {
    return { type: 'set-mode', mode: 'select' };
  }

  if (key === 'c') {
    return { type: 'set-mode', mode: 'crop' };
  }

  if (key === 'p') {
    return { type: 'set-mode', mode: 'replace' };
  }

  if (!context.hasSelection) {
    return null;
  }

  if (key === '=') {
    return { type: 'expand-selected', factor: 1.1 };
  }

  if (key === '-') {
    return { type: 'expand-selected', factor: 0.9 };
  }

  return null;
}
