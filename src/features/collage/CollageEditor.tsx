import { CollageHeader } from './components/CollageHeader';
import { ImageDrawer } from './components/ImageDrawer';
import { CollagePreview } from './components/CollagePreview';
import { useCollageEditor } from './hooks/useCollageEditor';

export function CollageEditor() {
  const editor = useCollageEditor();

  const selectedPage = editor.pages[editor.selectedPageIndex];
  const selectedImageOnPage = selectedPage?.items.find((item) => item.imageId === editor.selectedImageId);

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
    </div>
  );
}
