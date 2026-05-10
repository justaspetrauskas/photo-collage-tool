import { clampOffsets } from './layoutEngine';
import type { ImageItem, InteractionMode, PageLayout, PreviewTransform } from './types';

interface PreviewOptions {
  gridEnabled?: boolean;
  gridSpacingPx?: number;
  selectedImageId?: string | null;
  interactionMode?: InteractionMode;
  dragActive?: boolean;
}

function drawSelectionFeedback(
  ctx: CanvasRenderingContext2D,
  page: PageLayout,
  selectedImageId: string,
  interactionMode: InteractionMode,
  dragActive: boolean,
): void {
  const selected = page.items.find((item) => item.imageId === selectedImageId);
  if (!selected) {
    return;
  }

  const interactionColor = interactionMode === 'crop' ? 'rgba(13, 110, 184, 0.92)' : 'rgba(207, 91, 44, 0.92)';
  const interactionFill = interactionMode === 'crop' ? 'rgba(13, 110, 184, 0.12)' : 'rgba(207, 91, 44, 0.12)';
  const thickness = dragActive ? 3 : 2;

  ctx.save();
  ctx.lineWidth = thickness;
  ctx.strokeStyle = interactionColor;
  ctx.fillStyle = interactionFill;
  ctx.fillRect(selected.x, selected.y, selected.width, selected.height);
  ctx.strokeRect(selected.x, selected.y, selected.width, selected.height);

  if (interactionMode === 'crop') {
    const innerX = selected.x + selected.frameThicknessPx;
    const innerY = selected.y + selected.frameThicknessPx;
    const innerW = selected.contentWidthPx;
    const innerH = selected.contentHeightPx;

    ctx.setLineDash([5, 4]);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(innerX + innerW / 2, innerY);
    ctx.lineTo(innerX + innerW / 2, innerY + innerH);
    ctx.moveTo(innerX, innerY + innerH / 2);
    ctx.lineTo(innerX + innerW, innerY + innerH / 2);
    ctx.stroke();
  } else {
    const handleSize = 9;
    const half = handleSize / 2;
    const corners = [
      [selected.x, selected.y],
      [selected.x + selected.width, selected.y],
      [selected.x, selected.y + selected.height],
      [selected.x + selected.width, selected.y + selected.height],
    ];

    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.strokeStyle = interactionColor;
    ctx.lineWidth = 1.3;
    for (const [cx, cy] of corners) {
      ctx.fillRect(cx - half, cy - half, handleSize, handleSize);
      ctx.strokeRect(cx - half, cy - half, handleSize, handleSize);
    }
  }

  ctx.restore();
}

function drawPage(
  ctx: CanvasRenderingContext2D,
  page: PageLayout,
  itemById: Map<string, ImageItem>,
  imageById: Map<string, HTMLImageElement>,
): void {
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, page.widthPx, page.heightPx);

  for (const placed of page.items) {
    const imageItem = itemById.get(placed.imageId);
    if (!imageItem) {
      continue;
    }

    const img = imageById.get(placed.imageId);
    if (!img) {
      continue;
    }

    const frameThicknessPx = placed.frameThicknessPx;
    const innerX = placed.x + frameThicknessPx;
    const innerY = placed.y + frameThicknessPx;
    const innerWidth = placed.contentWidthPx;
    const innerHeight = placed.contentHeightPx;

    if (frameThicknessPx > 0) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(placed.x, placed.y, placed.width, placed.height);
    }

    const clamped = clampOffsets(
      imageItem.offsetX,
      imageItem.offsetY,
      placed.maxOffsetX,
      placed.maxOffsetY,
    );

    const drawX = innerX - clamped.offsetX;
    const drawY = innerY - clamped.offsetY;

    ctx.save();
    ctx.beginPath();
    ctx.rect(innerX, innerY, innerWidth, innerHeight);
    ctx.clip();
    ctx.drawImage(img, drawX, drawY, placed.drawnImageWidthPx, placed.drawnImageHeightPx);
    ctx.restore();
  }
}

export function drawPagePreview(
  canvas: HTMLCanvasElement,
  page: PageLayout,
  itemById: Map<string, ImageItem>,
  imageById: Map<string, HTMLImageElement>,
  options: PreviewOptions = {},
): PreviewTransform | null {
  const dpr = window.devicePixelRatio || 1;
  const logicalSize = Math.min(window.innerWidth * 0.9, 900);
  canvas.width = Math.round(logicalSize * dpr);
  canvas.height = Math.round(logicalSize * dpr);
  canvas.style.width = `${Math.round(logicalSize)}px`;
  canvas.style.height = `${Math.round(logicalSize)}px`;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return null;
  }

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const margin = 28 * dpr;
  const availableWidth = canvas.width - margin * 2;
  const availableHeight = canvas.height - margin * 2;
  const scale = Math.min(availableWidth / page.widthPx, availableHeight / page.heightPx);

  const drawWidth = page.widthPx * scale;
  const drawHeight = page.heightPx * scale;
  const offsetX = (canvas.width - drawWidth) / 2;
  const offsetY = (canvas.height - drawHeight) / 2;

  ctx.save();
  ctx.translate(offsetX, offsetY);
  ctx.scale(scale, scale);
  drawPage(ctx, page, itemById, imageById);

  if (options.gridEnabled) {
    ctx.save();
    ctx.lineWidth = 1 / scale;

    // Occupied-space emphasis: highlight placed rectangles and their boundary-aligned guides.
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(207, 91, 44, 0.08)';
    ctx.strokeStyle = 'rgba(207, 91, 44, 0.55)';
    ctx.lineWidth = 1.5 / scale;

    const edgeX = new Set<number>();
    const edgeY = new Set<number>();

    for (const item of page.items) {
      ctx.fillRect(item.x, item.y, item.width, item.height);
      ctx.strokeRect(item.x, item.y, item.width, item.height);
      edgeX.add(item.x);
      edgeX.add(item.x + item.width);
      edgeY.add(item.y);
      edgeY.add(item.y + item.height);
    }

    ctx.strokeStyle = 'rgba(207, 91, 44, 0.38)';
    ctx.setLineDash([10 / scale, 8 / scale]);

    for (const x of edgeX) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, page.heightPx);
      ctx.stroke();
    }

    for (const y of edgeY) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(page.widthPx, y);
      ctx.stroke();
    }
    ctx.restore();
  }

  ctx.restore();


  if (options.selectedImageId) {
    drawSelectionFeedback(
      ctx,
      page,
      options.selectedImageId,
      options.interactionMode ?? 'crop',
      options.dragActive ?? false,
    );
  }

  return {
    dpr,
    scale,
    offsetX,
    offsetY,
  };
}

export function renderPageToExportCanvas(
  page: PageLayout,
  itemById: Map<string, ImageItem>,
  imageById: Map<string, HTMLImageElement>,
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = page.widthPx;
  canvas.height = page.heightPx;

  const ctx = canvas.getContext('2d');
  if (ctx) {
    drawPage(ctx, page, itemById, imageById);
  }

  return canvas;
}
