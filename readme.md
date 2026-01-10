# 🧠 Real-Time Collaborative Whiteboard

A **real-time collaborative whiteboard platform** with live drawing, multi-user audio communication, AI-powered summarization, and cloud export capabilities.  
Built for remote collaboration, online classrooms, brainstorming sessions, and team meetings.

---

## 🚀 Features

### 🎨 Real-Time Whiteboard
- Live multi-user drawing using WebSockets
- Pencil, line, rectangle, circle, and eraser tools
- Infinite canvas with pan & zoom
- Undo / redo and canvas reset
- Real-time synchronization across all users in a room

### ✨ Smart Shape Detection
- Automatically detects rough hand-drawn shapes
- Converts freehand drawings into clean:
  - Lines
  - Rectangles
  - Circles
- Improves readability while keeping natural drawing flow

### 📝 Boards & Media
- Add floating text boards (sticky notes style)
- Drag, rename, edit, and delete boards in real time
- Upload and place images directly onto the canvas

### 🔊 Live Audio and Video Calling (SFU-Based)
- Built-in **multi-user audio communication**
- Powered by **LiveKit (SFU architecture)** for scalability
- Join / leave audio rooms
- Mute and unmute microphone
- Real-time **speaker detection** showing who is currently speaking

### 🤖 AI-Powered Summarization
- AI summary of:
  - Current viewport
  - Entire whiteboard
- Converts whiteboard visuals into textual summaries
- Useful for meeting notes and brainstorming recap

### ☁️ Google Drive Export
- Export full whiteboard snapshot as an image
- Automatically calculates canvas bounds
- Uploads securely to Google Drive using OAuth 2.0

---

## 🛠️ Tech Stack

### Frontend
- **Next.js (App Router)**
- **React + TypeScript**
- **Tailwind CSS**
- **Canvas API**

### Real-Time & Collaboration
- **Socket.IO** – real-time drawing sync
- **LiveKit** – scalable SFU-based audio calling

### Backend & Services
- **Firebase Authentication**
- **Firestore / Database for board persistence**
- **Google Drive API**
- **AI Vision APIs** – board summarization

---

## 🧩 Architecture Overview

Clients (Browser)
↓ WebSocket
Real-time Sync Server (Socket.IO)
↓
Persistent Storage (Boards / Strokes)
↓
LiveKit SFU (Audio)
↓
AI Services (Summarization)
---

## 🧪 Key Highlights

- SFU-based audio (scalable and production-ready)
- Optimized canvas rendering with throttled updates
- Smart geometry detection for better UX
- Real-time speaker indication
- AI-assisted collaboration

---

## ⚙️ Setup Instructions

### 1️⃣ Clone the Repository
```bash
1.git clone https://github.com/your-username/your-repo-name.git
2.cd your-repo-name
3.npm install
4.NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_LIVEKIT_URL=...
LIVEKIT_API_KEY=...
LIVEKIT_API_SECRET=...
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
5.npm run dev

