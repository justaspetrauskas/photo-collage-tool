import { describe, expect, it } from 'vitest';
import { shouldApplyAutosaveResult } from './autosaveVersioning';

describe('shouldApplyAutosaveResult', () => {
  it('applies when request is latest', () => {
    expect(shouldApplyAutosaveResult(4, 4)).toBe(true);
  });

  it('ignores stale requests', () => {
    expect(shouldApplyAutosaveResult(3, 4)).toBe(false);
  });

  it('ignores future mismatched ids', () => {
    expect(shouldApplyAutosaveResult(5, 4)).toBe(false);
  });
});
