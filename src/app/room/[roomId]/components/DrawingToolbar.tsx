// src/app/room/[roomId]/components/DrawingToolbar.tsx

"use client";

interface DrawingToolbarProps {
  isVisible: boolean;
  selectedTool: string;
  selectedColor: string;
  brushSize: number;
  onToolChange: (tool: string) => void;
  onColorChange: (color: string) => void;
  onBrushSizeChange: (size: number) => void;
  onImageUpload: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onClear: () => void;
}

export default function DrawingToolbar({
  isVisible,
  selectedTool,
  selectedColor,
  brushSize,
  onToolChange,
  onColorChange,
  onBrushSizeChange,
  onImageUpload,
  onUndo,
  onRedo,
  onClear,
}: DrawingToolbarProps) {
  const tools = [
    {
      name: "pencil",
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
          <path d="m15 5 4 4" />
        </svg>
      ),
    },
    {
      name: "line",
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M5 12h14" />
        </svg>
      ),
    },
    {
      name: "rect",
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
        </svg>
      ),
    },
    {
      name: "circle",
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="10" />
        </svg>
      ),
    },
    {
      name: "eraser",
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21" />
          <path d="M22 21H7" />
          <path d="m5 11 9 9" />
        </svg>
      ),
    },
  ];

  return (
    <aside
      className={`
        fixed z-50
        bg-white/95 backdrop-blur-sm shadow-xl border border-gray-200/60 p-3
        flex gap-5 transition-all duration-300 ease-in-out
        
        /* MOBILE STYLES */
        bottom-6 left-1/2 -translate-x-1/2 rounded-full flex-row items-center
        ${
          isVisible
            ? "translate-y-0 opacity-100"
            : "translate-y-[200%] opacity-0"
        }

        /* DESKTOP STYLES */
        md:top-[60%] md:left-4 md:bottom-auto md:translate-x-0 md:-translate-y-1/2 md:rounded-2xl md:flex-col md:items-start
        md:${isVisible ? "md:translate-x-0" : "md:-translate-x-[150%]"}
      `}
    >
      <div className="flex md:flex-col flex-row gap-1.5">
        {tools.map((tool) => (
          <button
            key={tool.name}
            onClick={() => onToolChange(tool.name)}
            className={`p-2.5 rounded-xl flex items-center justify-center transition-all ${
              selectedTool === tool.name
                ? "bg-black text-white"
                : "hover:bg-gray-100 text-gray-500"
            }`}
          >
            {tool.icon}
          </button>
        ))}
      </div>

      <div className="md:h-px md:w-full w-px h-8 bg-gray-200"></div>

      <div className="flex md:flex-col flex-row gap-2 items-center">
        <input
          type="color"
          value={selectedColor}
          onChange={(e) => onColorChange(e.target.value)}
          className="w-8 h-8 rounded-full border-2 border-white cursor-pointer"
        />
        <input
          type="range"
          min="1"
          max="20"
          value={brushSize}
          onChange={(e) => onBrushSizeChange(Number(e.target.value))}
          className="md:w-1.5 md:h-20 w-20 h-1.5 bg-gray-200 rounded-full appearance-none cursor-pointer"
          style={
            {
              writingMode:
                typeof window !== "undefined" && window.innerWidth >= 768
                  ? "vertical-lr"
                  : "horizontal-tb",
            } as any
          }
        />
      </div>

      <div className="md:h-px md:w-full w-px h-8 bg-gray-200"></div>

      <button
        onClick={onImageUpload}
        className="p-1 rounded-xl flex items-center justify-center transition-all hover:bg-gray-100 text-gray-500"
        title="Upload Image"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
          <circle cx="9" cy="9" r="2" />
          <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
        </svg>
      </button>

      <div className="md:h-px md:w-full w-px h-8 bg-gray-200"></div>

      <div className="flex md:flex-col flex-row gap-1">
        <button
          onClick={onUndo}
          className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M3 7v6h6" />
            <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" />
          </svg>
        </button>
        <button
          onClick={onRedo}
          className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 7v6h-6" />
            <path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3l3 2.7" />
          </svg>
        </button>
        <button
          onClick={onClear}
          className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M3 6h18" />
            <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
            <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
          </svg>
        </button>
      </div>
    </aside>
  );
}
