import { describe, expect, it } from 'vitest';
import { resolveEditorShortcut, type EditorShortcutContext, type EditorShortcutInput } from './keyboardShortcuts';

function buildInput(overrides: Partial<EditorShortcutInput>): EditorShortcutInput {
  return {
    key: 's',
    metaKey: false,
    ctrlKey: false,
    altKey: false,
    isEditableTarget: false,
    ...overrides,
  };
}

function buildContext(overrides: Partial<EditorShortcutContext>): EditorShortcutContext {
  return {
    hasSelection: true,
    showSelectionControls: true,
    interactionMode: 'select',
    selectedPageIndex: 1,
    pageCount: 3,
    ...overrides,
  };
}

describe('resolveEditorShortcut', () => {
  it('ignores shortcuts with modifier keys', () => {
    const result = resolveEditorShortcut(buildInput({ key: 's', metaKey: true }), buildContext({}));
    expect(result).toBeNull();
  });

  it('ignores editable targets', () => {
    const result = resolveEditorShortcut(buildInput({ key: 's', isEditableTarget: true }), buildContext({}));
    expect(result).toBeNull();
  });

  it('maps arrow keys to page navigation', () => {
    const down = resolveEditorShortcut(buildInput({ key: 'ArrowDown' }), buildContext({ selectedPageIndex: 0, pageCount: 3 }));
    const up = resolveEditorShortcut(buildInput({ key: 'ArrowUp' }), buildContext({ selectedPageIndex: 2, pageCount: 3 }));
    expect(down).toEqual({ type: 'select-page', pageIndex: 1 });
    expect(up).toEqual({ type: 'select-page', pageIndex: 1 });
  });

  it('returns null when arrow key cannot move page', () => {
    const down = resolveEditorShortcut(buildInput({ key: 'ArrowDown' }), buildContext({ selectedPageIndex: 2, pageCount: 3 }));
    const up = resolveEditorShortcut(buildInput({ key: 'ArrowUp' }), buildContext({ selectedPageIndex: 0, pageCount: 3 }));
    expect(down).toBeNull();
    expect(up).toBeNull();
  });

  it('prefers switching to select mode on escape when in another mode', () => {
    const result = resolveEditorShortcut(buildInput({ key: 'Escape' }), buildContext({ interactionMode: 'crop' }));
    expect(result).toEqual({ type: 'set-mode', mode: 'select' });
  });

  it('clears selection on escape when already in select mode', () => {
    const result = resolveEditorShortcut(buildInput({ key: 'Escape' }), buildContext({ interactionMode: 'select' }));
    expect(result).toEqual({ type: 'clear-selection' });
  });

  it('does not clear selection when nothing is selected and controls are hidden', () => {
    const result = resolveEditorShortcut(
      buildInput({ key: 'Escape' }),
      buildContext({ hasSelection: false, showSelectionControls: false, interactionMode: 'select' }),
    );
    expect(result).toBeNull();
  });

  it('maps mode shortcuts regardless of current selection', () => {
    const crop = resolveEditorShortcut(buildInput({ key: 'c' }), buildContext({ hasSelection: false, showSelectionControls: false }));
    const replace = resolveEditorShortcut(buildInput({ key: 'p' }), buildContext({ hasSelection: false, showSelectionControls: false }));
    expect(crop).toEqual({ type: 'set-mode', mode: 'crop' });
    expect(replace).toEqual({ type: 'set-mode', mode: 'replace' });
  });

  it('applies zoom shortcuts only when there is selection', () => {
    const withSelection = resolveEditorShortcut(buildInput({ key: '=' }), buildContext({ hasSelection: true }));
    const withoutSelection = resolveEditorShortcut(buildInput({ key: '-' }), buildContext({ hasSelection: false }));
    expect(withSelection).toEqual({ type: 'expand-selected', factor: 1.1 });
    expect(withoutSelection).toBeNull();
  });
});
