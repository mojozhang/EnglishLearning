import { NextRequest, NextResponse } from "next/server";

/**
 * 百度语音识别API集成
 * 接收音频文件，调用百度ASR服务，返回识别文本
 */

// 缓存access token
let cachedToken: { token: string; expires: number } | null = null;

/**
 * 获取百度Access Token
 */
async function getBaiduAccessToken(): Promise<string> {
  const API_KEY = process.env.BAIDU_API_KEY;
  const SECRET_KEY = process.env.BAIDU_SECRET_KEY;

  if (!API_KEY || !SECRET_KEY) {
    throw new Error("百度API密钥未配置");
  }

  // 检查缓存是否有效（百度token有效期30天）
  if (cachedToken && Date.now() < cachedToken.expires) {
    return cachedToken.token;
  }

  const response = await fetch(
    `https://aip.baidubce.com/oauth/2.0/token?grant_type=client_credentials&client_id=${API_KEY}&client_secret=${SECRET_KEY}`,
    { method: "POST" },
  );

  if (!response.ok) {
    throw new Error("获取百度Access Token失败");
  }

  const data = await response.json();

  // 缓存token（提前1天过期）
  cachedToken = {
    token: data.access_token,
    expires: Date.now() + 29 * 24 * 60 * 60 * 1000,
  };

  return data.access_token;
}

/**
 * 调用百度语音识别API
 */
async function callBaiduASR(audioBuffer: Buffer, token: string): Promise<any> {
  // 百度ASR参数
  // dev_pid: 1737 = 英语识别模型
  // format: pcm (原始PCM格式，最通用)
  // rate: 16000 (采样率16kHz)
  // cuid: 设备唯一标识

  // 将Buffer转为base64编码
  const speech = audioBuffer.toString("base64");
  const len = audioBuffer.length;

  const response = await fetch(`https://vop.baidu.com/server_api`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      format: "pcm",
      rate: 16000,
      dev_pid: 1737,
      channel: 1,
      cuid: Date.now().toString(),
      token: token,
      speech: speech,
      len: len,
    }),
  });

  if (!response.ok) {
    throw new Error(`百度API请求失败: ${response.status}`);
  }

  const result = await response.json();

  if (result.err_no !== 0) {
    throw new Error(`百度识别失败: ${result.err_msg} (code: ${result.err_no})`);
  }

  return result;
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const audioFile = formData.get("audio") as Blob;
    const targetText = formData.get("targetText") as string;

    if (!audioFile) {
      return NextResponse.json({ error: "缺少音频文件" }, { status: 400 });
    }

    console.log("Received audio file, size:", audioFile.size);
    console.log("Target text:", targetText);

    // 1. 转换为Buffer
    const buffer = Buffer.from(await audioFile.arrayBuffer());

    // 2. 获取百度Access Token
    const token = await getBaiduAccessToken();

    // 3. 调用百度语音识别API
    const recognitionResult = await callBaiduASR(buffer, token);

    console.log("Recognition result:", recognitionResult);

    // 4. 返回结果
    // result字段可能是数组，取第一个结果
    const recognizedText = Array.isArray(recognitionResult.result)
      ? recognitionResult.result[0]
      : recognitionResult.result;

    return NextResponse.json({
      text: recognizedText || "",
      confidence: recognitionResult.corpus_no || 0,
      raw: recognitionResult,
    });
  } catch (error: any) {
    console.error("Speech recognition error:", error);
    return NextResponse.json(
      { error: error.message || "识别失败" },
      { status: 500 },
    );
  }
}
