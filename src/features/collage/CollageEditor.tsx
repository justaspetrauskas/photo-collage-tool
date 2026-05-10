import { CollageControls } from './components/CollageControls';
import { CollageHeader } from './components/CollageHeader';
import { CollageImageList } from './components/CollageImageList';
import { CollagePreview } from './components/CollagePreview';
import { useCollageEditor } from './hooks/useCollageEditor';

export function CollageEditor() {
  const editor = useCollageEditor();

  const selectedPage = editor.pages[editor.selectedPageIndex];
  const selectedImageOnPage = selectedPage?.items.find((item) => item.imageId === editor.selectedImageId);

  return (
    <div className="container relative mt-5 pb-12 sm:mt-6">
      <CollageHeader />

      <div className="mt-4 grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)_340px]">
        <div className="order-2 lg:order-1">
          <CollageControls
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
            pagesCount={editor.pages.length}
            overflowCount={editor.overflowImageIds.length}
            onUploadFiles={editor.onUploadFiles}
            onApplyGlobalSettings={editor.applyGlobalSettings}
            onGenerateLayout={editor.onGenerateLayout}
            onExportPages={editor.exportPagesAsPng}
            onCreateNextPage={editor.onCreateNextPage}
            onStartFromScratch={editor.startFromScratch}
            onClearEverything={editor.clearEverything}
          />
        </div>

        <div className="order-1 lg:order-2">
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
        </div>

        <div className="order-3">
          <CollageImageList images={editor.images} onUpdateImage={editor.updateImage} />
        </div>
      </div>

    </div>
  );
}
