import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { text, targetLang = "zh-CN" } = await request.json();

    if (!text) {
      return NextResponse.json({ error: "Text is required" }, { status: 400 });
    }

    // Use Google Translate unofficial API 'gtx'
    const response = await fetch(
      `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`,
    );

    if (!response.ok) {
      throw new Error("Failed to fetch from translation service");
    }

    const data = await response.json();

    // data[0] contains the translated segments
    let translation = "";
    if (data && data[0] && Array.isArray(data[0])) {
      translation = data[0].map((item: any) => item[0]).join("");
    }

    return NextResponse.json({ translation });
  } catch (error) {
    console.error("Translation API Error:", error);
    return NextResponse.json({ error: "Failed to translate" }, { status: 500 });
  }
}
