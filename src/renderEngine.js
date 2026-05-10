import { clampOffsets } from './layoutEngine';

function drawPage(ctx, page, itemById, imageById) {
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
    ctx.drawImage(
      img,
      drawX,
      drawY,
      placed.drawnImageWidthPx,
      placed.drawnImageHeightPx,
    );
    ctx.restore();
  }
}

export function drawPagePreview(canvas, page, itemById, imageById) {
  if (!canvas || !page) {
    return;
  }

  const dpr = window.devicePixelRatio || 1;
  const logicalSize = Math.min(window.innerWidth * 0.9, 900);
  canvas.width = Math.round(logicalSize * dpr);
  canvas.height = Math.round(logicalSize * dpr);
  canvas.style.width = `${Math.round(logicalSize)}px`;
  canvas.style.height = `${Math.round(logicalSize)}px`;

  const ctx = canvas.getContext('2d');
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
  ctx.restore();

  return {
    dpr,
    scale,
    offsetX,
    offsetY,
  };
}

export function renderPageToExportCanvas(page, itemById, imageById) {
  const canvas = document.createElement('canvas');
  canvas.width = page.widthPx;
  canvas.height = page.heightPx;

  const ctx = canvas.getContext('2d');
  drawPage(ctx, page, itemById, imageById);

  return canvas;
}
