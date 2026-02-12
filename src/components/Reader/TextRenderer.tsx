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
      <div key={index} style={{ marginBottom: "2.5rem" }} className="animate-slide-up">
        <div
          style={{
            lineHeight: 2.5, // Increased line height to fit annotations comfortably
            fontSize: "1.35rem",
            fontWeight: 400,
            whiteSpace: "pre-wrap",
            color: "var(--foreground)",
            letterSpacing: "-0.01em"
          }}
        >
          {tokens.map((token, idx) => {
            const isWord = /^[a-zA-Z0-9']+(?:-[a-zA-Z0-9']+)*$/.test(token);
            const cleanWord = token.toLowerCase();
            const isSelected = isWord && vocabulary.includes(cleanWord);
            const definition = definitions[cleanWord];

            if (!isWord) return <span key={idx} style={{ opacity: 0.8 }}>{token}</span>;

            return (
              <span
                key={idx}
                style={{
                  position: "relative",
                  display: "inline-block",
                }}
              >
                <span
                  onClick={() => handleWordClick(token)}
                  style={{
                    backgroundColor: isSelected
                      ? "var(--highlight)"
                      : "transparent",
                    color: isSelected ? "#854d0e" : "inherit",
                    cursor: "pointer",
                    fontWeight: isSelected ? 700 : 450,
                    padding: "0 0.2rem",
                    borderRadius: "6px",
                    transition: "all 0.2s",
                    borderBottom: isSelected ? "2px solid #eab308" : "1px solid transparent",
                    boxShadow: isSelected ? "0 4px 6px -1px rgba(234, 179, 8, 0.2)" : "none"
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) e.currentTarget.style.backgroundColor = "rgba(99, 102, 241, 0.1)";
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) e.currentTarget.style.backgroundColor = "transparent";
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
                      top: "100%", // Below the word
                      marginTop: "-3px", // Pull up closer to the word (User requested "up 3px, stick to top")
                      backgroundColor: "rgba(0,0,0,0.75)",
                      color: "white",
                      padding: "1px 5px",
                      borderRadius: "4px",
                      fontSize: "0.7rem",
                      lineHeight: "1.2",
                      fontWeight: 500,
                      whiteSpace: "nowrap",
                      zIndex: 50,
                      pointerEvents: "none",
                      boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                    }}
                  >
                    {definition}
                  </div>
                )}
              </span>
            );
          })}
        </div>

        {/* Interleaved Translation */}
        {showInterleaved &&
          (cnParagraphs[index] ||
            (index === 0 && !cnParagraphs.length && translation)) && (
            <div
              style={{
                marginTop: "1rem",
                color: "var(--secondary-foreground)",
                fontSize: "1.05rem",
                lineHeight: "1.6",
                backgroundColor: "var(--glass)",
                padding: "1rem 1.25rem",
                borderRadius: "14px",
                borderLeft: "5px solid var(--primary)",
                boxShadow: "var(--shadow-sm)",
                fontStyle: "italic",
                opacity: 0.9
              }}
            >
              {cnParagraphs[index] || translation}
            </div>
          )}

        {/* Full Translation Block (Fallback for mismatch) */}
        {showFullAtEnd && translation && (
          <div
            className="glass-card"
            style={{
              marginTop: "2rem",
              padding: "1.5rem",
              background: "rgba(245, 158, 11, 0.05)",
              borderLeft: "5px solid var(--accent)",
            }}
          >
            <div
              style={{
                fontWeight: 800,
                marginBottom: "0.75rem",
                color: "var(--accent)",
                fontSize: "0.8rem",
                textTransform: "uppercase",
                letterSpacing: "0.05em"
              }}
            >
              参考译文 (自动对齐)
            </div>
            <div
              style={{
                color: "var(--foreground)",
                fontSize: "1.05rem",
                lineHeight: "1.6",
                whiteSpace: "pre-wrap",
                opacity: 0.9
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
