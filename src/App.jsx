import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CANVAS_CM,
  CANVAS_SIZE_PX,
  DEFAULT_FRAME_MM,
  DEFAULT_MAX_IMAGE_CM,
  mmToPx,
} from './constants';
import { buildPaginatedLayout, clampOffsets } from './layoutEngine';
import { drawPagePreview, renderPageToExportCanvas } from './renderEngine';

function randomId(prefix = 'img') {
  return `${prefix}-${crypto.randomUUID()}`;
}

function fileToImage(file) {
  return new Promise((resolve, reject) => {
    const src = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      resolve({
        src,
        image,
        naturalWidth: image.naturalWidth,
        naturalHeight: image.naturalHeight,
      });
    };
    image.onerror = reject;
    image.src = src;
  });
}

export default function App() {
  const [images, setImages] = useState([]);
  const [pages, setPages] = useState([]);
  const [maxImageCm, setMaxImageCm] = useState(DEFAULT_MAX_IMAGE_CM);
  const [frameMm, setFrameMm] = useState(DEFAULT_FRAME_MM);
  const [paginationMode, setPaginationMode] = useState('auto');
  const [assistedPageCount, setAssistedPageCount] = useState(1);
  const [selectedPageIndex, setSelectedPageIndex] = useState(0);
  const [overflowImageIds, setOverflowImageIds] = useState([]);
  const [oversizedImageIds, setOversizedImageIds] = useState([]);
  const [error, setError] = useState('');

  const previewCanvasRef = useRef(null);
  const previewTransformRef = useRef(null);
  const dragRef = useRef(null);

  const itemById = useMemo(() => {
    return new Map(images.map((img) => [img.id, img]));
  }, [images]);

  const imageById = useMemo(() => {
    return new Map(images.map((img) => [img.id, img.bitmap]));
  }, [images]);

  const selectedPage = pages[selectedPageIndex] ?? null;

  useEffect(() => {
    const canvas = previewCanvasRef.current;
    if (!canvas || !selectedPage) {
      return;
    }

    previewTransformRef.current = drawPagePreview(canvas, selectedPage, itemById, imageById);
  }, [selectedPage, itemById, imageById]);

  useEffect(() => {
    return () => {
      for (const image of images) {
        URL.revokeObjectURL(image.src);
      }
    };
  }, [images]);

  async function onUploadFiles(event) {
    const files = Array.from(event.target.files ?? []);
    if (!files.length) {
      return;
    }

    try {
      const loaded = await Promise.all(files.map((file) => fileToImage(file)));
      const next = loaded.map((entry, index) => ({
        id: randomId(`${Date.now()}-${index}`),
        fileName: files[index].name,
        src: entry.src,
        bitmap: entry.image,
        naturalWidth: entry.naturalWidth,
        naturalHeight: entry.naturalHeight,
        maxWidthCm: maxImageCm,
        maxHeightCm: maxImageCm,
        frameEnabled: true,
        frameThicknessPx: mmToPx(frameMm),
        renderWidthPx: 0,
        renderHeightPx: 0,
        offsetX: 0,
        offsetY: 0,
      }));

      setImages((current) => [...current, ...next]);
      setError('');
    } catch {
      setError('Some images failed to load. Please retry with valid JPG, PNG, or WebP files.');
    } finally {
      event.target.value = '';
    }
  }

  function applyGlobalSettings() {
    setImages((current) =>
      current.map((image) => ({
        ...image,
        maxWidthCm: maxImageCm,
        maxHeightCm: maxImageCm,
        frameThicknessPx: mmToPx(frameMm),
      })),
    );
  }

  function updateImage(id, patch) {
    setImages((current) => current.map((image) => (image.id === id ? { ...image, ...patch } : image)));
  }

  function regenerateLayout(overrideAssistedCount) {
    if (!images.length) {
      setPages([]);
      setOverflowImageIds([]);
      setOversizedImageIds([]);
      return;
    }

    const result = buildPaginatedLayout(images, {
      canvasWidthPx: CANVAS_SIZE_PX,
      canvasHeightPx: CANVAS_SIZE_PX,
      maxPages: paginationMode === 'auto' ? Number.POSITIVE_INFINITY : overrideAssistedCount,
    });

    const metricsById = result.imageMetrics;
    setImages((current) =>
      current.map((image) => {
        const metrics = metricsById.get(image.id);
        if (!metrics) {
          return image;
        }

        const clamped = clampOffsets(image.offsetX, image.offsetY, metrics.maxOffsetX, metrics.maxOffsetY);
        return {
          ...image,
          renderWidthPx: metrics.contentWidthPx,
          renderHeightPx: metrics.contentHeightPx,
          offsetX: clamped.offsetX,
          offsetY: clamped.offsetY,
        };
      }),
    );

    setPages(result.pages);
    setOverflowImageIds(result.overflowImageIds);
    setOversizedImageIds(result.oversizedImageIds);
    setSelectedPageIndex(0);
  }

  function onGenerateLayout() {
    setAssistedPageCount(1);
    regenerateLayout(1);
  }

  function onCreateNextPage() {
    const nextCount = assistedPageCount + 1;
    setAssistedPageCount(nextCount);
    regenerateLayout(nextCount);
  }

  function pagePointFromMouse(event) {
    const canvas = previewCanvasRef.current;
    const transform = previewTransformRef.current;
    if (!canvas || !transform || !selectedPage) {
      return null;
    }

    const rect = canvas.getBoundingClientRect();
    const x = (event.clientX - rect.left) * transform.dpr;
    const y = (event.clientY - rect.top) * transform.dpr;

    const pageX = (x - transform.offsetX) / transform.scale;
    const pageY = (y - transform.offsetY) / transform.scale;

    if (pageX < 0 || pageY < 0 || pageX > selectedPage.widthPx || pageY > selectedPage.heightPx) {
      return null;
    }

    return { x: pageX, y: pageY };
  }

  function findHitItem(pagePoint) {
    if (!selectedPage) {
      return null;
    }

    for (let i = selectedPage.items.length - 1; i >= 0; i -= 1) {
      const placed = selectedPage.items[i];
      const frame = placed.frameThicknessPx;
      const innerX = placed.x + frame;
      const innerY = placed.y + frame;
      if (
        pagePoint.x >= innerX &&
        pagePoint.x <= innerX + placed.contentWidthPx &&
        pagePoint.y >= innerY &&
        pagePoint.y <= innerY + placed.contentHeightPx
      ) {
        return placed;
      }
    }

    return null;
  }

  function onMouseDown(event) {
    const point = pagePointFromMouse(event);
    if (!point) {
      return;
    }

    const hit = findHitItem(point);
    if (!hit) {
      return;
    }

    const item = itemById.get(hit.imageId);
    if (!item) {
      return;
    }

    dragRef.current = {
      imageId: hit.imageId,
      startX: point.x,
      startY: point.y,
      baseOffsetX: item.offsetX,
      baseOffsetY: item.offsetY,
      maxOffsetX: hit.maxOffsetX,
      maxOffsetY: hit.maxOffsetY,
    };
  }

  function onMouseMove(event) {
    if (!dragRef.current) {
      return;
    }

    const point = pagePointFromMouse(event);
    if (!point) {
      return;
    }

    const drag = dragRef.current;
    const deltaX = point.x - drag.startX;
    const deltaY = point.y - drag.startY;

    const clamped = clampOffsets(
      drag.baseOffsetX - deltaX,
      drag.baseOffsetY - deltaY,
      drag.maxOffsetX,
      drag.maxOffsetY,
    );

    updateImage(drag.imageId, {
      offsetX: Math.round(clamped.offsetX),
      offsetY: Math.round(clamped.offsetY),
    });
  }

  function onMouseUp() {
    dragRef.current = null;
  }

  function exportPagesAsPng() {
    if (!pages.length) {
      return;
    }

    pages.forEach((page, index) => {
      const canvas = renderPageToExportCanvas(page, itemById, imageById);
      const link = document.createElement('a');
      link.download = `collage-page-${index + 1}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    });
  }

  return (
    <div className="app-shell">
      <header>
        <p className="eyebrow">Print Layout Studio</p>
        <h1>Photo Collage Generator</h1>
        <p className="subtitle">
          {CANVAS_CM}cm × {CANVAS_CM}cm at 300 DPI ({CANVAS_SIZE_PX}px)
        </p>
      </header>

      <section className="panel controls-grid">
        <label>
          Upload Photos
          <input type="file" accept="image/png,image/jpeg,image/webp" multiple onChange={onUploadFiles} />
        </label>

        <label>
          Max Image Size (cm)
          <input
            type="number"
            min="1"
            max="20"
            step="0.1"
            value={maxImageCm}
            onChange={(e) => setMaxImageCm(Number(e.target.value))}
          />
        </label>

        <label>
          Frame Thickness (mm)
          <input
            type="number"
            min="0"
            max="20"
            step="0.1"
            value={frameMm}
            onChange={(e) => setFrameMm(Number(e.target.value))}
          />
        </label>

        <label>
          Pagination Mode
          <select value={paginationMode} onChange={(e) => setPaginationMode(e.target.value)}>
            <option value="auto">Auto Pagination</option>
            <option value="assisted">Assisted Pagination</option>
          </select>
        </label>

        <button type="button" onClick={applyGlobalSettings}>
          Apply Global Constraints
        </button>
        <button type="button" onClick={onGenerateLayout}>
          Generate Layout
        </button>
        <button type="button" onClick={exportPagesAsPng} disabled={!pages.length}>
          Export PNG Pages
        </button>
        {paginationMode === 'assisted' && overflowImageIds.length > 0 ? (
          <button type="button" onClick={onCreateNextPage}>
            Create Next Page ({overflowImageIds.length} remaining)
          </button>
        ) : null}
      </section>

      {error ? <p className="error-text">{error}</p> : null}
      {oversizedImageIds.length ? (
        <p className="warning-text">
          {oversizedImageIds.length} image(s) are oversized and cannot fit the canvas with current constraints.
        </p>
      ) : null}

      <section className="panel">
        <h2>Page Preview</h2>
        <p className="hint">Drag inside any image frame to change crop offset.</p>

        <div className="canvas-wrap">
          <canvas
            ref={previewCanvasRef}
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onMouseLeave={onMouseUp}
          />
        </div>

        <div className="page-tabs">
          {pages.map((page, index) => (
            <button
              key={page.id}
              type="button"
              className={index === selectedPageIndex ? 'active' : ''}
              onClick={() => setSelectedPageIndex(index)}
            >
              Page {index + 1}
            </button>
          ))}
        </div>
      </section>

      <section className="panel">
        <h2>Images ({images.length})</h2>
        <div className="image-list">
          {images.map((image) => (
            <article key={image.id} className="image-card">
              <img src={image.src} alt={image.fileName} loading="lazy" />
              <div>
                <strong>{image.fileName}</strong>
                <p>
                  {image.naturalWidth} × {image.naturalHeight}px
                </p>
                <label className="small-field">
                  Max Width (cm)
                  <input
                    type="number"
                    min="1"
                    max="20"
                    step="0.1"
                    value={image.maxWidthCm}
                    onChange={(e) => updateImage(image.id, { maxWidthCm: Number(e.target.value) })}
                  />
                </label>
                <label className="small-field">
                  Max Height (cm)
                  <input
                    type="number"
                    min="1"
                    max="20"
                    step="0.1"
                    value={image.maxHeightCm}
                    onChange={(e) => updateImage(image.id, { maxHeightCm: Number(e.target.value) })}
                  />
                </label>
                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={image.frameEnabled}
                    onChange={(e) => updateImage(image.id, { frameEnabled: e.target.checked })}
                  />
                  Frame enabled
                </label>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
