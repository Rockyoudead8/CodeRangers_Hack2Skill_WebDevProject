# 🧠 CollabBoard – Real-Time Collaborative AI Whiteboard

CollabBoard is a **real-time collaborative infinite whiteboard platform** designed for brainstorming, teaching, planning, and team collaboration.  
It combines **live drawing**, **real-time sync**, **AI assistance**, and **audio/video communication** into one unified experience.

> Built as part of **HackSkill / Hackathon Project** by **Team CodeRangers**

---

## 🚀 Live Demo
https://collaboard-a19i.onrender.com/login

---

## 👥 Team CodeRangers
- Arpit Goyal  
- Vaibhav Kumar Shashwat  
- Archisman Naskar  
- **Arpit Kumar Shrivastava**

---

## ✨ Key Features

### 🖌️ Infinite Whiteboard
- Smooth freehand drawing
- Shapes, text, eraser tools
- Infinite canvas with pan & zoom
- Real-time cursor & drawing sync

---

### 👥 Real-Time Collaboration
- Multiple users join the same room
- Live board updates using **Socket.io**
- Room-based collaboration using unique `roomId`

---

### 🎥 Audio & Video Calling (LiveKit)
- Built-in **real-time video & audio calls**
- One call per whiteboard room
- Secure WebRTC connection using LiveKit
- Mute / Unmute microphone
- Camera on / off
- Auto participant management

---

### 🤖 AI-Powered Features
- **AI Whiteboard Summary**
  - Generates concise summaries of board content
- **Visual Understanding**
  - Reads the entire whiteboard (not just visible area)
- **Auto Shape Correction**
  - Converts rough sketches into clean shapes
- Powered by **Google Gemini AI**

---

### ☁️ Google Drive Integration
- Save whiteboard snapshots directly to Google Drive
- Useful for documentation and sharing

---

### 🔐 Authentication & Security
- Firebase Authentication
- Secure user sessions
- LiveKit tokens generated server-side only
- No sensitive keys exposed on frontend

---

## 🧱 Tech Stack

### Frontend
- **Next.js (App Router)**
- React + TypeScript
- Tailwind CSS
- HTML5 Canvas

### Backend / Infrastructure
- Node.js
- Socket.io (real-time sync)
- Firebase (Auth + Firestore)

### Video & Audio
- **LiveKit (WebRTC)**

### AI & Processing
- Google Gemini API

---

## 🗂️ Project Structure

src/
┣ app/
┃ ┣ api/
┃ ┃ ┣ livekit/
┃ ┃ ┃ ┗ token/route.ts
┃ ┣ room/[roomId]/
┃ ┃ ┣ components/
┃ ┃ ┃ ┣ Board.tsx
┃ ┃ ┃ ┣ Canvas.tsx
┃ ┃ ┃ ┣ VideoCall.tsx
┃ ┃ ┃ ┣ Toolbar.tsx
┃ ┃ ┃ ┗ RoomHeader.tsx
┃ ┃ ┣ hooks/
┃ ┃ ┣ utils/
┃ ┃ ┗ page.tsx
┣ lib/
┣ utils/
┗ globals.css


---

## ⚙️ Environment Variables

Create a `.env.local` file in the root:

```env
# Firebase
NEXT_PUBLIC_FIREBASE_API_KEY=xxxx
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=xxxx

# LiveKit
LIVEKIT_API_KEY=xxxx
LIVEKIT_API_SECRET=xxxx
LIVEKIT_URL=wss://xxxx.livekit.cloud

# Google AI
GEMINI_API_KEY=xxxx

---

## How to run locally 
▶️ Running Locally
1️⃣ Install dependencies
npm install

2️⃣ Start development server
npm run dev

---

🧪 How to Test Video Call

Open the same room in two browsers

Click 🎥 Join Call

Allow camera & microphone

You will see and hear each other in real time

🧠 How It Works (High Level)
User joins Room
   ↓
Socket.io syncs whiteboard
   ↓
LiveKit token generated (server)
   ↓
WebRTC video/audio connection
   ↓
AI processes whiteboard data

🏆 Why CollabBoard?

Combines collaboration + communication + AI

Designed for classrooms, hackathons, teams, and remote work

Lightweight, scalable, and extensible

Inspired by tools like Miro, FigJam, Notion Whiteboard, but smarter

---

## 🔮 Future Enhancements

Screen sharing

Call recording

AI meeting summary

Voice-to-text notes

Role-based permissions

Export to PDF / image

---

##📜 License

This project is built for educational and hackathon purposes.

---

## 🙌 Acknowledgements

LiveKit

Google Gemini AI

Firebase

Open-source community
---
