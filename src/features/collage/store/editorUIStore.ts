import { create } from 'zustand';

interface EditorUIState {
  drawerSelectedImageId: string | null;
  setDrawerSelectedImageId: (id: string | null) => void;
  imageZoomLevels: Record<string, number>;
  setImageZoomLevels: (imageZoomLevels: Record<string, number>) => void;
  setImageZoom: (imageId: string, zoom: number) => void;
  imagePanOffsets: Record<string, { x: number; y: number }>;
  setImagePanOffsets: (imagePanOffsets: Record<string, { x: number; y: number }>) => void;
  setImagePan: (imageId: string, x: number, y: number) => void;
}

export const useEditorUIStore = create<EditorUIState>((set) => ({
  drawerSelectedImageId: null,
  setDrawerSelectedImageId: (id: string | null) => set({ drawerSelectedImageId: id }),
  imageZoomLevels: {},
  setImageZoomLevels: (imageZoomLevels) => set({ imageZoomLevels }),
  setImageZoom: (imageId: string, zoom: number) =>
    set((state) => ({
      imageZoomLevels: { ...state.imageZoomLevels, [imageId]: zoom },
    })),
  imagePanOffsets: {},
  setImagePanOffsets: (imagePanOffsets) => set({ imagePanOffsets }),
  setImagePan: (imageId: string, x: number, y: number) =>
    set((state) => ({
      imagePanOffsets: { ...state.imagePanOffsets, [imageId]: { x, y } },
    })),
}));
