// src/app/room/[roomId]/components/WhiteboardHeader.tsx

"use client";

interface WhiteboardHeaderProps {
  roomId: string;
  users: any[];
  onAddBoard: () => void;
  onSaveToDrive: () => void;
  onLogout: () => void;
}

export default function WhiteboardHeader({
  roomId,
  users,
  onAddBoard,
  onSaveToDrive,
  onLogout,
}: WhiteboardHeaderProps) {
  return (
    <header className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between shadow-sm z-70 shrink-0">
      <div className="flex flex-col">
        <h1 className="text-lg font-semibold text-gray-900 tracking-tight flex items-center gap-2">
          Whiteboard
        </h1>
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <span>Room:</span>
          <code className="bg-gray-100 px-1.5 py-0.5 rounded text-gray-700 font-mono">
            {roomId}
          </code>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative group z-50">
          <button className="flex items-center gap-2 bg-gray-50 hover:bg-gray-100 border border-gray-200 px-3 py-1.5 rounded-full transition-colors cursor-default">
            <span className="text-sm font-medium text-gray-600">
              {users.length} Online
            </span>
          </button>
          <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-xl shadow-xl border border-gray-100 p-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200">
            <p className="text-xs font-semibold text-gray-400 px-2 py-1 uppercase">
              Current Users
            </p>
            <ul className="flex flex-col gap-1 overflow-y-auto max-h-40">
              {users.map((user, i) => (
                <li
                  key={i}
                  className="flex items-center gap-2 px-2 py-1.5 hover:bg-gray-50 rounded-lg transition-colors"
                >
                  <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] text-white font-bold bg-blue-500 overflow-hidden">
                    {user.id ? user.id.charAt(0).toUpperCase() : "?"}
                  </div>
                  <span
                    className="text-sm text-gray-600 truncate max-w-[120px]"
                    title={user.id}
                  >
                    {user.id}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <button
          onClick={onAddBoard}
          className="flex items-center gap-2 bg-gray-900 hover:bg-black text-white text-sm font-medium px-4 py-2 rounded-lg"
        >
          Add Board
        </button>

        <button
          onClick={onSaveToDrive}
          className="bg-green-600 hover:bg-green-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors shadow-sm"
        >
          Save to Google Drive
        </button>

        <button
          onClick={onLogout}
          className="bg-red-500 hover:bg-red-600 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors shadow-sm"
        >
          Logout
        </button>
      </div>
    </header>
  );
}
