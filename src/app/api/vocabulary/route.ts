import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/auth";

// Get all vocabulary for current user
export async function GET(request: NextRequest) {
  try {
    const session = request.cookies.get("session")?.value;
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = await decrypt(session);
    if (!payload || !payload.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const vocabulary = await prisma.vocabulary.findMany({
      where: { userId: payload.userId as string },
      orderBy: { addedAt: "desc" },
    });

    return NextResponse.json({ vocabulary });
  } catch (error) {
    console.error("Get vocabulary error:", error);
    return NextResponse.json(
      { error: "Failed to fetch vocabulary" },
      { status: 500 },
    );
  }
}

// Sync vocabulary (batch update/create)
export async function POST(request: NextRequest) {
  try {
    const session = request.cookies.get("session")?.value;
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = await decrypt(session);
    if (!payload || !payload.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { words } = await request.json();

    // Use upsert to create or update each word
    const userId = payload.userId as string;
    const operations = words.map(
      (wordData: { word: string; mastered: boolean; reviewCount: number }) =>
        prisma.vocabulary.upsert({
          where: {
            userId_word: {
              userId,
              word: wordData.word,
            },
          },
          update: {
            mastered: wordData.mastered,
            reviewCount: wordData.reviewCount,
          },
          create: {
            userId,
            word: wordData.word,
            mastered: wordData.mastered,
            reviewCount: wordData.reviewCount,
          },
        }),
    );

    await prisma.$transaction(operations);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Sync vocabulary error:", error);
    return NextResponse.json(
      { error: "Failed to sync vocabulary" },
      { status: 500 },
    );
  }
}
