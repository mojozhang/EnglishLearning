import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword, encrypt } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const { username, password, nickname } = await request.json();

    // Validation
    if (!username || !password) {
      return NextResponse.json(
        { error: "用户名和密码为必填项" },
        { status: 400 },
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "密码长度至少为 6 位" },
        { status: 400 },
      );
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { username },
    });

    if (existingUser) {
      return NextResponse.json({ error: "用户名已存在" }, { status: 409 });
    }

    // Hash password
    const hashedPassword = await hashPassword(password);

    // Create user
    const user = await prisma.user.create({
      data: {
        username,
        password: hashedPassword,
        nickname: nickname || username,
      },
    });

    // Generate JWT token
    const token = await encrypt({
      userId: user.id,
      username: user.username,
    });

    // Set cookie
    const response = NextResponse.json(
      {
        user: {
          id: user.id,
          username: user.username,
          nickname: user.nickname,
        },
      },
      { status: 201 },
    );

    response.cookies.set("session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("Register error:", error);
    return NextResponse.json(
      { error: "注册失败，请稍后重试" },
      { status: 500 },
    );
  }
}
