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
        frameMm={editor.frameMm}
        setFrameMm={editor.setFrameMm}
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

      {editor.error ? <p className="m-0 text-sm text-danger">{editor.error}</p> : null}
      {editor.oversizedImageIds.length ? (
        <p className="m-0 text-sm text-warn">
          {editor.oversizedImageIds.length} image(s) are oversized and cannot fit the canvas with current constraints.
        </p>
      ) : null}

      <CollagePreview
        pages={editor.pages}
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
