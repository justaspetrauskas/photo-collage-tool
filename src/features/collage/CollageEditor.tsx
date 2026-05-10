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
        <div className="flex-1 overflow-y-auto relative" data-collage-scroll-root>
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
                itemById={editor.itemById}
                imageById={editor.imageById}
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
          onRestoreOriginalImage={editor.restoreOriginalImage}
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
        <div className="fixed bottom-4 left-1/2 z-50 w-[min(95vw,680px)] -translate-x-1/2 rounded-xl border border-line/30 bg-[#0a0f1a]/95 p-2.5 shadow-[0_14px_40px_rgba(0,0,0,0.45)] backdrop-blur-md">
          <div className="flex items-center justify-between gap-2">
            {/* Image info */}
            <div className="min-w-0 flex-1">
              <p className="m-0 text-xs font-semibold uppercase tracking-[0.05em] text-amber-200/90 truncate">
                {editor.selectedImage?.fileName ?? 'Selected'}
              </p>
              <p className="m-0 text-[10px] text-muted/80 truncate">
                {selectedImageOnPage?.width && selectedImageOnPage?.height
                  ? `${(selectedImageOnPage.width / 28.346).toFixed(1)}×${(selectedImageOnPage.height / 28.346).toFixed(1)} cm`
                  : 'Dimensions: —'}
              </p>
            </div>

            {/* Control buttons */}
            <div className="flex flex-nowrap items-center gap-1">
              <Button
                variant={editor.interactionMode === 'resize' ? 'primary' : 'soft'}
                onClick={() => editor.setInteractionMode('resize')}
                className="px-2.5 py-1 text-xs whitespace-nowrap"
              >
                Resize (R)
              </Button>
              <Button
                variant={editor.interactionMode === 'move' ? 'primary' : 'soft'}
                onClick={() => editor.setInteractionMode('move')}
                className="px-2.5 py-1 text-xs whitespace-nowrap"
              >
                Move (M)
              </Button>
              <Button
                variant={editor.interactionMode === 'replace' ? 'primary' : 'soft'}
                onClick={() => editor.setInteractionMode('replace')}
                className="px-2.5 py-1 text-xs whitespace-nowrap"
              >
                Swap (P)
              </Button>
              <Button
                variant="soft"
                onClick={() => editor.expandSelectedImage(1.1)}
                className="px-2.5 py-1 text-xs whitespace-nowrap"
              >
                + Size
              </Button>
              <Button
                variant="soft"
                onClick={() => editor.expandSelectedImage(0.9)}
                className="px-2.5 py-1 text-xs whitespace-nowrap"
              >
                − Size
              </Button>

              {/* Close button - circle outlined */}
              <button
                onClick={() => editor.setShowSelectionControls(false)}
                className="ml-1 flex-shrink-0 rounded-full border border-muted/40 p-1 hover:border-muted/60 hover:bg-white/5 transition-colors"
                aria-label="Close controls"
                title="Close (Esc)"
              >
                <svg className="w-4 h-4 text-muted hover:text-ink" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
