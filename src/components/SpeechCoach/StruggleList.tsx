"use client";

import { Volume2, AlertCircle, Clock } from "lucide-react";

export interface StruggleItem {
  word: string;
  type: "stuck" | "wrong";
  timestamp: number;
}

interface StruggleListProps {
  items: StruggleItem[];
}

export default function StruggleList({ items }: StruggleListProps) {
  const speak = (text: string) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-US";
    window.speechSynthesis.speak(utterance);
  };

  if (items.length === 0) return null;

  return (
    <div
      style={{
        position: "fixed",
        right: "20px",
        top: "50%",
        transform: "translateY(-50%)",
        width: "200px",
        background: "var(--background)",
        border: "1px solid var(--border)",
        borderRadius: "12px",
        boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
        padding: "1rem",
        maxHeight: "80vh",
        overflowY: "auto",
        zIndex: 50,
      }}
    >
      <h3
        style={{
          fontSize: "1rem",
          fontWeight: 600,
          marginBottom: "0.5rem",
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
        }}
      >
        <AlertCircle size={16} />
        Focus Words
      </h3>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        {items.map((item, index) => (
          <button
            key={`${item.word}-${item.timestamp}-${index}`}
            onClick={() => speak(item.word)}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "0.5rem",
              borderRadius: "6px",
              border: "1px solid",
              borderColor: item.type === "stuck" ? "#fde047" : "#fca5a5", // Yellow-400 vs Red-300
              backgroundColor: item.type === "stuck" ? "#fef9c3" : "#fef2f2", // Yellow-50 vs Red-50
              cursor: "pointer",
              textAlign: "left",
              width: "100%",
            }}
            title={
              item.type === "stuck"
                ? "Stuck (Hesitation)"
                : "Mispronounced / Skipped"
            }
          >
            <span style={{ fontWeight: 500, color: "#1f2937" }}>
              {item.word}
            </span>
            {item.type === "stuck" ? (
              <Clock size={14} color="#eab308" />
            ) : (
              <AlertCircle size={14} color="#ef4444" />
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
