import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

export async function POST(req: Request) {
  try {
    const { image } = await req.json();

    if (!image) {
      return NextResponse.json({ error: "Image required" }, { status: 400 });
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
console.log("Image size:", image?.length);

    // Gemini Vision Model
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash"
    });

    const prompt = `
You are an expert meeting assistant analyzing a digital whiteboard.

Understand the handwriting, shapes, arrows and flow.
Extract meaning like a brilliant human.

Return output in this format:

1️⃣ Short Summary
2️⃣ Key Concepts / Sections
3️⃣ Decisions / Ideas
4️⃣ Action Points
5️⃣ Suggestions

Be clear and structured.`;

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
    const text = response.text();

    return NextResponse.json({ summary: text });

  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Vision AI cried and died" },
      { status: 500 }
    );
  }
}
