import { CollageHeader } from './components/CollageHeader';
import { ImageDrawer } from './components/ImageDrawer';
import { CollagePreview } from './components/CollagePreview';
import { useCollageEditor } from './hooks/useCollageEditor';
import { Button } from '../../shared/ui/Button';

export function CollageEditor() {
  const editor = useCollageEditor();

  const selectedPage = editor.pages[editor.selectedPageIndex];
  const selectedImageOnPage = selectedPage?.items.find((item) => item.imageId === editor.selectedImageId);
  const hasSelection = Boolean(editor.selectedImageId);

  return (
    <div className="relative w-screen pb-10 flex flex-col h-screen">
      <CollageHeader />

      <div className="flex flex-1 overflow-hidden">
        {/* Main Content Area — canvas only */}
        <div className="flex-1 overflow-y-auto relative">
          <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-16 bg-gradient-to-l from-[#000000]/20 via-transparent to-transparent z-20" />
          <div className="mx-auto w-full max-w-[1440px] px-6 pt-4 sm:px-8">
            <main>
              {editor.error ? <p className="mb-2 mt-0 text-sm text-danger">{editor.error}</p> : null}
              {editor.oversizedImageIds.length ? (
                <p className="mb-2 mt-0 text-sm text-warn">
                  {editor.oversizedImageIds.length} image(s) are oversized and cannot fit the canvas with current constraints.
                </p>
              ) : null}
              <CollagePreview
                pages={editor.pages}
                selectedImageId={editor.selectedImageId}
                hoveredImageId={editor.hoveredImageId}
                selectedImageName={editor.selectedImage?.fileName ?? null}
                selectedImageWidth={selectedImageOnPage?.width ?? null}
                selectedImageHeight={selectedImageOnPage?.height ?? null}
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
                onDragOver={editor.onCanvasDragOver}
                onDrop={editor.onCanvasDrop}
                onDragLeave={editor.onCanvasDragLeave}
              />
            </main>
          </div>
        </div>

        {/* Drawer — scene controls + images + upload */}
        <ImageDrawer
          images={editor.images}
          pages={editor.pages}
          onUpdateImage={editor.updateImage}
          onDeleteImage={editor.deleteImage}
          onRemoveFromCanvas={editor.removeFromCanvas}
          onEnhanceImage={editor.enhanceImage}
          onEnhanceAll={editor.enhanceAllImages}
          enhancingImageIds={editor.enhancingImageIds}
          onBeginManualPlacementDrag={editor.onBeginManualPlacementDrag}
          onEndManualPlacementDrag={editor.onEndManualPlacementDrag}
          onUploadFiles={editor.onUploadFiles}
          onUploadFileList={editor.uploadFileList}
          sceneControls={{
            maxImageCm: editor.maxImageCm,
            setMaxImageCm: editor.setMaxImageCm,
            minImageCm: editor.minImageCm,
            setMinImageCm: editor.setMinImageCm,
            frameMm: editor.frameMm,
            setFrameMm: editor.setFrameMm,
            gridModeEnabled: editor.gridModeEnabled,
            setGridModeEnabled: editor.setGridModeEnabled,
            autoCompactPages: editor.autoCompactPages,
            setAutoCompactPages: editor.setAutoCompactPages,
            paginationMode: editor.paginationMode,
            setPaginationMode: editor.setPaginationMode,
            pagesCount: editor.pages.length,
            overflowCount: editor.overflowImageIds.length,
            onApplyGlobalSettings: editor.applyGlobalSettings,
            onGenerateLayout: editor.onGenerateLayout,
            onExportPages: editor.exportPagesAsPng,
            onCreateNextPage: editor.onCreateNextPage,
            onStartFromScratch: editor.startFromScratch,
            onClearEverything: editor.clearEverything,
          }}
        />
      </div>

      {/* Selection Controls Overlay — fixed at root level */}
      {hasSelection && editor.showSelectionControls && (
        <div className="fixed bottom-4 left-1/2 z-50 w-[min(95vw,980px)] -translate-x-1/2 rounded-2xl border border-line/30 bg-[#0a0f1a]/95 p-3 shadow-[0_14px_40px_rgba(0,0,0,0.45)] backdrop-blur-md">
          <div className="mb-2 flex items-center justify-between gap-3">
            <div>
              <p className="m-0 text-xs font-semibold uppercase tracking-[0.08em] text-amber-200/90">Selected Image Controls</p>
              <p className="m-0 mt-1 text-[11px] text-muted">Shortcuts: C Crop, R Resize, M Move, P Replace, +/- Scale, 0 Reset, Esc Close</p>
            </div>
            <button
              onClick={() => editor.setShowSelectionControls(false)}
              className="flex-shrink-0 rounded-lg p-1 hover:bg-white/10 transition-colors"
              aria-label="Close controls"
            >
              <svg className="w-5 h-5 text-muted hover:text-ink" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant={editor.interactionMode === 'crop' ? 'primary' : 'soft'}
              onClick={() => editor.setInteractionMode('crop')}
            >
              Crop (C)
            </Button>
            <Button
              variant={editor.interactionMode === 'resize' ? 'primary' : 'soft'}
              onClick={() => editor.setInteractionMode('resize')}
            >
              Resize (R)
            </Button>
            <Button
              variant={editor.interactionMode === 'move' ? 'primary' : 'soft'}
              onClick={() => editor.setInteractionMode('move')}
            >
              Move (M)
            </Button>
            <Button
              variant={editor.interactionMode === 'replace' ? 'primary' : 'soft'}
              onClick={() => editor.setInteractionMode('replace')}
            >
              Replace (P)
            </Button>
            <Button variant="soft" onClick={() => editor.expandSelectedImage(1.1)}>
              Expand (+)
            </Button>
            <Button variant="soft" onClick={() => editor.expandSelectedImage(0.9)}>
              Shrink (-)
            </Button>
            <Button variant="soft" onClick={editor.resetSelectedCrop}>
              Reset Crop (0)
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
