'use client';

import { Users, Rocket, HeartHandshake, BrainCircuit } from "lucide-react";

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-950 text-white px-8 py-16">
      
      {/* Title Section */}
      <div className="max-w-4xl mx-auto text-center">
        <h1 className="text-5xl font-extrabold">
          About <span className="text-blue-500">CollabBoard</span>
        </h1>

        <p className="text-gray-400 mt-4 text-lg">
          A project that definitely didn’t start at 3AM with caffeine and panic.
          Instead, it’s a carefully designed platform to make collaboration feel effortless, fast and actually fun.
        </p>
      </div>

      {/* Stats */}
      <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6 mt-14">
        
        <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-6 text-center hover:-translate-y-1 transition">
          <Users className="mx-auto text-blue-400" size={40}/>
          <h2 className="text-xl font-semibold mt-3">Built for Teams</h2>
          <p className="text-gray-400 text-sm mt-2">
            Brainstorm, plan, create and argue peacefully… all in real-time.
          </p>
        </div>

        <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-6 text-center hover:-translate-y-1 transition">
          <Rocket className="mx-auto text-purple-400" size={40}/>
          <h2 className="text-xl font-semibold mt-3">Lightning Fast</h2>
          <p className="text-gray-400 text-sm mt-2">
            Zero lag. Zero friction. Pure productivity and mild chaos.
          </p>
        </div>

        <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-6 text-center hover:-translate-y-1 transition">
          <BrainCircuit className="mx-auto text-green-400" size={40}/>
          <h2 className="text-xl font-semibold mt-3">Smart & Secure</h2>
          <p className="text-gray-400 text-sm mt-2">
            Powered by modern tech, protected like your questionable browsing history.
          </p>
        </div>
      </div>

      {/* Mission Section */}
      <div className="max-w-4xl mx-auto mt-20 text-center">
        <HeartHandshake className="mx-auto text-pink-400" size={50}/>
        <h2 className="text-3xl font-bold mt-4">Our Mission</h2>

        <p className="text-gray-400 mt-4 leading-relaxed">
          We believe creativity shouldn’t be locked behind complicated tools.
          CollabBoard was created to let people think freely, sketch boldly,
          and collaborate without feeling like they’re fighting the UI.
          Whether you’re a student, developer, designer or someone pretending to work,
          CollabBoard is your space to create something meaningful.
        </p>
      </div>

      {/* Footer */}
      <div className="text-center text-gray-500 text-sm mt-20">
        Built with patience, sleepless nights, and probably way too much caffeine.
        <br />
        CollabBoard © 2025
      </div>

    </div>
  );
}
