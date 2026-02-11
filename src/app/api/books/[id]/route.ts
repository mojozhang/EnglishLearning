import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/auth";

// Get specific book
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const session = request.cookies.get("session")?.value;
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = await decrypt(session);
    if (!payload || !payload.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const book = await prisma.book.findFirst({
      where: {
        id: id,
        userId: payload.userId as string,
      },
    });

    if (!book) {
      return NextResponse.json({ error: "Book not found" }, { status: 404 });
    }

    return NextResponse.json({
      book: {
        ...book,
        content: JSON.parse(book.content),
      },
    });
  } catch (error) {
    console.error("Get book error:", error);
    return NextResponse.json(
      { error: "Failed to fetch book" },
      { status: 500 },
    );
  }
}

// Update book progress
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const session = request.cookies.get("session")?.value;
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = await decrypt(session);
    if (!payload || !payload.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { progress, currentPhase, currentSentenceIndex } =
      await request.json();

    console.log("更新书籍数据:", {
      bookId: id,
      progress,
      currentPhase,
      currentSentenceIndex,
    });

    const updateData: any = {};
    if (progress !== undefined) updateData.progress = progress;
    if (currentPhase !== undefined) updateData.currentPhase = currentPhase;
    if (currentSentenceIndex !== undefined)
      updateData.currentSentenceIndex = currentSentenceIndex;

    console.log("准备更新:", updateData);

    const book = await prisma.book.updateMany({
      where: {
        id: id,
        userId: payload.userId as string,
      },
      data: updateData,
    });

    if (book.count === 0) {
      return NextResponse.json({ error: "Book not found" }, { status: 404 });
    }

    console.log("书籍更新成功:", book.count);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Update book error详细信息:", error);
    return NextResponse.json(
      { error: "Failed to update book", details: String(error) },
      { status: 500 },
    );
  }
}

// Delete book
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const session = request.cookies.get("session")?.value;
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = await decrypt(session);
    if (!payload || !payload.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await prisma.book.deleteMany({
      where: {
        id: id,
        userId: payload.userId as string,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete book error:", error);
    return NextResponse.json(
      { error: "Failed to delete book" },
      { status: 500 },
    );
  }
}
