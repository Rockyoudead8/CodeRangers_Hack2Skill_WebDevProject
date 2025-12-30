import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

export async function POST(req: Request) {
  try {
    const { image } = await req.json();
    if (!image) return NextResponse.json({ error: "No image" }, { status: 400 });

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
    const model = genAI.getGenerativeModel({
      model: "models/gemini-2.5-flash"
    });

    const prompt = `
You are analyzing a collaborative digital whiteboard.
It may contain handwriting, shapes, diagrams and rough scribbles.
Extract meaningful intelligence.

Provide output in:

1️⃣ Short Summary
2️⃣ Main Topics Discussed
3️⃣ Key Ideas / Concepts
4️⃣ Decisions / Conclusions
5️⃣ Action Items
6️⃣ Anything Important You Notice

Be structured. Be clear.`;

    const result = await model.generateContent([
      { text: prompt },
      {
        inlineData: {
          data: image.split(",")[1],
          mimeType: "image/png"
        }
      }
    ]);

    const response = await result.response;
    return NextResponse.json({ summary: response.text() });

  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "AI exploded internally" },
      { status: 500 }
    );
  }
}
