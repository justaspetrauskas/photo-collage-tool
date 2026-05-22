import { CheckCircle2, CircleDashed, Download, Edit3, FolderClock, LayoutTemplate, UploadCloud } from 'lucide-react';
import type { InteractionMode } from '../model/types';
import { Button } from '../../../shared/ui/Button';

type WorkflowStage = 'upload' | 'generate' | 'edit' | 'export';
type SaveState = 'idle' | 'saving' | 'saved' | 'error';

interface WorkflowStatusCardProps {
  workflowStage: WorkflowStage;
  hasImages: boolean;
  hasPlacedItems: boolean;
  hasUnplacedImages: boolean;
  selectedPageIndex: number;
  pagesCount: number;
  interactionMode: InteractionMode;
  saveState: SaveState;
  lastSavedAt: number | null;
  restoredFromSnapshot: boolean;
  isExporting: boolean;
  lastExportSummary: string;
  batchEnhanceProgress: {
    completed: number;
    total: number;
    preset: string;
  } | null;
  undoActionLabel: string | null;
  undoActionDescription: string | null;
  onGenerateLayout: () => void;
  onUndoLastAction: () => void;
}

const WORKFLOW_STEPS: Array<{
  id: WorkflowStage;
  label: string;
  icon: typeof UploadCloud;
}> = [
  { id: 'upload', label: 'Upload', icon: UploadCloud },
  { id: 'generate', label: 'Generate layout', icon: LayoutTemplate },
  { id: 'edit', label: 'Fine-tune', icon: Edit3 },
  { id: 'export', label: 'Export', icon: Download },
];

function formatTimeLabel(timestamp: number | null): string {
  if (!timestamp) {
    return 'Not saved yet';
  }

  return `Saved ${new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(timestamp)}`;
}

function getModeLabel(interactionMode: InteractionMode): string {
  switch (interactionMode) {
    case 'select':
      return 'Edit mode';
    case 'crop':
      return 'Crop mode';
    case 'replace':
      return 'Swap mode';
    case 'move':
      return 'Move mode';
    case 'resize':
      return 'Resize mode';
    default:
      return 'Edit mode';
  }
}

function getPrimaryGuidance({
  workflowStage,
  hasImages,
  hasPlacedItems,
  hasUnplacedImages,
  isExporting,
}: Pick<WorkflowStatusCardProps, 'workflowStage' | 'hasImages' | 'hasPlacedItems' | 'hasUnplacedImages' | 'isExporting'>): string {
  if (!hasImages) {
    return 'Start with one clear action: upload photos in the canvas area.';
  }
  if (hasUnplacedImages) {
    return 'Photos are ready. Generate a layout next, then fine-tune only if needed.';
  }
  if (!hasPlacedItems) {
    return 'Generate a layout to move from setup into editing.';
  }
  if (isExporting || workflowStage === 'export') {
    return 'Review the active page, then export the ZIP when you are ready to print.';
  }
  return 'Edit on the active page, then export when the collage looks right.';
}

export function WorkflowStatusCard({
  workflowStage,
  hasImages,
  hasPlacedItems,
  hasUnplacedImages,
  selectedPageIndex,
  pagesCount,
  interactionMode,
  saveState,
  lastSavedAt,
  restoredFromSnapshot,
  isExporting,
  lastExportSummary,
  batchEnhanceProgress,
  undoActionLabel,
  undoActionDescription,
  onGenerateLayout,
  onUndoLastAction,
}: WorkflowStatusCardProps) {
  const guidance = getPrimaryGuidance({
    workflowStage,
    hasImages,
    hasPlacedItems,
    hasUnplacedImages,
    isExporting,
  });

  return (
    <section className="mb-4 rounded-2xl border border-line/30 bg-[#0b1220]/80 p-4 backdrop-blur-md">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-amber-300/30 bg-amber-400/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-amber-200">
              Faster start
            </span>
            <span className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-cyan-100">
              Clear editing
            </span>
            <span className="rounded-full border border-emerald-300/20 bg-emerald-400/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-emerald-100">
              Safer actions
            </span>
          </div>

          <div>
            <p className="m-0 text-sm font-semibold text-ink">Core flow: Upload → Generate layout → Fine-tune → Export</p>
            <p className="m-0 mt-1 text-sm text-muted">{guidance}</p>
          </div>

          <div className="flex flex-wrap gap-2">
            {WORKFLOW_STEPS.map(({ id, label, icon: Icon }) => {
              const isDone = WORKFLOW_STEPS.findIndex((step) => step.id === workflowStage) > WORKFLOW_STEPS.findIndex((step) => step.id === id);
              const isActive = workflowStage === id;

              return (
                <div
                  key={id}
                  className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs ${
                    isActive
                      ? 'border-amber-300/40 bg-amber-300/10 text-amber-100'
                      : isDone
                        ? 'border-emerald-400/25 bg-emerald-400/10 text-emerald-100'
                        : 'border-line/30 bg-white/[0.03] text-muted'
                  }`}
                >
                  {isDone ? <CheckCircle2 className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                  <span className="font-medium">{label}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex min-w-[280px] flex-col gap-2 rounded-2xl border border-line/30 bg-black/15 p-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="m-0 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">Project state</p>
              <p className="m-0 mt-1 text-sm text-ink">
                {pagesCount > 0 ? `Page ${Math.min(selectedPageIndex + 1, pagesCount)} of ${pagesCount}` : 'No pages yet'}
              </p>
            </div>
            <span className="rounded-full border border-line/30 px-2.5 py-1 text-[11px] font-medium text-ink/85">
              {getModeLabel(interactionMode)}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
            <span className="inline-flex items-center gap-1 rounded-full border border-line/30 px-2.5 py-1">
              <CircleDashed className={`h-3.5 w-3.5 ${saveState === 'saved' ? 'text-emerald-300' : saveState === 'error' ? 'text-rose-300' : 'text-amber-200'}`} />
              {saveState === 'saving' ? 'Saving…' : saveState === 'error' ? 'Save needs attention' : formatTimeLabel(lastSavedAt)}
            </span>
            {restoredFromSnapshot ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-line/30 px-2.5 py-1">
                <FolderClock className="h-3.5 w-3.5 text-cyan-200" />
                Restored session
              </span>
            ) : null}
          </div>

          {hasUnplacedImages ? (
            <Button onClick={onGenerateLayout} className="min-h-10 justify-center text-sm">
              Generate layout now
            </Button>
          ) : null}

          {batchEnhanceProgress ? (
            <p className="m-0 text-xs text-violet-200">
              Enhancing photos: {batchEnhanceProgress.completed}/{batchEnhanceProgress.total} · {batchEnhanceProgress.preset}
            </p>
          ) : null}
          {lastExportSummary ? <p className="m-0 text-xs text-emerald-100">{lastExportSummary}</p> : null}

          {undoActionLabel ? (
            <div className="rounded-xl border border-amber-300/20 bg-amber-300/10 p-3">
              <p className="m-0 text-xs font-semibold uppercase tracking-[0.08em] text-amber-100">{undoActionLabel}</p>
              <p className="m-0 mt-1 text-xs text-amber-50/90">{undoActionDescription}</p>
              <Button variant="soft" onClick={onUndoLastAction} className="mt-3 min-h-9 w-full justify-center text-sm">
                Undo last action
              </Button>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
