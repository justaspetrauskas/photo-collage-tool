import { clampOffsets } from './layoutEngine';
import type { ImageItem, PageLayout, PreviewTransform } from './types';

interface PreviewOptions {
  gridEnabled?: boolean;
  gridSpacingPx?: number;
}

function isCellOccupied(
  cellX: number,
  cellY: number,
  cellSize: number,
  page: PageLayout,
): boolean {
  const cellRight = cellX + cellSize;
  const cellBottom = cellY + cellSize;

  for (const item of page.items) {
    const itemRight = item.x + item.width;
    const itemBottom = item.y + item.height;
    const overlaps = cellX < itemRight && cellRight > item.x && cellY < itemBottom && cellBottom > item.y;
    if (overlaps) {
      return true;
    }
  }

  return false;
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
    const spacing = Math.max(1, Math.round(options.gridSpacingPx ?? 100));
    ctx.save();
    ctx.lineWidth = 1 / scale;
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';

    for (let y = 0; y < page.heightPx; y += spacing) {
      for (let x = 0; x < page.widthPx; x += spacing) {
        const cellWidth = Math.min(spacing, page.widthPx - x);
        const cellHeight = Math.min(spacing, page.heightPx - y);
        const occupied = isCellOccupied(x, y, spacing, page);

        ctx.fillStyle = occupied ? 'rgba(207, 91, 44, 0.2)' : 'rgba(60, 60, 60, 0.035)';
        ctx.fillRect(x, y, cellWidth, cellHeight);
      }
    }

    for (let x = 0; x <= page.widthPx; x += spacing) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, page.heightPx);
      ctx.stroke();
    }

    for (let y = 0; y <= page.heightPx; y += spacing) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(page.widthPx, y);
      ctx.stroke();
    }
    ctx.restore();
  }

  ctx.restore();

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
