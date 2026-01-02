import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

export async function POST(req: Request) {
  try {
    const { image } = await req.json();
    if (!image) return NextResponse.json({ error: "Image required" }, { status: 400 });

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash"
    });

    const prompt = `
You are an intelligent whiteboard meeting assistant.
Understand handwriting, shapes, arrows and layouts.

Return a structured summary:

1️⃣ Short Summary
2️⃣ Key Concepts
3️⃣ Important Notes
4️⃣ Action Points
5️⃣ Suggestions
`;

    const result = await model.generateContent([
      {
        inlineData: {
          data: image.split(",")[1],
          mimeType: "image/png",
        },
      },
      prompt
    ]);

    const response = await result.response;
    return NextResponse.json({ summary: response.text() });

  } catch (e) {
    console.log(e);
    return NextResponse.json(
      { error: "Vision AI died emotionally" },
      { status: 500 }
    );
  }
}

