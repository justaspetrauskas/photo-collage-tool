import { MaxRectsBin } from 'maxrects-packer';
import { cmToPx } from './constants';

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function getContentBox(naturalWidth, naturalHeight, maxWidthCm, maxHeightCm, allowUpscale = false) {
  const maxWidthPx = cmToPx(maxWidthCm);
  const maxHeightPx = cmToPx(maxHeightCm);

  const widthRatio = maxWidthPx / naturalWidth;
  const heightRatio = maxHeightPx / naturalHeight;
  const fitScale = Math.min(widthRatio, heightRatio);
  const scale = allowUpscale ? fitScale : Math.min(1, fitScale);

  return {
    widthPx: Math.round(naturalWidth * scale),
    heightPx: Math.round(naturalHeight * scale),
  };
}

function getCropMetrics(naturalWidth, naturalHeight, frameWidth, frameHeight) {
  const coverScale = Math.max(frameWidth / naturalWidth, frameHeight / naturalHeight);
  const drawnImageWidthPx = Math.round(naturalWidth * coverScale);
  const drawnImageHeightPx = Math.round(naturalHeight * coverScale);

  return {
    drawnImageWidthPx,
    drawnImageHeightPx,
    maxOffsetX: Math.max(0, drawnImageWidthPx - frameWidth),
    maxOffsetY: Math.max(0, drawnImageHeightPx - frameHeight),
  };
}

export function buildPaginatedLayout(images, options) {
  const {
    canvasWidthPx,
    canvasHeightPx,
    allowUpscale = false,
    maxPages = Number.POSITIVE_INFINITY,
  } = options;

  const sourceRects = images
    .map((image) => {
      const content = getContentBox(
        image.naturalWidth,
        image.naturalHeight,
        image.maxWidthCm,
        image.maxHeightCm,
        allowUpscale,
      );

      const frameThicknessPx = image.frameEnabled ? image.frameThicknessPx : 0;
      const packedWidth = content.widthPx + frameThicknessPx * 2;
      const packedHeight = content.heightPx + frameThicknessPx * 2;

      const crop = getCropMetrics(
        image.naturalWidth,
        image.naturalHeight,
        content.widthPx,
        content.heightPx,
      );

      return {
        id: image.id,
        packedWidth,
        packedHeight,
        contentWidthPx: content.widthPx,
        contentHeightPx: content.heightPx,
        frameThicknessPx,
        ...crop,
      };
    })
    .sort((a, b) => b.packedWidth * b.packedHeight - a.packedWidth * a.packedHeight);

  const pages = [];
  let remaining = sourceRects;

  while (remaining.length > 0 && pages.length < maxPages) {
    const bin = new MaxRectsBin(canvasWidthPx, canvasHeightPx, 0);
    const nextRemaining = [];

    for (const rect of remaining) {
      const placed = bin.add(rect.packedWidth, rect.packedHeight, { id: rect.id });
      if (!placed) {
        nextRemaining.push(rect);
      }
    }

    if (bin.rects.length === 0) {
      break;
    }

    const positionedItems = bin.rects.map((rect) => {
      const source = remaining.find((candidate) => candidate.id === rect.data.id);
      return {
        imageId: source.id,
        x: rect.x,
        y: rect.y,
        width: source.packedWidth,
        height: source.packedHeight,
        contentWidthPx: source.contentWidthPx,
        contentHeightPx: source.contentHeightPx,
        frameThicknessPx: source.frameThicknessPx,
        drawnImageWidthPx: source.drawnImageWidthPx,
        drawnImageHeightPx: source.drawnImageHeightPx,
        maxOffsetX: source.maxOffsetX,
        maxOffsetY: source.maxOffsetY,
      };
    });

    pages.push({
      id: `page-${pages.length + 1}`,
      widthPx: canvasWidthPx,
      heightPx: canvasHeightPx,
      items: positionedItems,
    });

    remaining = nextRemaining;
  }

  const mapById = new Map(sourceRects.map((rect) => [rect.id, rect]));
  const overflowImageIds = remaining.map((rect) => rect.id);
  const oversizedImageIds = remaining
    .filter((rect) => rect.packedWidth > canvasWidthPx || rect.packedHeight > canvasHeightPx)
    .map((rect) => rect.id);

  return {
    pages,
    overflowImageIds,
    oversizedImageIds,
    imageMetrics: mapById,
  };
}

export function clampOffsets(offsetX, offsetY, maxOffsetX, maxOffsetY) {
  return {
    offsetX: clamp(offsetX, 0, maxOffsetX),
    offsetY: clamp(offsetY, 0, maxOffsetY),
  };
}
