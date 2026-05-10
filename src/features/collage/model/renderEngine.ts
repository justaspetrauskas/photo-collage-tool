import { clampOffsets } from './layoutEngine';
import type { ImageItem, InteractionMode, PageLayout, PreviewTransform } from './types';

interface PreviewOptions {
  gridEnabled?: boolean;
  gridSpacingPx?: number;
  selectedImageId?: string | null;
  hoveredImageId?: string | null;
  drawerSelectedImageId?: string | null;
  imageZoomLevels?: Record<string, number>;
  imagePanOffsets?: Record<string, { x: number; y: number }>;
  interactionMode?: InteractionMode;
  dragActive?: boolean;
  moveOutsideCanvas?: boolean;
  moveCollisionImageIds?: string[];
  resizeCurrentDimensions?: { width: number; height: number } | null;
  resizeFeedback?: {
    baseRect: { x: number; y: number; width: number; height: number };
    currentRect: { x: number; y: number; width: number; height: number };
    intent: 'expand' | 'shrink' | 'steady';
  } | null;
  swapAnimation?: {
    startedTick: number;
    durationTicks: number;
    transitions: Record<
      string,
      {
        from: { x: number; y: number };
        to: { x: number; y: number };
      }
    >;
  } | null;
  replacePointer?: { x: number; y: number } | null;
  placementPreview?: { x: number; y: number; width: number; height: number; valid: boolean } | null;
  animationTimeMs?: number;
}

const RESIZE_ACCENT_STROKE = 'rgba(252, 197, 21, 0.92)';
const RESIZE_ACCENT_FILL = 'rgba(252, 197, 21, 0.12)';
const RESIZE_ACCENT_FILL_STRONG = 'rgba(252, 197, 21, 0.22)';

function drawPlacementPreview(
  ctx: CanvasRenderingContext2D,
  preview: { x: number; y: number; width: number; height: number; valid: boolean },
  scale: number,
): void {
  ctx.save();
  ctx.lineWidth = 2 / scale;
  ctx.setLineDash([10 / scale, 7 / scale]);
  ctx.fillStyle = preview.valid ? 'rgba(34, 197, 94, 0.14)' : 'rgba(239, 68, 68, 0.14)';
  ctx.strokeStyle = preview.valid ? 'rgba(34, 197, 94, 0.9)' : 'rgba(239, 68, 68, 0.9)';
  ctx.fillRect(preview.x, preview.y, preview.width, preview.height);
  ctx.strokeRect(preview.x, preview.y, preview.width, preview.height);
  ctx.restore();
}

function drawReplaceTargetFeedback(
  ctx: CanvasRenderingContext2D,
  page: PageLayout,
  targetImageId: string,
  scale: number,
  animationTimeMs: number,
): void {
  const target = page.items.find((item) => item.imageId === targetImageId);
  if (!target) {
    return;
  }

  const pulse = 0.55 + 0.45 * Math.sin(animationTimeMs / 130);
  const inset = 3 / scale;

  ctx.save();
  ctx.lineWidth = (2 + pulse) / scale;
  ctx.strokeStyle = `rgba(10, 122, 62, ${0.65 + pulse * 0.25})`;
  ctx.fillStyle = `rgba(34, 139, 84, ${0.12 + pulse * 0.1})`;
  ctx.setLineDash([10 / scale, 7 / scale]);
  ctx.lineDashOffset = -(animationTimeMs / 18) / scale;

  ctx.fillRect(target.x + inset, target.y + inset, target.width - inset * 2, target.height - inset * 2);
  ctx.strokeRect(target.x + inset, target.y + inset, target.width - inset * 2, target.height - inset * 2);

  const labelPaddingX = 6 / scale;
  const labelHeight = 18 / scale;
  const labelWidth = 122 / scale;
  const labelX = target.x + 6 / scale;
  const labelY = target.y + 6 / scale;

  ctx.fillStyle = 'rgba(10, 122, 62, 0.9)';
  ctx.setLineDash([]);
  ctx.fillRect(labelX, labelY, labelWidth, labelHeight);
  ctx.fillStyle = '#ffffff';
  ctx.font = `${11 / scale}px ui-sans-serif, system-ui, sans-serif`;
  ctx.textBaseline = 'middle';
  ctx.fillText('Replace target', labelX + labelPaddingX, labelY + labelHeight / 2);
  ctx.restore();
}

function drawReplaceConnectionFeedback(
  ctx: CanvasRenderingContext2D,
  page: PageLayout,
  sourceImageId: string,
  targetImageId: string,
  scale: number,
  animationTimeMs: number,
): void {
  const source = page.items.find((item) => item.imageId === sourceImageId);
  const target = page.items.find((item) => item.imageId === targetImageId);
  if (!source || !target) {
    return;
  }

  const sourceX = source.x + source.width / 2;
  const sourceY = source.y + source.height / 2;
  const targetX = target.x + target.width / 2;
  const targetY = target.y + target.height / 2;

  const pulse = 0.6 + 0.4 * Math.sin(animationTimeMs / 120);

  ctx.save();
  ctx.setLineDash([8 / scale, 6 / scale]);
  ctx.lineDashOffset = -(animationTimeMs / 20) / scale;
  ctx.lineWidth = (2 + pulse * 1.1) / scale;
  ctx.strokeStyle = `rgba(252, 197, 21, ${0.55 + pulse * 0.3})`;
  ctx.beginPath();
  ctx.moveTo(sourceX, sourceY);
  ctx.lineTo(targetX, targetY);
  ctx.stroke();

  const angle = Math.atan2(targetY - sourceY, targetX - sourceX);
  const arrowSize = 8 / scale;
  ctx.setLineDash([]);
  ctx.fillStyle = 'rgba(252, 197, 21, 0.92)';
  ctx.beginPath();
  ctx.moveTo(targetX, targetY);
  ctx.lineTo(
    targetX - arrowSize * Math.cos(angle - Math.PI / 6),
    targetY - arrowSize * Math.sin(angle - Math.PI / 6),
  );
  ctx.lineTo(
    targetX - arrowSize * Math.cos(angle + Math.PI / 6),
    targetY - arrowSize * Math.sin(angle + Math.PI / 6),
  );
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawReplacePointerTooltip(
  ctx: CanvasRenderingContext2D,
  pointer: { x: number; y: number },
  scale: number,
): void {
  const label = 'Swap with this photo';
  const padX = 7 / scale;
  const height = 18 / scale;
  const x = pointer.x + 12 / scale;
  const y = pointer.y - 12 / scale;

  ctx.save();
  ctx.font = `600 ${11 / scale}px ui-sans-serif, system-ui, sans-serif`;
  const width = ctx.measureText(label).width + padX * 2;

  ctx.fillStyle = 'rgba(20, 26, 40, 0.9)';
  ctx.fillRect(x, y - height, width, height);

  ctx.fillStyle = '#fff7db';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, x + padX, y - height / 2);
  ctx.restore();
}

function drawHoverFeedback(
  ctx: CanvasRenderingContext2D,
  page: PageLayout,
  hoveredImageId: string,
  scale: number,
): void {
  const hovered = page.items.find((item) => item.imageId === hoveredImageId);
  if (!hovered) {
    return;
  }

  ctx.save();
  ctx.lineWidth = 1.5 / scale;
  ctx.strokeStyle = 'rgba(16, 57, 92, 0.78)';
  ctx.setLineDash([6 / scale, 4 / scale]);
  ctx.strokeRect(hovered.x, hovered.y, hovered.width, hovered.height);
  ctx.restore();
}

function drawDrawerSelectedFeedback(
  ctx: CanvasRenderingContext2D,
  page: PageLayout,
  drawerSelectedImageId: string,
  scale: number,
): void {
  const selected = page.items.find((item) => item.imageId === drawerSelectedImageId);
  if (!selected) {
    return;
  }

  ctx.save();
  ctx.lineWidth = 2.5 / scale;
  ctx.strokeStyle = 'rgba(250, 204, 21, 0.65)';
  ctx.setLineDash([]);
  ctx.strokeRect(selected.x, selected.y, selected.width, selected.height);
  
  // Add a subtle glow effect
  ctx.shadowColor = 'rgba(250, 204, 21, 0.4)';
  ctx.shadowBlur = 12 / scale;
  ctx.lineWidth = 1.5 / scale;
  ctx.strokeStyle = 'rgba(250, 204, 21, 0.35)';
  ctx.strokeRect(selected.x - 2 / scale, selected.y - 2 / scale, selected.width + 4 / scale, selected.height + 4 / scale);
  
  ctx.restore();
}

function drawSelectionFeedback(
  ctx: CanvasRenderingContext2D,
  page: PageLayout,
  selectedImageId: string,
  interactionMode: InteractionMode,
  dragActive: boolean,
  scale: number,
  resizeFeedback?: PreviewOptions['resizeFeedback'],
): void {
  const selected = page.items.find((item) => item.imageId === selectedImageId);
  if (!selected) {
    return;
  }

  // Theme amber accent: #fcc515 (252, 197, 21)
  const interactionColor = RESIZE_ACCENT_STROKE;
  const interactionFill = RESIZE_ACCENT_FILL;
  const thickness = dragActive ? 3 : 2;

  ctx.save();
  ctx.lineWidth = thickness / scale;
  ctx.strokeStyle = interactionColor;
  ctx.fillStyle = interactionFill;
  ctx.fillRect(selected.x, selected.y, selected.width, selected.height);
  ctx.strokeRect(selected.x, selected.y, selected.width, selected.height);

  if (interactionMode === 'crop') {
    const innerX = selected.x + selected.frameThicknessPx;
    const innerY = selected.y + selected.frameThicknessPx;
    const innerW = selected.contentWidthPx;
    const innerH = selected.contentHeightPx;

    ctx.setLineDash([5 / scale, 4 / scale]);
    ctx.lineWidth = 1.5 / scale;
    ctx.beginPath();
    ctx.moveTo(innerX + innerW / 2, innerY);
    ctx.lineTo(innerX + innerW / 2, innerY + innerH);
    ctx.moveTo(innerX, innerY + innerH / 2);
    ctx.lineTo(innerX + innerW, innerY + innerH / 2);
    ctx.stroke();
  } else if (interactionMode === 'resize') {
    const handleSize = 9;
    const half = handleSize / 2;
    const handleX = selected.x + selected.width;
    const handleY = selected.y + selected.height;
    const corners = [
      [selected.x, selected.y],
      [selected.x + selected.width, selected.y],
      [selected.x, selected.y + selected.height],
      [selected.x + selected.width, selected.y + selected.height],
    ];

    ctx.setLineDash([]);
    ctx.fillStyle = dragActive ? 'rgba(252, 197, 21, 0.32)' : 'rgba(252, 197, 21, 0.18)';
    ctx.strokeStyle = interactionColor;
    ctx.lineWidth = 1.3 / scale;
    for (const [cx, cy] of corners) {
      ctx.fillRect(cx - half, cy - half, handleSize, handleSize);
      ctx.strokeRect(cx - half, cy - half, handleSize, handleSize);
    }

    const iconStroke = resizeFeedback?.intent === 'shrink' ? 'rgba(255, 248, 220, 0.98)' : interactionColor;
    const arrowSpan = 10 / scale;
    const arrowBaseX = handleX - 7 / scale;
    const arrowBaseY = handleY - 7 / scale;

    ctx.strokeStyle = iconStroke;
    ctx.lineWidth = 1.8 / scale;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (resizeFeedback?.intent === 'shrink') {
      ctx.beginPath();
      ctx.moveTo(arrowBaseX, arrowBaseY - arrowSpan * 0.5);
      ctx.lineTo(arrowBaseX - arrowSpan * 0.7, arrowBaseY - arrowSpan * 0.5);
      ctx.lineTo(arrowBaseX - arrowSpan * 0.42, arrowBaseY - arrowSpan * 0.78);
      ctx.moveTo(arrowBaseX - arrowSpan * 0.5, arrowBaseY);
      ctx.lineTo(arrowBaseX - arrowSpan * 0.5, arrowBaseY - arrowSpan * 0.7);
      ctx.lineTo(arrowBaseX - arrowSpan * 0.22, arrowBaseY - arrowSpan * 0.42);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.moveTo(arrowBaseX - arrowSpan * 0.78, arrowBaseY - arrowSpan * 0.5);
      ctx.lineTo(arrowBaseX - arrowSpan * 0.08, arrowBaseY - arrowSpan * 0.5);
      ctx.lineTo(arrowBaseX - arrowSpan * 0.34, arrowBaseY - arrowSpan * 0.76);
      ctx.moveTo(arrowBaseX - arrowSpan * 0.5, arrowBaseY - arrowSpan * 0.78);
      ctx.lineTo(arrowBaseX - arrowSpan * 0.5, arrowBaseY - arrowSpan * 0.08);
      ctx.lineTo(arrowBaseX - arrowSpan * 0.76, arrowBaseY - arrowSpan * 0.34);
      ctx.stroke();
    }
  }

  ctx.restore();
}

function drawResizeFeedback(
  ctx: CanvasRenderingContext2D,
  feedback: NonNullable<PreviewOptions['resizeFeedback']>,
  scale: number,
): void {
  const { baseRect, currentRect, intent } = feedback;
  const referenceRect = intent === 'shrink' ? baseRect : currentRect;
  const rightStart = Math.min(baseRect.x + baseRect.width, currentRect.x + currentRect.width);
  const rightEnd = Math.max(baseRect.x + baseRect.width, currentRect.x + currentRect.width);
  const bottomStart = Math.min(baseRect.y + baseRect.height, currentRect.y + currentRect.height);
  const bottomEnd = Math.max(baseRect.y + baseRect.height, currentRect.y + currentRect.height);

  ctx.save();
  ctx.fillStyle = RESIZE_ACCENT_FILL_STRONG;
  ctx.strokeStyle = RESIZE_ACCENT_STROKE;
  ctx.lineWidth = 1.8 / scale;

  if (rightEnd - rightStart > 0.5) {
    ctx.fillRect(rightStart, referenceRect.y, rightEnd - rightStart, referenceRect.height);
  }

  if (bottomEnd - bottomStart > 0.5) {
    ctx.fillRect(referenceRect.x, bottomStart, referenceRect.width, bottomEnd - bottomStart);
  }

  ctx.setLineDash([7 / scale, 5 / scale]);
  ctx.strokeRect(baseRect.x, baseRect.y, baseRect.width, baseRect.height);

  const label = intent === 'shrink' ? 'Shrinks from bottom-right' : 'Expands to right and bottom';
  const labelPaddingX = 7 / scale;
  const labelHeight = 18 / scale;
  const labelX = currentRect.x + 8 / scale;
  const labelY = Math.max(6 / scale, currentRect.y - 24 / scale);

  ctx.setLineDash([]);
  ctx.font = `600 ${11 / scale}px ui-sans-serif, system-ui, sans-serif`;
  const labelWidth = ctx.measureText(label).width + labelPaddingX * 2;
  ctx.fillStyle = 'rgba(20, 26, 40, 0.86)';
  ctx.fillRect(labelX, labelY, labelWidth, labelHeight);
  ctx.fillStyle = '#fff7db';
  ctx.fillText(label, labelX + labelPaddingX, labelY + labelHeight / 2 + 0.4 / scale);
  ctx.restore();
}

function drawMoveOutsideFeedback(
  ctx: CanvasRenderingContext2D,
  page: PageLayout,
  selectedImageId: string,
  scale: number,
): void {
  const selected = page.items.find((item) => item.imageId === selectedImageId);
  if (!selected) {
    return;
  }

  ctx.save();
  ctx.lineWidth = 4 / scale;
  ctx.strokeStyle = 'rgba(220, 38, 38, 0.9)';
  ctx.fillStyle = 'rgba(220, 38, 38, 0.15)';
  ctx.fillRect(selected.x, selected.y, selected.width, selected.height);
  ctx.setLineDash([8 / scale, 5 / scale]);
  ctx.strokeRect(selected.x, selected.y, selected.width, selected.height);

  // Draw X symbol over the image
  const centerX = selected.x + selected.width / 2;
  const centerY = selected.y + selected.height / 2;
  const size = Math.min(selected.width, selected.height) * 0.3;

  ctx.lineWidth = 3 / scale;
  ctx.strokeStyle = 'rgba(220, 38, 38, 0.85)';
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(centerX - size, centerY - size);
  ctx.lineTo(centerX + size, centerY + size);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(centerX + size, centerY - size);
  ctx.lineTo(centerX - size, centerY + size);
  ctx.stroke();

  ctx.restore();
}

function drawResizeLabel(
  ctx: CanvasRenderingContext2D,
  page: PageLayout,
  selectedImageId: string,
  dimensions: { width: number; height: number },
  scale: number,
): void {
  const selected = page.items.find((item) => item.imageId === selectedImageId);
  if (!selected) {
    return;
  }

  // Convert pixels to cm (300 DPI: 1 cm ≈ 118.11 px)
  const pxPerCm = 300 / 2.54;
  const widthCm = dimensions.width / pxPerCm;
  const heightCm = dimensions.height / pxPerCm;
  const label = `${widthCm.toFixed(2)} × ${heightCm.toFixed(2)} cm`;

  const labelInset = 6 / scale;
  const labelPaddingX = 7 / scale;
  const labelPaddingY = 4 / scale;

  ctx.save();
  ctx.font = `600 ${12 / scale}px ui-sans-serif, system-ui, sans-serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';

  const metrics = ctx.measureText(label);
  const textWidth = metrics.width;
  const boxWidth = textWidth + labelPaddingX * 2;
  const boxHeight = 18 / scale;
  const boxX = selected.x + labelInset;
  const boxY = selected.y + labelInset;

  ctx.fillStyle = 'rgba(20, 26, 40, 0.72)';
  ctx.fillRect(boxX, boxY, boxWidth, boxHeight);

  ctx.fillStyle = '#ffffff';
  ctx.fillText(label, boxX + labelPaddingX, boxY + boxHeight / 2 + 0.5 / scale);

  ctx.restore();
}

function drawMoveCollisionFeedback(
  ctx: CanvasRenderingContext2D,
  page: PageLayout,
  selectedImageId: string,
  collisionImageIds: string[],
  scale: number,
): void {
  const selected = page.items.find((item) => item.imageId === selectedImageId);
  if (!selected || !collisionImageIds.length) {
    return;
  }

  ctx.save();

  ctx.lineWidth = 2 / scale;
  ctx.strokeStyle = 'rgba(251, 191, 36, 0.95)';
  ctx.setLineDash([8 / scale, 4 / scale]);
  ctx.strokeRect(selected.x, selected.y, selected.width, selected.height);

  for (const collisionId of collisionImageIds) {
    const collided = page.items.find((item) => item.imageId === collisionId);
    if (!collided) {
      continue;
    }

    ctx.fillStyle = 'rgba(251, 191, 36, 0.16)';
    ctx.fillRect(collided.x, collided.y, collided.width, collided.height);
    ctx.strokeStyle = 'rgba(251, 191, 36, 0.95)';
    ctx.lineWidth = 2.2 / scale;
    ctx.setLineDash([7 / scale, 5 / scale]);
    ctx.strokeRect(collided.x, collided.y, collided.width, collided.height);
  }

  ctx.restore();
}

function drawPage(
  ctx: CanvasRenderingContext2D,
  page: PageLayout,
  itemById: Map<string, ImageItem>,
  imageById: Map<string, HTMLImageElement>,
  options?: {
    imageZoomLevels?: Record<string, number>;
    imagePanOffsets?: Record<string, { x: number; y: number }>;
    swapAnimation?: {
      progress: number;
      transitions: PreviewOptions['swapAnimation']['transitions'];
    } | null;
  },
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

    const swapTransition = options?.swapAnimation?.transitions?.[placed.imageId];
    const animationProgress = options?.swapAnimation?.progress ?? 1;
    const animatedX = swapTransition
      ? swapTransition.from.x + (swapTransition.to.x - swapTransition.from.x) * animationProgress
      : placed.x;
    const animatedY = swapTransition
      ? swapTransition.from.y + (swapTransition.to.y - swapTransition.from.y) * animationProgress
      : placed.y;

    const frameThicknessPx = placed.frameThicknessPx;
    const innerX = animatedX + frameThicknessPx;
    const innerY = animatedY + frameThicknessPx;
    const innerWidth = placed.contentWidthPx;
    const innerHeight = placed.contentHeightPx;

    // Frame is always drawn at its original size — zoom only affects image content inside
    if (frameThicknessPx > 0) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(animatedX, animatedY, placed.width, placed.height);
    }

    const clamped = clampOffsets(
      imageItem.offsetX,
      imageItem.offsetY,
      placed.maxOffsetX,
      placed.maxOffsetY,
    );

    const zoom = options?.imageZoomLevels?.[placed.imageId] ?? 1;
    const pan = options?.imagePanOffsets?.[placed.imageId] ?? { x: 0, y: 0 };

    let drawX: number;
    let drawY: number;
    let drawW: number;
    let drawH: number;

    if (zoom > 1) {
      // Scale up the drawn image around the current visible center,
      // then shift by pan. Pan is stored in drawer CSS px; map to canvas px
      // via ratio of drawnImageWidthPx to approximate drawer display width (400px).
      drawW = placed.drawnImageWidthPx * zoom;
      drawH = placed.drawnImageHeightPx * zoom;

      // Position that keeps the same visible center when zooming
      drawX = innerX + innerWidth / 2 * (1 - zoom) - clamped.offsetX * zoom;
      drawY = innerY + innerHeight / 2 * (1 - zoom) - clamped.offsetY * zoom;

      // Apply pan (drawer pixels → canvas pixels)
      const panScale = placed.drawnImageWidthPx / 400;
      drawX += pan.x * panScale;
      drawY += pan.y * panScale;
    } else {
      drawW = placed.drawnImageWidthPx;
      drawH = placed.drawnImageHeightPx;
      drawX = innerX - clamped.offsetX;
      drawY = innerY - clamped.offsetY;
    }

    ctx.save();
    ctx.beginPath();
    ctx.rect(innerX, innerY, innerWidth, innerHeight);
    ctx.clip();
    ctx.drawImage(img, drawX, drawY, drawW, drawH);
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
  canvas.style.height = 'auto';

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

  let resolvedSwapAnimation: {
    progress: number;
    transitions: NonNullable<PreviewOptions['swapAnimation']>['transitions'];
  } | null = null;

  if (options.swapAnimation && typeof options.animationTimeMs === 'number') {
    const elapsed =
      options.animationTimeMs >= options.swapAnimation.startedTick
        ? options.animationTimeMs - options.swapAnimation.startedTick
        : 10000 - options.swapAnimation.startedTick + options.animationTimeMs;
    const linearProgress = Math.max(0, Math.min(1, elapsed / Math.max(1, options.swapAnimation.durationTicks)));
    const easedProgress = 1 - Math.pow(1 - linearProgress, 3);
    if (linearProgress < 1) {
      resolvedSwapAnimation = {
        progress: easedProgress,
        transitions: options.swapAnimation.transitions,
      };
    }
  }

  drawPage(ctx, page, itemById, imageById, {
    imageZoomLevels: options.imageZoomLevels,
    imagePanOffsets: options.imagePanOffsets,
    swapAnimation: resolvedSwapAnimation,
  });

  if (options.gridEnabled) {
    ctx.save();

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

  if (
    options.interactionMode === 'replace' &&
    options.dragActive &&
    options.hoveredImageId &&
    options.selectedImageId &&
    options.hoveredImageId !== options.selectedImageId
  ) {
    drawReplaceConnectionFeedback(
      ctx,
      page,
      options.selectedImageId,
      options.hoveredImageId,
      scale,
      options.animationTimeMs ?? Date.now(),
    );

    drawReplaceTargetFeedback(
      ctx,
      page,
      options.hoveredImageId,
      scale,
      options.animationTimeMs ?? Date.now(),
    );

    if (options.replacePointer) {
      drawReplacePointerTooltip(ctx, options.replacePointer, scale);
    }
  }

  if (options.hoveredImageId && options.hoveredImageId !== options.selectedImageId) {
    drawHoverFeedback(ctx, page, options.hoveredImageId, scale);
  }

  if (options.placementPreview) {
    drawPlacementPreview(ctx, options.placementPreview, scale);
  }

  if (
    options.drawerSelectedImageId &&
    options.drawerSelectedImageId !== options.selectedImageId &&
    options.drawerSelectedImageId !== options.hoveredImageId
  ) {
    drawDrawerSelectedFeedback(ctx, page, options.drawerSelectedImageId, scale);
  }

  if (options.selectedImageId) {
    drawSelectionFeedback(
      ctx,
      page,
      options.selectedImageId,
      options.interactionMode ?? 'crop',
      options.dragActive ?? false,
      scale,
      options.resizeFeedback,
    );

    if (options.resizeFeedback && options.interactionMode === 'resize') {
      drawResizeFeedback(ctx, options.resizeFeedback, scale);
    }

    if (options.moveOutsideCanvas && options.interactionMode === 'move') {
      drawMoveOutsideFeedback(ctx, page, options.selectedImageId, scale);
    }

    if (options.interactionMode === 'move' && (options.moveCollisionImageIds?.length ?? 0) > 0) {
      drawMoveCollisionFeedback(
        ctx,
        page,
        options.selectedImageId,
        options.moveCollisionImageIds ?? [],
        scale,
      );
    }

    if (options.resizeCurrentDimensions && options.interactionMode === 'resize') {
      drawResizeLabel(ctx, page, options.selectedImageId, options.resizeCurrentDimensions, scale);
    }
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
