// src/app/room/[roomId]/components/ToolbarToggle.tsx

"use client";

interface ToolbarToggleProps {
  isVisible: boolean;
  onToggle: () => void;
}

export default function ToolbarToggle({
  isVisible,
  onToggle,
}: ToolbarToggleProps) {
  return (
    <div className="fixed z-60 bottom-24 left-4 md:left-0 md:top-1/2 md:bottom-auto md:-translate-y-1/2">
      <button
        onClick={onToggle}
        className="bg-white border border-gray-200 md:border-l-0 text-gray-600 p-2 md:pr-3 rounded-full md:rounded-r-xl md:rounded-l-none shadow-md hover:bg-gray-50 transition-colors"
        aria-label={isVisible ? "Hide toolbar" : "Show toolbar"}
      >
        {isVisible ? (
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
            className="rotate-90 md:rotate-0"
          >
            <path d="m15 18-6-6 6-6" />
          </svg>
        ) : (
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
            className="rotate-90 md:rotate-0"
          >
            <path d="m9 18 6-6-6-6" />
          </svg>
        )}
      </button>
    </div>
  );
}
