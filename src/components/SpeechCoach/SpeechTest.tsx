"use client";

import { useState } from "react";
import { Mic } from "lucide-react";

/**
 * 极简测试组件：验证Speech Recognition基础功能
 */
export default function SpeechTest() {
  const [result, setResult] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState("");

  const test = () => {
    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setError("浏览器不支持 Speech Recognition");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.continuous = false;
    recognition.interimResults = true;

    recognition.onstart = () => {
      console.log("Test: Started");
      setIsListening(true);
      setError("");
      setResult("Listening...");
    };

    recognition.onresult = (event: any) => {
      const transcript = Array.from(event.results)
        .map((result: any) => result[0].transcript)
        .join("");
      console.log("Test: Got result:", transcript);
      setResult(transcript);
    };

    recognition.onerror = (event: any) => {
      console.log("Test: Error:", event.error);
      setError(`Error: ${event.error}`);
      setIsListening(false);
    };

    recognition.onend = () => {
      console.log("Test: Ended");
      setIsListening(false);
    };

    try {
      recognition.start();
    } catch (e: any) {
      setError(`Start failed: ${e.message}`);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        bottom: 20,
        right: 20,
        padding: "1rem",
        backgroundColor: "#1f2937",
        color: "white",
        borderRadius: 8,
        minWidth: 250,
        zIndex: 9999,
      }}
    >
      <h3 style={{ margin: 0, marginBottom: "1rem", fontSize: "0.875rem" }}>
        🧪 Speech Recognition 测试
      </h3>

      <button
        onClick={test}
        disabled={isListening}
        style={{
          width: "100%",
          padding: "0.75rem",
          backgroundColor: isListening ? "#ef4444" : "#3b82f6",
          color: "white",
          border: "none",
          borderRadius: 4,
          cursor: isListening ? "not-allowed" : "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "0.5rem",
        }}
      >
        <Mic size={16} />
        {isListening ? "正在听..." : "点击测试"}
      </button>

      {result && (
        <div
          style={{
            marginTop: "1rem",
            padding: "0.5rem",
            backgroundColor: "#10b981",
            borderRadius: 4,
            fontSize: "0.875rem",
          }}
        >
          识别结果: {result}
        </div>
      )}

      {error && (
        <div
          style={{
            marginTop: "1rem",
            padding: "0.5rem",
            backgroundColor: "#ef4444",
            borderRadius: 4,
            fontSize: "0.875rem",
          }}
        >
          {error}
        </div>
      )}

      <div
        style={{
          marginTop: "1rem",
          fontSize: "0.75rem",
          color: "#9ca3af",
        }}
      >
        💡 说明：此测试使用系统默认麦克风
      </div>
    </div>
  );
}
