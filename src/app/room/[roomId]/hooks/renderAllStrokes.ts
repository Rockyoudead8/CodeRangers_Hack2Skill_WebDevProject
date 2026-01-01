import { CanvasStroke, Point } from "../types/canvas";

interface renderAllStrokesProps {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  canvasStrokes: CanvasStroke[];
}

export const renderAllStrokes = ({
  canvasRef,
  canvasStrokes,
}: renderAllStrokesProps) => {
  const canvas = canvasRef.current;
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  // Clear canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Draw each stroke
  canvasStrokes.forEach((stroke) => {
    ctx.strokeStyle = stroke.color;
    ctx.fillStyle = stroke.color;
    ctx.lineWidth = stroke.lineWidth;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    switch (stroke.tool) {
      case "pencil": {
        if (stroke.points.length < 2) break;
        ctx.beginPath();
        ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
        stroke.points.forEach((point) => {
          ctx.lineTo(point.x, point.y);
        });
        ctx.stroke();
        break;
      }

      case "line": {
        if (stroke.points.length < 2) break;
        const [start, end] = stroke.points;
        ctx.beginPath();
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(end.x, end.y);
        ctx.stroke();
        break;
      }

      case "rect": {
        if (stroke.points.length < 2) break;
        const [start, end] = stroke.points;
        const width = end.x - start.x;
        const height = end.y - start.y;
        ctx.strokeRect(start.x, start.y, width, height);
        break;
      }

      case "circle": {
        if (stroke.points.length < 2) break;
        const [center, edge] = stroke.points;
        const radius = Math.sqrt(
          Math.pow(edge.x - center.x, 2) + Math.pow(edge.y - center.y, 2)
        );
        ctx.beginPath();
        ctx.arc(center.x, center.y, radius, 0, 2 * Math.PI);
        ctx.stroke();
        break;
      }

      case "eraser": {
        // Eraser just clears rectangles at each point
        stroke.points.forEach((point) => {
          ctx.clearRect(
            point.x - stroke.lineWidth / 2,
            point.y - stroke.lineWidth / 2,
            stroke.lineWidth,
            stroke.lineWidth
          );
        });
        break;
      }
    }
  });
};
