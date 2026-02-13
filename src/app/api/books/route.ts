import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/auth";

// Get all books for current user
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

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");
    const skip = (page - 1) * limit;

    const [books, total] = await Promise.all([
      prisma.book.findMany({
        where: { userId: payload.userId as string },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        select: {
          id: true,
          title: true,
          progress: true,
          currentPhase: true,
          currentSentenceIndex: true,
          createdAt: true,
          updatedAt: true,
          // content: false, // Don't fetch heavy content list
        },
      }),
      prisma.book.count({
        where: { userId: payload.userId as string },
      }),
    ]);

    return NextResponse.json({
      books,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Get books error:", error);
    return NextResponse.json(
      { error: "Failed to fetch books" },
      { status: 500 },
    );
  }
}

// Create a new book
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

    const { title, content, progress } = await request.json();

    // Security Check: Limit content size to ~10MB to prevent DoS
    const contentSize = JSON.stringify(content).length;
    if (contentSize > 10 * 1024 * 1024) {
      return NextResponse.json(
        { error: "书籍内容过大，最大限制为 10MB" },
        { status: 413 }, // Payload Too Large
      );
    }

    const book = await prisma.book.create({
      data: {
        userId: payload.userId as string,
        title,
        content: JSON.stringify(content), // Store chunks as JSON string
        progress: progress || 0,
      },
    });

    return NextResponse.json(
      {
        book: {
          ...book,
          content: JSON.parse(book.content),
        },
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Create book error:", error);
    return NextResponse.json(
      { error: "Failed to create book" },
      { status: 500 },
    );
  }
}
