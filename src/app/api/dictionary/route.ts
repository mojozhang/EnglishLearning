import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const word = searchParams.get("word");

  if (!word) {
    return NextResponse.json({ error: "Word is required" }, { status: 400 });
  }

  try {
    // Use Google Translate unofficial API with 'gtx' client
    // dt=bd gets dictionary results
    // dt=t gets simple translation
    const response = await fetch(
      `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=zh-CN&dt=t&dt=bd&q=${encodeURIComponent(word)}`,
    );

    if (!response.ok) {
      throw new Error("Failed to fetch from translation service");
    }

    const data = await response.json();

    // data format is array of arrays.
    // data[0] is simple translation chunks
    // data[1] is dictionary entries (if available)

    let result = {
      translation: "",
      dictionary: [] as string[],
    };

    // 1. Simple Translation
    if (data[0] && Array.isArray(data[0])) {
      result.translation = data[0].map((item: any) => item[0]).join("");
    }

    // 2. Dictionary Entries
    // Format: [["noun", ["word1", "word2"], ...], ["verb", ...]]
    if (data[1] && Array.isArray(data[1])) {
      result.dictionary = data[1].map((entry: any) => {
        const pos = entry[0]; // part of speech (e.g. "adjective")
        const terms = entry[1].slice(0, 5).join(", "); // first 5 terms
        return `${pos}: ${terms}`;
      });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Dictionary API Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch definition" },
      { status: 500 },
    );
  }
}
