/**
 * Collage Editor Context
 * Provides centralized state management to avoid prop drilling
 */

import type { ReactNode } from 'react';
import { createContext, useContext } from 'react';
import type { ImageItem, InteractionMode, PaginationMode, PageLayout, PositionedImage, PreviewTransform } from '../model/types';
import type { DragState } from '../../../shared/drag';

export interface CollageEditorContextValue {
  // State
  images: ImageItem[];
  pages: PageLayout[];
  maxImageCm: number;
  minImageCm: number;
  frameMm: number;
  gridModeEnabled: boolean;
  autoCompactPages: boolean;
  paginationMode: PaginationMode;
  interactionMode: InteractionMode;
  selectedImageId: string | null;
  hoveredImageId: string | null;
  dragActive: boolean;
  moveOutsideCanvas: boolean;
  selectedPageIndex: number;
  overflowImageIds: string[];
  oversizedImageIds: string[];
  resizeLimitNotice: string;
  resizeCurrentDimensions: { width: number; height: number } | null;
  error: string;
  isHydrated: boolean;

  // References
  previewCanvasRef: React.RefObject<HTMLCanvasElement | null>;
  previewTransformRef: React.MutableRefObject<PreviewTransform | null>;
  dragStateRef: React.MutableRefObject<DragState | null>;

  // Memos
  selectedPage: PageLayout | null;
  selectedImage: ImageItem | null;

  // State setters
  setMaxImageCm: (value: number) => void;
  setMinImageCm: (value: number) => void;
  setFrameMm: (value: number) => void;
  setGridModeEnabled: (value: boolean) => void;
  setAutoCompactPages: (value: boolean) => void;
  setPaginationMode: (value: PaginationMode) => void;
  setInteractionMode: (value: InteractionMode) => void;
  setSelectedImageId: (value: string | null) => void;
  setHoveredImageId: (value: string | null) => void;
  setDragActive: (value: boolean) => void;
  setMoveOutsideCanvas: (value: boolean) => void;
  setSelectedPageIndex: (value: number) => void;
  setResizeLimitNotice: (value: string) => void;
  setResizeCurrentDimensions: (value: { width: number; height: number } | null) => void;
  setError: (value: string) => void;

  // Image operations
  updateImage: (id: string, patch: Partial<ImageItem>) => void;
  updateImageBatch: (updates: Array<{ id: string; patch: Partial<ImageItem> }>) => void;

  // Page operations
  setPages: (pages: PageLayout[]) => void;
  setOverflowImageIds: (ids: string[]) => void;
  setOversizedImageIds: (ids: string[]) => void;
}

const CollageEditorContext = createContext<CollageEditorContextValue | undefined>(undefined);

export function useCollageEditorContext(): CollageEditorContextValue {
  const context = useContext(CollageEditorContext);
  if (!context) {
    throw new Error('useCollageEditorContext must be used within CollageEditorProvider');
  }
  return context;
}

export function CollageEditorProvider({
  children,
  value,
}: {
  children: ReactNode;
  value: CollageEditorContextValue;
}) {
  return <CollageEditorContext.Provider value={value}>{children}</CollageEditorContext.Provider>;
}
