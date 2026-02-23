import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { RotateCcw, X, ZoomIn, ZoomOut } from "lucide-react";

// ---------------------------------------------------------------------------
// Standalone Dialog Component
// ---------------------------------------------------------------------------

const ZOOM_STEP = 0.25;
const MIN_ZOOM = 0.25;
const MAX_ZOOM = 5;

interface ImagePreviewDialogProps {
  open: boolean;
  src: string;
  onOpenChange: (open: boolean) => void;
}

export function ImagePreviewDialog({ open, src, onOpenChange }: ImagePreviewDialogProps) {
  const [zoom, setZoom] = useState(1);
  const [dragging, setDragging] = useState(false);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragStart = useRef({ x: 0, y: 0, ox: 0, oy: 0 });

  // Reset zoom/pan when image changes or dialog opens
  useEffect(() => {
    if (open) {
      setZoom(1);
      setOffset({ x: 0, y: 0 });
    }
  }, [open, src]);

  const zoomIn = useCallback(() => {
    setZoom((z) => Math.min(z + ZOOM_STEP, MAX_ZOOM));
  }, []);

  const zoomOut = useCallback(() => {
    setZoom((z) => Math.max(z - ZOOM_STEP, MIN_ZOOM));
  }, []);

  const resetZoom = useCallback(() => {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  }, []);

  // Mouse wheel zoom
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
    setZoom((z) => Math.min(Math.max(z + delta, MIN_ZOOM), MAX_ZOOM));
  }, []);

  // Pan via drag (only when zoomed in)
  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (zoom <= 1) return;
      e.preventDefault();
      setDragging(true);
      dragStart.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    [zoom, offset],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragging) return;
      setOffset({
        x: dragStart.current.ox + (e.clientX - dragStart.current.x),
        y: dragStart.current.oy + (e.clientY - dragStart.current.y),
      });
    },
    [dragging],
  );

  const handlePointerUp = useCallback(() => {
    setDragging(false);
  }, []);

  // Keyboard: +/- for zoom, 0 to reset
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "+" || e.key === "=") { e.preventDefault(); setZoom((z) => Math.min(z + ZOOM_STEP, MAX_ZOOM)); }
      else if (e.key === "-" || e.key === "_") { e.preventDefault(); setZoom((z) => Math.max(z - ZOOM_STEP, MIN_ZOOM)); }
      else if (e.key === "0") { e.preventDefault(); setZoom(1); setOffset({ x: 0, y: 0 }); }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open]);

  const zoomPercent = Math.round(zoom * 100);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className="fixed inset-0 z-50 bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
        />
        <DialogPrimitive.Content
          className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden"
          onClick={(e) => {
            if (e.target === e.currentTarget) onOpenChange(false);
          }}
          onWheel={handleWheel}
        >
          <DialogPrimitive.Title className="sr-only">Image Preview</DialogPrimitive.Title>

          {/* Top-right close button */}
          <DialogPrimitive.Close className="absolute top-4 right-4 z-10 rounded-full bg-background/80 p-2 text-foreground opacity-70 hover:opacity-100 transition-opacity">
            <X className="h-5 w-5" />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>

          {/* Bottom toolbar */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1 rounded-full bg-background/80 px-3 py-1.5 shadow-lg backdrop-blur-sm">
            <button
              type="button"
              onClick={zoomOut}
              disabled={zoom <= MIN_ZOOM}
              className="p-1 rounded-full hover:bg-muted disabled:opacity-30 transition-colors"
              title="Zoom out (−)"
            >
              <ZoomOut className="h-4 w-4" />
            </button>
            <span className="text-xs font-medium w-12 text-center select-none tabular-nums">
              {zoomPercent}%
            </span>
            <button
              type="button"
              onClick={zoomIn}
              disabled={zoom >= MAX_ZOOM}
              className="p-1 rounded-full hover:bg-muted disabled:opacity-30 transition-colors"
              title="Zoom in (+)"
            >
              <ZoomIn className="h-4 w-4" />
            </button>
            <div className="w-px h-4 bg-border mx-1" />
            <button
              type="button"
              onClick={resetZoom}
              className="p-1 rounded-full hover:bg-muted transition-colors"
              title="Reset zoom (0)"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
          </div>

          {/* Image */}
          {src && (
            <img
              src={src}
              alt="Preview"
              draggable={false}
              className="select-none rounded-md"
              style={{
                maxWidth: zoom <= 1 ? "95vw" : undefined,
                maxHeight: zoom <= 1 ? "92vh" : undefined,
                transform: `scale(${zoom}) translate(${offset.x / zoom}px, ${offset.y / zoom}px)`,
                transformOrigin: "center center",
                cursor: zoom > 1 ? (dragging ? "grabbing" : "grab") : "default",
                transition: dragging ? "none" : "transform 0.15s ease",
              }}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
            />
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

// ---------------------------------------------------------------------------
// Hook — manages preview state + returns the dialog element
// ---------------------------------------------------------------------------

export function useImagePreviewDialog() {
  const [open, setOpen] = useState(false);
  const [src, setSrc] = useState("");

  const preview = useCallback((imageSrc: string) => {
    setSrc(imageSrc);
    setOpen(true);
  }, []);

  const dialog = open ? (
    <ImagePreviewDialog open={open} src={src} onOpenChange={setOpen} />
  ) : null;

  return { preview, dialog };
}

// ---------------------------------------------------------------------------
// Hook — attach click-to-preview on all <img> inside a container ref
// Useful for Tiptap editor/viewer where images are rendered by ProseMirror.
// ---------------------------------------------------------------------------

export function useImageClickPreview(
  containerRef: RefObject<HTMLElement | null>,
) {
  const { preview, dialog } = useImagePreviewDialog();
  const previewRef = useRef(preview);
  previewRef.current = preview;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    function handleClick(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (target.tagName === "IMG") {
        const src = (target as HTMLImageElement).src;
        if (src) {
          e.preventDefault();
          e.stopPropagation();
          previewRef.current(src);
        }
      }
    }

    container.addEventListener("click", handleClick);
    return () => container.removeEventListener("click", handleClick);
  }, [containerRef]);

  return dialog;
}
