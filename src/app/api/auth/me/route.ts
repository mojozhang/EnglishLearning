import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const session = request.cookies.get("session")?.value;

    if (!session) {
      return NextResponse.json({ user: null }, { status: 401 });
    }

    const payload = await decrypt(session);

    if (!payload || !payload.userId) {
      return NextResponse.json({ user: null }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.userId as string },
      select: {
        id: true,
        username: true,
        nickname: true,
      },
    });

    if (!user) {
      return NextResponse.json({ user: null }, { status: 401 });
    }

    return NextResponse.json({ user });
  } catch (error) {
    console.error("Get current user error:", error);
    return NextResponse.json({ user: null }, { status: 401 });
  }
}
