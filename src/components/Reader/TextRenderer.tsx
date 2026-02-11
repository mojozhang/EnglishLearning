"use client";

import { useStore } from "@/store/useStore";
import { clsx } from "clsx";
import { useMemo, useState, useEffect } from "react";

interface TextRendererProps {
  text: string;
  translation?: string;
}

export default function TextRenderer({ text, translation }: TextRendererProps) {
  const vocabulary = useStore((state) => state.vocabulary);
  const addWord = useStore((state) => state.addWord);
  const removeWord = useStore((state) => state.removeWord);

  const [definitions, setDefinitions] = useState<{ [key: string]: string }>({});

  // Split text into paragraphs
  const paragraphs = useMemo(() => {
    return text.split(/\n+/).filter((p) => p.trim().length > 0);
  }, [text]);

  // Split translation into paragraphs
  const cnParagraphs = useMemo(() => {
    if (!translation) return [];
    return translation.split(/\n+/).filter((p) => p.trim().length > 0);
  }, [translation]);

  const playWord = (word: string) => {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(word);
    u.lang = "en-US";
    u.rate = 0.9;
    const voices = window.speechSynthesis.getVoices();
    const enVoice = voices.find((v) => v.lang.startsWith("en"));
    if (enVoice) u.voice = enVoice;
    window.speechSynthesis.speak(u);
  };

  const fetchDefinition = async (word: string) => {
    const cleanWord = word.toLowerCase();
    // Check if we already have it or if it's being fetched (simple dedupe could be added but this is okay for now)
    if (definitions[cleanWord]) return;

    try {
      const res = await fetch(
        `/api/dictionary?word=${encodeURIComponent(cleanWord)}`,
      );
      if (res.ok) {
        const data = await res.json();
        if (data.translation) {
          setDefinitions((prev) => ({
            ...prev,
            [cleanWord]: data.translation,
          }));
        }
      }
    } catch (error) {
      console.error("Failed to fetch definition:", error);
    }
  };

  // Restore definitions for words already in vocabulary when mounting/returning to this view
  useEffect(() => {
    vocabulary.forEach((word) => {
      fetchDefinition(word);
    });
  }, [vocabulary]);

  const handleWordClick = (word: string) => {
    playWord(word);
    const cleanWord = word.toLowerCase();
    if (vocabulary.includes(cleanWord)) {
      removeWord(cleanWord);
    } else {
      addWord(cleanWord);
      fetchDefinition(word);
    }
  };

  const renderParagraph = (paragraphText: string, index: number) => {
    // Updated regex to include words with hyphens (e.g., "decade-old", "book-lovers")
    const tokens = paragraphText
      .split(/([a-zA-Z0-9']+(?:-[a-zA-Z0-9']+)*)/)
      .filter(Boolean);

    // CHECK: If paragraph counts mismatch, we should show translation differently
    const isMismatch =
      cnParagraphs.length !== paragraphs.length && cnParagraphs.length > 0;

    // Logic:
    // 1. If match: Show cnParagraphs[index] under each paragraph.
    // 2. If mismatch: Show NOTHING under intermediate paragraphs,
    //    and show FULL translation under the LAST paragraph.

    const showInterleaved = !isMismatch;
    const showFullAtEnd = isMismatch && index === paragraphs.length - 1;

    return (
      <div key={index} style={{ marginBottom: "2rem" }}>
        <div
          style={{
            lineHeight: 2.8,
            fontSize: "1.25rem",
            whiteSpace: "pre-wrap",
          }}
        >
          {tokens.map((token, idx) => {
            const isWord = /^[a-zA-Z0-9']+(?:-[a-zA-Z0-9']+)*$/.test(token);
            const cleanWord = token.toLowerCase();
            const isSelected = isWord && vocabulary.includes(cleanWord);
            const definition = definitions[cleanWord];

            if (!isWord) return <span key={idx}>{token}</span>;

            return (
              <span
                key={idx}
                style={{
                  position: "relative",
                  display: "inline-block",
                  lineHeight: "1.2",
                }}
              >
                <span
                  onClick={() => handleWordClick(token)}
                  className={clsx(
                    "cursor-pointer transition-colors duration-200 rounded px-0.5",
                    isSelected
                      ? "bg-yellow-200 text-yellow-900 border-b-2 border-yellow-500"
                      : "hover:bg-blue-100",
                  )}
                  style={{
                    backgroundColor: isSelected
                      ? "var(--highlight)"
                      : "transparent",
                    color: isSelected ? "#000" : "inherit",
                    cursor: "pointer",
                    fontWeight: isSelected ? "bold" : "normal",
                  }}
                  title={
                    isSelected ? definition || "加载中..." : "点击加入生词本"
                  }
                >
                  {token}
                </span>
                {isSelected && definition && (
                  <div
                    style={{
                      position: "absolute",
                      left: "50%",
                      transform: "translateX(-50%)",
                      top: "100%",
                      marginTop: "4px",
                      backgroundColor: "rgba(0,0,0,0.8)",
                      color: "#fff",
                      padding: "2px 6px",
                      borderRadius: "4px",
                      fontSize: "0.75rem",
                      whiteSpace: "nowrap",
                      zIndex: 50,
                      pointerEvents: "none",
                      boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
                    }}
                  >
                    {definition}
                  </div>
                )}
              </span>
            );
          })}
        </div>

        {/* Interleaved Translation (Only if counts match) */}
        {showInterleaved &&
          (cnParagraphs[index] ||
            (index === 0 && !cnParagraphs.length && translation)) && (
            <div
              style={{
                marginTop: "0.75rem",
                color: "var(--secondary-foreground)",
                fontSize: "1rem",
                lineHeight: "1.6",
                backgroundColor: "var(--secondary)",
                padding: "0.75rem",
                borderRadius: "var(--radius)",
                borderLeft: "4px solid var(--border)",
              }}
            >
              {cnParagraphs[index] || translation}
            </div>
          )}

        {/* Full Translation Block (Fallback for mismatch) */}
        {showFullAtEnd && translation && (
          <div
            style={{
              marginTop: "1.5rem",
              padding: "1rem",
              backgroundColor: "#f8f9fa",
              borderRadius: "8px",
              borderLeft: "4px solid #f59e0b",
            }}
          >
            <div
              style={{
                fontWeight: 600,
                marginBottom: "0.5rem",
                color: "#b45309",
                fontSize: "0.875rem",
              }}
            >
              参考译文 (自动合并)
            </div>
            <div
              style={{
                color: "var(--secondary-foreground)",
                fontSize: "1rem",
                lineHeight: "1.6",
                whiteSpace: "pre-wrap",
              }}
            >
              {translation}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div>{paragraphs.map((para, index) => renderParagraph(para, index))}</div>
  );
}
