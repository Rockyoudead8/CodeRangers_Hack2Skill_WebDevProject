// 'use client';

// import { useState } from 'react';
// import { useRouter } from 'next/navigation';
// // We don't need to emit socket events here anymore, just navigation
// // But if you use socket.id for userId generation, keep the import
// import { socket } from '../lib/socket'; 

// export default function Home() {
//   const [roomCode, setRoomCode] = useState('');
//   const [joinCode, setJoinCode] = useState('');
//   const [copied, setCopied] = useState(false);
//   const router = useRouter();

//   const generateRoomCode = () => {
//     const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
//     let code = '';
//     for (let i = 0; i < 20; i++) {
//       code += chars.charAt(Math.floor(Math.random() * chars.length));
//     }
//     return code;
//   };

//   const handleGenerate = () => {
//     setRoomCode(generateRoomCode());
//   };

//   const handleCopy = async () => {
//     if (roomCode) {
//       await navigator.clipboard.writeText(roomCode);
//       setCopied(true);
//       setCopied(true);
//       setTimeout(() => setCopied(false), 2000);
//     }
//   };

//   const handleCreateRoom = () => {
//     if (!roomCode) {
//       alert('Please generate a room code first');
//       return;
//     }
//     // FIX: Just navigate. The Room page will handle the socket connection.
//     router.push(`/room/${roomCode}`);
//   };

//   const handleJoinRoom = () => {
//     if (!joinCode.trim()) {
//       alert('Please enter a room code');
//       return;
//     }
//     // FIX: Just navigate. The Room page will handle the socket connection.
//     router.push(`/room/${joinCode.trim()}`);
//   };

//   return (
//     <div className="bg-gradient-to-br from-blue-50 to-indigo-50 min-h-screen flex items-center justify-center p-4">
//       <div className="w-full max-w-5xl mx-auto">
//         <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
//           {/* Create Room */}
//           <div className="bg-white rounded-lg border-2 border-blue-300 p-6 md:p-8 shadow-sm hover:shadow-md transition-shadow">
//             <h1 className="text-2xl md:text-4xl font-bold text-blue-600 text-center mb-6 md:mb-8">
//               Create Room
//             </h1>
//             <div className="space-y-4">
//               <div>
//                 <label className="block text-sm font-medium text-gray-700 mb-2">
//                   Room Code
//                 </label>
                
//                 {/* FIX APPLIED BELOW: 
//                    Changed 'sm:flex-row' to 'xl:flex-row'. 
//                    This keeps the elements stacked vertically on Tablets/Laptops 
//                    where the 2-column grid makes the card too narrow for a horizontal layout.
//                 */}
//                 <div className="flex flex-col xl:flex-row gap-2 items-stretch">
//                   <input
//                     type="text"
//                     value={roomCode}
//                     placeholder="Generate room code"
//                     className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 text-sm md:text-base"
//                     readOnly
//                   />
//                   {/* Added flex-row for buttons so they sit side-by-side when the parent is vertical */}
//                   <div className="flex flex-row gap-2">
//                     <button
//                       onClick={handleGenerate}
//                       className="flex-1 xl:flex-none px-4 py-2 bg-blue-600 text-white text-sm md:text-base font-semibold rounded-md hover:bg-blue-700 transition-colors whitespace-nowrap"
//                     >
//                       Generate
//                     </button>
//                     <button
//                       onClick={handleCopy}
//                       className="flex-1 xl:flex-none px-4 py-2 bg-white text-red-600 text-sm md:text-base font-semibold rounded-md border-2 border-red-600 hover:bg-red-50 transition-colors whitespace-nowrap"
//                     >
//                       {copied ? 'Copied!' : 'Copy'}
//                     </button>
//                   </div>
//                 </div>
//               </div>
//               <button
//                 onClick={handleCreateRoom}
//                 className="w-full bg-blue-600 text-white font-bold py-3 rounded-md hover:bg-blue-700 transition-colors mt-4"
//               >
//                 Create Room
//               </button>
//             </div>
//           </div>

//           {/* Join Room */}
//           <div className="bg-white rounded-lg border-2 border-blue-300 p-6 md:p-8 shadow-sm hover:shadow-md transition-shadow">
//             <h1 className="text-2xl md:text-4xl font-bold text-blue-600 text-center mb-6 md:mb-8">
//               Join Room
//             </h1>
//             <div className="space-y-4">
//               <div>
//                 <label className="block text-sm font-medium text-gray-700 mb-2">
//                   Room Code
//                 </label>
//                 <input
//                   type="text"
//                   value={joinCode}
//                   onChange={(e) => setJoinCode(e.target.value)}
//                   placeholder="Enter room code"
//                   className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm md:text-base"
//                 />
//               </div>
//               <button
//                 onClick={handleJoinRoom}
//                 className="w-full bg-blue-600 text-white font-bold py-3 rounded-md hover:bg-blue-700 transition-colors mt-4"
//               >
//                 Join Room
//               </button>
//             </div>
//           </div>
//         </div>
//       </div>
//     </div>
//   );
// }

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { socket } from '../lib/socket'; 
import { Sparkles, Copy, Check, PlusCircle, Users, KeyRound, ArrowRightCircle } from "lucide-react";

export default function Home() {
  const [roomCode, setRoomCode] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [copied, setCopied] = useState(false);
  const router = useRouter();

  const generateRoomCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let code = '';
    for (let i = 0; i < 20; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  };

  const handleGenerate = () => {
    setRoomCode(generateRoomCode());
  };

  const handleCopy = async () => {
    if (roomCode) {
      await navigator.clipboard.writeText(roomCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleCreateRoom = () => {
    if (!roomCode) {
      alert('Please generate a room code first');
      return;
    }
    router.push(`/room/${roomCode}`);
  };

  const handleJoinRoom = () => {
    if (!joinCode.trim()) {
      alert('Please enter a room code');
      return;
    }
    router.push(`/room/${joinCode.trim()}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-950 flex items-center justify-center p-6 text-white">
      <div className="w-full max-w-6xl mx-auto">

        <div className="text-center mb-10 space-y-2">
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-wide flex items-center justify-center gap-3">
            <Sparkles className="text-blue-400 animate-pulse" />
            Real-Time Collaboration Hub
            <Sparkles className="text-purple-400 animate-pulse" />
          </h1>
          <p className="text-gray-400 text-sm">
            Create or join a live collaborative whiteboard. No pressure. Just chaos.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">

          {/* Create Room */}
          <div className="bg-gray-900/70 backdrop-blur-xl border border-gray-800 rounded-2xl shadow-xl hover:shadow-blue-800/40 hover:-translate-y-1 transition p-8">
            <div className="flex items-center justify-center gap-2 mb-6">
              <PlusCircle className="text-blue-400" size={34} />
              <h2 className="text-3xl font-bold text-blue-400 tracking-wide">
                Create Room
              </h2>
            </div>

            <label className="block text-sm text-gray-400 mb-2">
              Room Code
            </label>

            <div className="flex flex-col xl:flex-row gap-3">
              <input
                type="text"
                value={roomCode}
                readOnly
                placeholder="Generate room code"
                className="flex-1 px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />

              <div className="flex gap-3">
                <button
                  onClick={handleGenerate}
                  className="px-5 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg flex items-center gap-2 transition"
                >
                  <KeyRound size={18} />
                  Generate
                </button>

                <button
                  onClick={handleCopy}
                  className="px-5 py-3 bg-transparent border border-red-500 text-red-400 hover:bg-red-500/10 font-semibold rounded-lg flex items-center gap-2 transition"
                >
                  {copied ? <Check size={18} /> : <Copy size={18} />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
            </div>

            <button
              onClick={handleCreateRoom}
              className="w-full mt-7 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition flex items-center justify-center gap-2 shadow-lg shadow-blue-700/40"
            >
              <ArrowRightCircle size={20} />
              Launch Room
            </button>
          </div>

          {/* Join Room */}
          <div className="bg-gray-900/70 backdrop-blur-xl border border-gray-800 rounded-2xl shadow-xl hover:shadow-purple-800/40 hover:-translate-y-1 transition p-8">
            <div className="flex items-center justify-center gap-2 mb-6">
              <Users className="text-purple-400" size={34} />
              <h2 className="text-3xl font-bold text-purple-400 tracking-wide">
                Join Room
              </h2>
            </div>

            <label className="block text-sm text-gray-400 mb-2">
              Room Code
            </label>

            <input
              type="text"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
              placeholder="Enter room code"
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
            />

            <button
              onClick={handleJoinRoom}
              className="w-full mt-7 py-3 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-lg transition flex items-center justify-center gap-2 shadow-lg shadow-purple-700/40"
            >
              <ArrowRightCircle size={20} />
              Enter Room
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
