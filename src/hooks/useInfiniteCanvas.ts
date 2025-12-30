// src/hooks/useInfiniteCanvas.ts

import { useRef, useEffect, useCallback } from "react";

interface ViewportState {
  offsetX: number;
  offsetY: number;
  scale: number;
}

export function useInfiniteCanvas(
  canvasRef: React.RefObject<HTMLCanvasElement>,
  containerRef: React.RefObject<HTMLDivElement>
) {
  const viewportRef = useRef<ViewportState>({
    offsetX: 0,
    offsetY: 0,
    scale: 1,
  });

  const isPanningRef = useRef(false);
  const lastPanPointRef = useRef({ x: 0, y: 0 });

  // Convert screen coordinates to canvas coordinates
  const screenToCanvas = useCallback((screenX: number, screenY: number) => {
    const viewport = viewportRef.current;
    return {
      x: (screenX - viewport.offsetX) / viewport.scale,
      y: (screenY - viewport.offsetY) / viewport.scale,
    };
  }, []);

  // Convert canvas coordinates to screen coordinates
  const canvasToScreen = useCallback((canvasX: number, canvasY: number) => {
    const viewport = viewportRef.current;
    return {
      x: canvasX * viewport.scale + viewport.offsetX,
      y: canvasY * viewport.scale + viewport.offsetY,
    };
  }, []);

  // Apply current transform to canvas context
  const applyTransform = useCallback((ctx: CanvasRenderingContext2D) => {
    const viewport = viewportRef.current;
    ctx.setTransform(
      viewport.scale,
      0,
      0,
      viewport.scale,
      viewport.offsetX,
      viewport.offsetY
    );
  }, []);

  // Reset transform (useful before clearing or measuring)
  const resetTransform = useCallback((ctx: CanvasRenderingContext2D) => {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }, []);

  // Pan the viewport
  const pan = useCallback((dx: number, dy: number) => {
    viewportRef.current.offsetX += dx;
    viewportRef.current.offsetY += dy;
  }, []);

  // Zoom with center point
  const zoom = useCallback(
    (delta: number, centerX: number, centerY: number) => {
      const viewport = viewportRef.current;
      const oldScale = viewport.scale;

      // Clamp scale between 0.1x and 5x
      const newScale = Math.max(0.1, Math.min(5, oldScale * (1 + delta)));

      if (newScale === oldScale) return;

      // Adjust offset to zoom toward the center point
      const scaleChange = newScale / oldScale;
      viewport.offsetX = centerX - (centerX - viewport.offsetX) * scaleChange;
      viewport.offsetY = centerY - (centerY - viewport.offsetY) * scaleChange;
      viewport.scale = newScale;
    },
    []
  );

  // Setup pan controls (middle mouse button or space + drag)
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const rect = canvas.getBoundingClientRect();
        zoom(-e.deltaY * 0.001, e.clientX - rect.left, e.clientY - rect.top);

        // Redraw is handled by parent component
        canvas.dispatchEvent(new CustomEvent("viewport-changed"));
      }
    };

    const handleMouseDown = (e: MouseEvent) => {
      // Middle mouse button or space + left click for panning
      if (e.button === 1 || (e.button === 0 && e.shiftKey)) {
        e.preventDefault();
        isPanningRef.current = true;
        lastPanPointRef.current = { x: e.clientX, y: e.clientY };
        canvas.style.cursor = "grabbing";
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isPanningRef.current) return;

      const dx = e.clientX - lastPanPointRef.current.x;
      const dy = e.clientY - lastPanPointRef.current.y;

      pan(dx, dy);
      lastPanPointRef.current = { x: e.clientX, y: e.clientY };

      // Trigger redraw
      canvas.dispatchEvent(new CustomEvent("viewport-changed"));
    };

    const handleMouseUp = () => {
      if (isPanningRef.current) {
        isPanningRef.current = false;
        canvas.style.cursor = "crosshair";
      }
    };

    canvas.addEventListener("wheel", handleWheel, { passive: false });
    canvas.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      canvas.removeEventListener("wheel", handleWheel);
      canvas.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [zoom, pan]);

  return {
    viewport: viewportRef.current,
    screenToCanvas,
    canvasToScreen,
    applyTransform,
    resetTransform,
    pan,
    zoom,
  };
}
