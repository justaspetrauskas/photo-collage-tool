import { CollageControls } from './components/CollageControls';
import { CollageHeader } from './components/CollageHeader';
import { CollageImageList } from './components/CollageImageList';
import { CollagePreview } from './components/CollagePreview';
import { useCollageEditor } from './hooks/useCollageEditor';

export function CollageEditor() {
  const editor = useCollageEditor();

  return (
    <div className="container mt-5 grid gap-4 pb-12 sm:mt-6">
      <CollageHeader />

      <CollageControls
        maxImageCm={editor.maxImageCm}
        setMaxImageCm={editor.setMaxImageCm}
        minImageCm={editor.minImageCm}
        setMinImageCm={editor.setMinImageCm}
        frameMm={editor.frameMm}
        setFrameMm={editor.setFrameMm}
        gridModeEnabled={editor.gridModeEnabled}
        setGridModeEnabled={editor.setGridModeEnabled}
        paginationMode={editor.paginationMode}
        setPaginationMode={editor.setPaginationMode}
        pagesCount={editor.pages.length}
        overflowCount={editor.overflowImageIds.length}
        onUploadFiles={editor.onUploadFiles}
        onApplyGlobalSettings={editor.applyGlobalSettings}
        onGenerateLayout={editor.onGenerateLayout}
        onExportPages={editor.exportPagesAsPng}
        onCreateNextPage={editor.onCreateNextPage}
      />

      <p className="m-0 text-xs text-muted">
        Minimum image size is enforced during packing. If everything cannot fit above this size, extra pages are created.
      </p>

      {editor.error ? <p className="m-0 text-sm text-danger">{editor.error}</p> : null}
      {editor.oversizedImageIds.length ? (
        <p className="m-0 text-sm text-warn">
          {editor.oversizedImageIds.length} image(s) are oversized and cannot fit the canvas with current constraints.
        </p>
      ) : null}

      <CollagePreview
        pages={editor.pages}
        selectedImageId={editor.selectedImageId}
        selectedImageName={editor.selectedImage?.fileName ?? null}
        interactionMode={editor.interactionMode}
        dragActive={editor.dragActive}
        onSetInteractionMode={editor.setInteractionMode}
        onExpandSelectedImage={editor.expandSelectedImage}
        onResetSelectedCrop={editor.resetSelectedCrop}
        selectedPageIndex={editor.selectedPageIndex}
        onSelectPage={editor.setSelectedPageIndex}
        previewCanvasRef={editor.previewCanvasRef}
        onMouseDown={editor.onCanvasMouseDown}
        onMouseMove={editor.onCanvasMouseMove}
        onMouseUp={editor.onCanvasMouseUp}
      />

      <CollageImageList images={editor.images} onUpdateImage={editor.updateImage} />
    </div>
  );
}
