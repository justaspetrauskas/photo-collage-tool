import { CollageHeader } from './components/CollageHeader';
import { LeftLibraryPanel } from './components/LeftLibraryPanel';
import { RightInspectorPanel } from './components/RightInspectorPanel';
import { CollagePreview } from './components/CollagePreview';
import { WorkflowStatusCard } from './components/WorkflowStatusCard';
import { useCollageEditor } from './hooks/useCollageEditor';
import { useEditorUIStore } from './store/editorUIStore';
import { Button } from '../../shared/ui/Button';
import { useEffect, useState } from 'react';

export function CollageEditor() {
  const editor = useCollageEditor();
  const { drawerSelectedImageId, setDrawerSelectedImageId } = useEditorUIStore();
  const [toast, setToast] = useState<{ tone: 'error' | 'info' | 'success'; text: string } | null>(null);
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const [isInspectorOpen, setIsInspectorOpen] = useState(false);

  const selectedPlacedItem = editor.selectedPlacedItem;
  const hasSelection = Boolean(editor.selectedImageId && selectedPlacedItem);
  useEffect(() => {
    if (!editor.error) {
      return;
    }

    setToast({ tone: 'error', text: editor.error });
    const timeoutId = window.setTimeout(() => {
      setToast((current) => (current?.text === editor.error ? null : current));
    }, 3500);

    return () => window.clearTimeout(timeoutId);
  }, [editor.error]);

  useEffect(() => {
    if (!editor.notice) {
      return;
    }

    setToast({ tone: editor.notice.tone, text: editor.notice.text });
    const timeoutId = window.setTimeout(() => {
      setToast((current) => (current?.text === editor.notice?.text ? null : current));
    }, 3200);

    return () => window.clearTimeout(timeoutId);
  }, [editor.notice]);

  return (
    <div className="flex h-[100dvh] w-screen flex-col">
      {/* Toast error */}
      {toast ? (
        <div
          className="pointer-events-none fixed left-1/2 top-4 z-[70] -translate-x-1/2"
          role="status"
          aria-live="polite"
        >
          <div className={`pointer-events-auto flex max-w-[min(92vw,680px)] items-start gap-3 rounded-lg px-4 py-3 text-sm shadow-[0_14px_36px_rgba(0,0,0,0.42)] backdrop-blur-sm ${
            toast.tone === 'error'
              ? 'border border-danger/45 bg-[#2a0f12]/95 text-[#ffd9de]'
              : toast.tone === 'success'
                ? 'border border-emerald-300/30 bg-[#0d241d]/95 text-emerald-50'
                : 'border border-cyan-300/25 bg-[#0f1f2a]/95 text-cyan-50'
          }`}>
            <p className="m-0 leading-5">{toast.text}</p>
            <button
              type="button"
              className="rounded-md border border-white/15 px-2 py-0.5 text-xs hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/70"
              onClick={() => setToast(null)}
            >
              Dismiss
            </button>
          </div>
        </div>
      ) : null}

      {/* Top bar */}
         <CollageHeader
           hasImages={editor.images.length > 0}
           hasUnplacedImages={editor.hasUnplacedImages}
           canExport={editor.hasPlacedItems}
           isExporting={editor.isExporting}
           onGenerateLayout={editor.onGenerateLayout}
           onExportPages={editor.exportPages}
           onToggleLibrary={() => setIsLibraryOpen((v) => !v)}
          onToggleInspector={() => setIsInspectorOpen((v) => !v)}
        />

      {/* 3-pane workspace */}
      <div className="flex min-h-0 flex-1 overflow-hidden">

        {/* Left: Image Library */}
        <LeftLibraryPanel
          images={editor.images}
          pages={editor.pages}
          enhancingImageIds={editor.enhancingImageIds}
          batchEnhanceProgress={editor.batchEnhanceProgress}
          selectedImageId={drawerSelectedImageId ?? editor.selectedImageId}
          onSelectImage={(id) => {
            setDrawerSelectedImageId(id);
            setIsInspectorOpen(true);
          }}
          onDeleteImage={editor.deleteImage}
          onRemoveFromCanvas={editor.removeFromCanvas}
          onEnhanceAll={(preset) => editor.enhanceAllImages({ preset })}
          onBeginManualPlacementDrag={editor.onBeginManualPlacementDrag}
          onEndManualPlacementDrag={editor.onEndManualPlacementDrag}
          onUploadFiles={editor.onUploadFiles}
          onUploadFileList={editor.uploadFileList}
          onPlaceImageOnCanvas={(imageId) => editor.placeImageOnSelectedPage(imageId, false)}
          onReplaceSelectedImage={(imageId) => editor.placeImageOnSelectedPage(imageId, true)}
          isOpen={isLibraryOpen}
          onClose={() => setIsLibraryOpen(false)}
        />

        {/* Center: Canvas */}
        <div className="relative min-w-0 flex-1 overflow-y-auto" data-collage-scroll-root>
          <div className="pointer-events-none absolute right-0 top-0 bottom-0 z-20 w-8 bg-gradient-to-l from-[#000000]/15 via-transparent to-transparent" />
          <div className="mx-auto w-full max-w-[1440px] px-4 pt-4 sm:px-8">
            <WorkflowStatusCard
              workflowStage={editor.workflowStage}
              hasImages={editor.images.length > 0}
              hasPlacedItems={editor.hasPlacedItems}
              hasUnplacedImages={editor.hasUnplacedImages}
              selectedPageIndex={editor.selectedPageIndex}
              pagesCount={editor.pages.length}
              interactionMode={editor.interactionMode}
              saveState={editor.saveState}
              lastSavedAt={editor.lastSavedAt}
              restoredFromSnapshot={editor.restoredFromSnapshot}
              isExporting={editor.isExporting}
              lastExportSummary={editor.lastExportSummary}
              batchEnhanceProgress={editor.batchEnhanceProgress}
              undoActionLabel={editor.undoActionLabel}
              undoActionDescription={editor.undoActionDescription}
              onGenerateLayout={editor.onGenerateLayout}
              onUndoLastAction={editor.undoLastAction}
            />
            <main>
              {editor.oversizedImageIds.length ? (
                <p className="mb-2 mt-0 text-sm text-warn">
                  {editor.oversizedImageIds.length} image(s) are oversized and cannot fit the canvas with current constraints.
                </p>
              ) : null}
              <CollagePreview
                pages={editor.pages}
                itemById={editor.itemById}
                imageById={editor.imageById}
                selectedImageId={editor.selectedImageId}
                hoveredImageId={editor.hoveredImageId}
                selectedImageName={editor.selectedImage?.fileName ?? null}
                selectedImageWidth={selectedPlacedItem?.width ?? null}
                selectedImageHeight={selectedPlacedItem?.height ?? null}
                showSelectionControls={editor.showSelectionControls}
                onCloseSelectionControls={() => editor.setShowSelectionControls(false)}
                resizeLimitNotice={editor.resizeLimitNotice}
                interactionMode={editor.interactionMode}
                dragActive={editor.dragActive}
                moveOutsideCanvas={editor.moveOutsideCanvas}
                onSetInteractionMode={editor.setInteractionMode}
                onExpandSelectedImage={editor.expandSelectedImage}
                onResetSelectedCrop={editor.resetSelectedCrop}
                selectedPageIndex={editor.selectedPageIndex}
                onSelectPage={editor.setSelectedPageIndex}
                previewCanvasRef={editor.previewCanvasRef}
                onMouseDown={editor.onCanvasMouseDown}
                onMouseMove={editor.onCanvasMouseMove}
                onMouseUp={editor.onCanvasMouseUp}
                onMouseLeave={editor.onCanvasMouseLeave}
                onDoubleClick={editor.onCanvasDoubleClick}
                onPointerDown={editor.onCanvasPointerDown}
                onPointerMove={editor.onCanvasPointerMove}
                onPointerUp={editor.onCanvasPointerUp}
                onPointerCancel={editor.onCanvasPointerCancel}
                onDragOver={editor.onCanvasDragOver}
                onDrop={editor.onCanvasDrop}
                 onDragLeave={editor.onCanvasDragLeave}
                 onUploadFileList={editor.uploadFileList}
                 hasUnplacedImages={editor.hasUnplacedImages}
                 onGenerateLayout={editor.onGenerateLayout}
                 imagesCount={editor.images.length}
                 canvasCursor={editor.canvasCursor}
               />
            </main>
          </div>
        </div>

        {/* Right: Inspector */}
        <RightInspectorPanel
          selectedImageId={editor.selectedImageId}
          images={editor.images}
          pages={editor.pages}
          onUpdateImage={editor.updateImage}
          onDeleteImage={editor.deleteImage}
          onRemoveFromCanvas={editor.removeFromCanvas}
          onEnhanceImage={(id, preset) => editor.enhanceImage(id, { preset })}
          onRestoreOriginalImage={editor.restoreOriginalImage}
          enhancingImageIds={editor.enhancingImageIds}
          onPlaceImageOnCanvas={(imageId) => editor.placeImageOnSelectedPage(imageId, false)}
          onReplaceSelectedImage={(imageId) => editor.placeImageOnSelectedPage(imageId, true)}
          maxImageCm={editor.maxImageCm}
          setMaxImageCm={editor.setMaxImageCm}
          minImageCm={editor.minImageCm}
          setMinImageCm={editor.setMinImageCm}
          frameMm={editor.frameMm}
          setFrameMm={editor.setFrameMm}
          gridModeEnabled={editor.gridModeEnabled}
          setGridModeEnabled={editor.setGridModeEnabled}
          autoCompactPages={editor.autoCompactPages}
          setAutoCompactPages={editor.setAutoCompactPages}
          paginationMode={editor.paginationMode}
          setPaginationMode={editor.setPaginationMode}
          layoutPresetId={editor.layoutPresetId}
          setLayoutPresetId={editor.setLayoutPresetId}
          recommendedLayoutHint={editor.recommendedLayoutHint}
           overflowCount={editor.overflowImageIds.length}
           onApplyGlobalSettings={editor.applyGlobalSettings}
           onCreateNextPage={editor.onCreateNextPage}
           onRemoveSelectedCanvas={editor.removeSelectedCanvas}
           onStartFromScratch={editor.startFromScratch}
           onClearEverything={editor.clearEverything}
           hasImages={editor.images.length > 0}
           hasPlacedItems={editor.hasPlacedItems}
           selectedPageIndex={editor.selectedPageIndex}
           saveState={editor.saveState}
           lastSavedAt={editor.lastSavedAt}
           restoredFromSnapshot={editor.restoredFromSnapshot}
           workflowStage={editor.workflowStage}
           sessionMetrics={editor.sessionMetrics}
           sessionInsights={editor.sessionInsights}
           canvasSize={{
             canvasPresetId: editor.canvasPresetId,
            setCanvasPresetId: editor.setCanvasPresetId,
            customCanvasWidthCm: editor.customCanvasWidthCm,
            setCustomCanvasWidthCm: editor.setCustomCanvasWidthCm,
            customCanvasHeightCm: editor.customCanvasHeightCm,
            setCustomCanvasHeightCm: editor.setCustomCanvasHeightCm,
          }}
          isOpen={isInspectorOpen}
          onClose={() => setIsInspectorOpen(false)}
        />
      </div>

      {/* Bottom: Contextual manipulation toolbar */}
      {hasSelection && editor.showSelectionControls && (
        <div className="flex-shrink-0 border-t border-line/20 bg-[#0a0f1a]/95 px-3 py-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] backdrop-blur-md">
          <div className="flex items-center gap-2">
            {/* Image info */}
             <div className="min-w-0 flex-1">
               <p className="m-0 truncate text-xs font-semibold uppercase tracking-[0.05em] text-amber-200/90">
                 {editor.selectedImage?.fileName ?? 'Selected'}
               </p>
               <p className="m-0 truncate text-[10px] text-muted/80">
                  {selectedPlacedItem?.width && selectedPlacedItem?.height
                    ? `${(selectedPlacedItem.width / 28.346).toFixed(1)}×${(selectedPlacedItem.height / 28.346).toFixed(1)} cm`
                    : 'Dimensions: —'}
                </p>
                <p className="m-0 truncate text-[10px] text-muted/70">
                  {editor.interactionMode === 'select'
                    ? 'Edit mode · drag to move, handles resize · Esc closes the toolbar'
                    : editor.interactionMode === 'crop'
                      ? 'Crop mode · drag to reframe · Esc returns to Edit mode'
                      : 'Swap mode · drag onto another photo · Esc returns to Edit mode'}
                </p>
              </div>

             {/* Interaction mode buttons */}
             <div className="flex items-center gap-1">
               <Button
                  variant={editor.interactionMode === 'select' ? 'primary' : 'soft'}
                  onClick={() => editor.setInteractionMode('select')}
                  className="min-h-9 px-2.5 py-1.5 text-sm whitespace-nowrap"
                 title="Edit — drag to move, drag handles to resize (S)"
               >
                 Edit
               </Button>
               <Button
                  variant={editor.interactionMode === 'crop' ? 'primary' : 'soft'}
                  onClick={() => editor.setInteractionMode('crop')}
                  className="min-h-9 px-2.5 py-1.5 text-sm whitespace-nowrap"
                 title="Crop mode (C)"
               >
                  Crop
               </Button>
               <Button
                  variant={editor.interactionMode === 'replace' ? 'primary' : 'soft'}
                  onClick={() => editor.setInteractionMode('replace')}
                  className="min-h-9 px-2.5 py-1.5 text-sm whitespace-nowrap"
                 title="Swap mode (P)"
               >
                  Swap
              </Button>
            </div>

            {/* Size nudge + close */}
            <div className="flex items-center gap-1">
              <Button variant="soft" onClick={() => editor.expandSelectedImage(1.1)} className="min-h-9 px-2.5 py-1.5 text-sm">+</Button>
              <Button variant="soft" onClick={() => editor.expandSelectedImage(0.9)} className="min-h-9 px-2.5 py-1.5 text-sm">−</Button>
              <button
                onClick={() => editor.setShowSelectionControls(false)}
                className="flex min-h-9 min-w-9 flex-shrink-0 items-center justify-center rounded-xl border border-muted/40 p-1 transition-colors hover:border-muted/60 hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/70"
                aria-label="Close controls"
                title="Close (Esc)"
              >
                <svg className="h-4 w-4 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
