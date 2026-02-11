"use client";

import { useState, useEffect, useRef } from "react";
import { useStore } from "@/store/useStore";
import { Check, X, Search, RotateCw } from "lucide-react";

export default function VocabularyTrainer() {
  const {
    vocabularyDB,
    chunks,
    currentChunkIndex,
    setPhase,
    markWordAsMastered,
  } = useStore();

  // Get all words from vocabularyDB
  const allWords = Object.keys(vocabularyDB);
  const masteredWords = Object.entries(vocabularyDB)
    .filter(([_, data]) => data.mastered)
    .map(([word]) => word);

  // Queue of words to review (local state)
  // We initialize it with words that are NOT yet mastered.
  const [reviewQueue, setReviewQueue] = useState<string[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);

  const [showDefinition, setShowDefinition] = useState(false);
  const [definitionData, setDefinitionData] = useState<{
    translation: string;
    dictionary: string[];
  } | null>(null);
  const [isLoadingDef, setIsLoadingDef] = useState(false);

  // Initialize queue on mount or vocabulary change
  useEffect(() => {
    if (!isInitialized && allWords.length > 0) {
      const initialQueue = allWords.filter((w) => !masteredWords.includes(w));
      setReviewQueue(initialQueue);
      setIsInitialized(true);
    }
  }, [allWords.length, isInitialized]);

  // Current word is simply the head of the queue
  const currentWord = reviewQueue.length > 0 ? reviewQueue[0] : null;
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Play word implementation
  const playWord = (word: string, repeatCount: number = 1) => {
    // Stop any pending speech or timeouts
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    window.speechSynthesis.cancel();

    if (!word) return;

    const speakOnce = (count: number) => {
      if (count <= 0) return;

      const u = new SpeechSynthesisUtterance(word);
      u.lang = "en-US";
      u.rate = 0.8;
      u.volume = 1.0;

      const voices = window.speechSynthesis.getVoices();
      const voice = voices.find((v) => v.lang.startsWith("en"));
      if (voice) u.voice = voice;

      u.onend = () => {
        if (count > 1) {
          timeoutRef.current = setTimeout(() => speakOnce(count - 1), 600);
        } else {
          utteranceRef.current = null;
        }
      };

      u.onerror = (e) => {
        // Ignore interruption or cancel errors
        if (e.error !== "interrupted" && e.error !== "canceled") {
          console.error("TTS Error:", e);
        }
      };

      utteranceRef.current = u;
      window.speechSynthesis.speak(u);
    };

    // Small delay to ensure voices are loaded or previous audio is cleared
    timeoutRef.current = setTimeout(() => speakOnce(repeatCount), 100);
  };

  // Auto-play when word changes
  useEffect(() => {
    if (currentWord) {
      // Play 3 times as requested
      playWord(currentWord, 3);
    }
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      window.speechSynthesis.cancel();
    };
  }, [currentWord]);

  useEffect(() => {
    setDefinitionData(null);
    setShowDefinition(false);
    setIsLoadingDef(true);

    if (!currentWord) {
      setIsLoadingDef(false);
      return;
    }

    // Call our local API
    fetch(`/api/dictionary?word=${encodeURIComponent(currentWord)}`)
      .then((res) => res.json())
      .then((data) => {
        if (data && !data.error) {
          setDefinitionData(data);
        }
      })
      .catch((err) => {
        console.error("Dictionary error:", err);
      })
      .finally(() => {
        setIsLoadingDef(false);
      });
  }, [currentWord]);

  const handleKnown = () => {
    if (!currentWord) return;

    // 1. Mark as mastered in store (persisted)
    markWordAsMastered(currentWord);

    // 2. Remove from queue
    setReviewQueue((prev) => prev.slice(1));
  };

  const handleUnknown = () => {
    if (!currentWord) return;

    // 1. Move current word to the end of the queue (or offset it)
    // Simple "Ebbinghaus-lite": see it again later.
    setReviewQueue((prev) => {
      const newQueue = [...prev];
      const word = newQueue.shift();
      if (word) {
        // Insert back at a minimal distance (e.g. 3rd position) or end if specific request?
        // User said: "Show again after a while" (过一会再显示).
        // If queue is short (<3), just append. If long, maybe insert at 3?
        // Let's just append to end for simplicity and guaranteed cycle.
        newQueue.push(word);
      }
      return newQueue;
    });
  };

  if (allWords.length === 0) {
    return (
      <div style={{ textAlign: "center", marginTop: "4rem" }}>
        <h2 style={{ fontSize: "1.5rem", marginBottom: "1rem" }}>
          生词本为空。
        </h2>
        <button
          onClick={() => setPhase("SPEAKING")}
          className="bg-black text-white px-6 py-2 rounded"
        >
          跳过，进入口语练习
        </button>
      </div>
    );
  }

  if (isInitialized && reviewQueue.length === 0) {
    // All done!
    return (
      <div style={{ textAlign: "center", marginTop: "4rem" }}>
        <h2
          style={{
            fontSize: "2rem",
            marginBottom: "2rem",
            color: "var(--success)",
          }}
        >
          恭喜！所有单词已掌握！🎉
        </h2>
        <button
          onClick={() => setPhase("SPEAKING")}
          style={{
            backgroundColor: "var(--foreground)",
            color: "var(--background)",
            padding: "1rem 3rem",
            borderRadius: "var(--radius)",
            fontSize: "1.25rem",
            fontWeight: 600,
          }}
        >
          开始口语练习
        </button>
      </div>
    );
  }

  // Progress based on mastered count vs total vocabulary
  const progress = (masteredWords.length / allWords.length) * 100;

  return (
    <div
      style={{
        maxWidth: "600px",
        margin: "0 auto",
        textAlign: "center",
        display: "flex",
        flexDirection: "column",
        gap: "2rem",
        height: "100%",
      }}
    >
      {/* Progress Bar */}
      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: "0.875rem",
            color: "var(--secondary-foreground)",
          }}
        >
          <span>已掌握: {masteredWords.length}</span>
          <span>剩余: {reviewQueue.length}</span>
          <span>总计: {allWords.length}</span>
        </div>
        <div
          style={{
            width: "100%",
            height: "8px",
            background: "var(--border)",
            borderRadius: "4px",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${progress}%`,
              height: "100%",
              background: "var(--success)",
              transition: "width 0.3s ease",
            }}
          />
        </div>
      </div>

      {/* Card */}
      <div
        style={{
          padding: "4rem 2rem",
          backgroundColor: "var(--background)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius)",
          boxShadow:
            "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "2rem",
          minHeight: "300px",
          position: "relative",
        }}
      >
        <h2
          style={{
            fontSize: "3rem",
            fontWeight: 800,
            color: "var(--primary)",
            cursor: "pointer",
          }}
          onClick={() => playWord(currentWord || "", 1)}
          title="点击播放"
        >
          {currentWord || "加载中..."}
        </h2>

        {/* Context - Always Visible */}
        {/* Context - Always Visible */}
        <div
          style={{
            marginTop: "1rem",
            marginBottom: "1rem",
            padding: "1rem",
            background: "var(--secondary)",
            borderRadius: "var(--radius)",
            fontSize: "1.125rem",
            lineHeight: 1.6,
            fontStyle: "italic",
            color: "var(--secondary-foreground)",
            width: "100%",
          }}
        >
          {(() => {
            const contextSentence = (
              chunks[currentChunkIndex]?.en
                .split(".")
                .find((s) =>
                  s.toLowerCase().includes((currentWord || "").toLowerCase()),
                ) || "未找到上下文"
            ).trim();
            if (!currentWord) return "加载中...";

            const parts = contextSentence.split(
              new RegExp(`(${currentWord})`, "gi"),
            );
            return (
              <span>
                "...
                {parts.map((part, i) =>
                  part.toLowerCase() === currentWord.toLowerCase() ? (
                    <span
                      key={i}
                      style={{ color: "var(--primary)", fontWeight: "bold" }}
                    >
                      {part}
                    </span>
                  ) : (
                    part
                  ),
                )}
                ..."
              </span>
            );
          })()}
        </div>

        {/* Definition - Hidden by Default */}
        <div
          style={{
            minHeight: "60px",
            width: "100%",
            display: "flex",
            justifyContent: "center",
          }}
        >
          {isLoadingDef ? (
            <p style={{ opacity: 0.5 }}>加载释义中...</p>
          ) : showDefinition ? (
            definitionData ? (
              <div
                style={{
                  textAlign: "left",
                  display: "inline-block",
                  maxWidth: "100%",
                }}
              >
                {definitionData.dictionary &&
                definitionData.dictionary.length > 0 ? (
                  <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                    {definitionData.dictionary.map(
                      (entry: string, idx: number) => (
                        <li
                          key={idx}
                          style={{
                            fontSize: "1.25rem",
                            color: "var(--foreground)",
                            marginBottom: "0.5rem",
                          }}
                        >
                          {entry}
                        </li>
                      ),
                    )}
                  </ul>
                ) : (
                  <p style={{ fontSize: "1.5rem", color: "var(--foreground)" }}>
                    (中文释义: {definitionData.translation})
                  </p>
                )}
              </div>
            ) : (
              <p style={{ opacity: 0.5 }}>未找到释义。</p>
            )
          ) : (
            <button
              onClick={() => setShowDefinition(true)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                color: "var(--primary)",
                border: "1px solid var(--primary)",
                padding: "0.5rem 1rem",
                borderRadius: "var(--radius)",
                fontSize: "0.875rem",
                background: "transparent",
                cursor: "pointer",
              }}
            >
              <Search size={16} />
              查看释义
            </button>
          )}
        </div>
      </div>

      {/* Actions */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "1rem",
          marginTop: "auto",
        }}
      >
        <button
          onClick={handleUnknown}
          style={{
            padding: "1rem",
            backgroundColor: "#fee2e2", // red-100
            color: "#991b1b", // red-800
            borderRadius: "var(--radius)",
            fontSize: "1.125rem",
            fontWeight: 600,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "0.5rem",
            border: "1px solid #fecaca",
          }}
        >
          <X size={24} />
          不认识
        </button>

        <button
          onClick={handleKnown}
          style={{
            padding: "1rem",
            backgroundColor: "#dcfce7", // green-100
            color: "#166534", // green-800
            borderRadius: "var(--radius)",
            fontSize: "1.125rem",
            fontWeight: 600,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "0.5rem",
            border: "1px solid #bbf7d0",
          }}
        >
          <Check size={24} />
          我认识
        </button>
      </div>
    </div>
  );
}
