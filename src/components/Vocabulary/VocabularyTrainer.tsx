"use client";

import { useState, useEffect, useRef } from "react";
import { useStore } from "@/store/useStore";
import { Check, X, Search, RotateCw, Loader2 } from "lucide-react";

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
      className="animate-slide-up"
      style={{
        maxWidth: "640px",
        margin: "0 auto",
        textAlign: "center",
        display: "flex",
        flexDirection: "column",
        gap: "1.5rem",
        height: "100%",
        padding: "0 1rem"
      }}
    >
      {/* Progress Bar Container */}
      <div className="glass-card" style={{ padding: "1rem 1.5rem", background: "var(--glass)" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: "0.8rem",
            fontWeight: 700,
            color: "var(--secondary-foreground)",
            marginBottom: "0.75rem",
            textTransform: "uppercase",
            letterSpacing: "0.05em"
          }}
        >
          <span style={{ color: "var(--success)" }}>已击败: {masteredWords.length}</span>
          <span>待挑战: {reviewQueue.length}</span>
        </div>
        <div
          style={{
            width: "100%",
            height: "10px",
            background: "rgba(0,0,0,0.05)",
            borderRadius: "20px",
            overflow: "hidden",
            boxShadow: "inset 0 1px 3px rgba(0,0,0,0.1)"
          }}
        >
          <div
            style={{
              width: `${progress}%`,
              height: "100%",
              background: "linear-gradient(90deg, var(--success), #34d399)",
              transition: "width 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)",
              borderRadius: "20px"
            }}
          />
        </div>
      </div>

      {/* Main Study Card */}
      <div
        className="glass-card"
        style={{
          padding: "3.5rem 2rem",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "2rem",
          minHeight: "380px",
          position: "relative",
          background: "var(--secondary)",
          border: "2px solid var(--border)"
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <h2
            style={{
              fontSize: "4rem",
              fontWeight: 900,
              color: "var(--primary)",
              cursor: "pointer",
              letterSpacing: "-0.04em",
              lineHeight: 1,
              transition: "transform 0.2s"
            }}
            onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.05)")}
            onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
            onClick={() => playWord(currentWord || "", 1)}
            title="点击发音"
          >
            {currentWord || "..."}
          </h2>
          <div style={{ opacity: 0.5, display: "flex", justifyContent: "center" }}>
            <RotateCw size={16} className="animate-pulse" />
          </div>
        </div>

        {/* Context Container */}
        <div
          style={{
            marginTop: "0.5rem",
            padding: "1.25rem",
            background: "rgba(99, 102, 241, 0.05)",
            borderRadius: "18px",
            fontSize: "1.1rem",
            lineHeight: 1.62,
            fontStyle: "italic",
            color: "var(--foreground)",
            width: "100%",
            border: "1px solid rgba(99, 102, 241, 0.1)",
            boxShadow: "inset 0 2px 4px rgba(0,0,0,0.02)"
          }}
        >
          {(() => {
            const contextSentence = (
              chunks[currentChunkIndex]?.en
                .split(".")
                .find((s) =>
                  s.toLowerCase().includes((currentWord || "").toLowerCase()),
                ) || "上下文正在赶来..."
            ).trim();
            if (!currentWord) return "...";

            const parts = contextSentence.split(
              new RegExp(`(${currentWord})`, "gi"),
            );
            return (
              <span style={{ opacity: 0.9 }}>
                "
                {parts.map((part, i) =>
                  part.toLowerCase() === currentWord.toLowerCase() ? (
                    <span
                      key={i}
                      style={{
                        color: "var(--primary)",
                        fontWeight: 800,
                        textDecoration: "underline",
                        textDecorationColor: "var(--accent)"
                      }}
                    >
                      {part}
                    </span>
                  ) : (
                    part
                  ),
                )}
                "
              </span>
            );
          })()}
        </div>

        {/* Definition Area */}
        <div
          style={{
            minHeight: "80px",
            width: "100%",
            display: "flex",
            justifyContent: "center",
            alignItems: "center"
          }}
        >
          {isLoadingDef ? (
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", opacity: 0.5 }}>
              <Loader2 className="animate-spin" size={16} />
              <span style={{ fontSize: "0.85rem" }}>正在翻阅字典...</span>
            </div>
          ) : showDefinition ? (
            <div className="animate-slide-up" style={{ width: "100%" }}>
              {definitionData ? (
                <div style={{ textAlign: "center" }}>
                  {definitionData.dictionary && definitionData.dictionary.length > 0 ? (
                    <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "0.5rem" }}>
                      {definitionData.dictionary.map((entry: string, idx: number) => (
                        <span
                          key={idx}
                          className="glass-card"
                          style={{
                            padding: "0.4rem 0.8rem",
                            fontSize: "1.1rem",
                            fontWeight: 600,
                            background: "var(--primary)",
                            color: "white",
                            border: "none"
                          }}
                        >
                          {entry}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p style={{ fontSize: "1.4rem", fontWeight: 700, color: "var(--primary)" }}>
                      {definitionData.translation}
                    </p>
                  )}
                </div>
              ) : (
                <p style={{ opacity: 0.5 }}>智商掉线了，没查到释义</p>
              )}
            </div>
          ) : (
            <button
              onClick={() => setShowDefinition(true)}
              className="btn-primary"
              style={{
                background: "var(--glass)",
                color: "var(--primary)",
                border: "2px solid var(--primary)",
                fontSize: "0.9rem",
                boxShadow: "none"
              }}
            >
              <Search size={18} />
              揭晓释义
            </button>
          )}
        </div>
      </div>

      {/* Responsive Actions */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "1.25rem",
          marginTop: "1rem",
        }}
      >
        <button
          onClick={handleUnknown}
          className="btn-primary"
          style={{
            padding: "1.25rem",
            backgroundColor: "#fff1f2",
            color: "#e11d48",
            border: "2px solid #fecdd3",
            boxShadow: "0 10px 15px -3px rgba(225, 29, 72, 0.1)",
            fontSize: "1.1rem",
            fontWeight: 800,
            borderRadius: "20px"
          }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#ffe4e6")}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#fff1f2")}
        >
          <X size={26} strokeWidth={3} />
          记不清了
        </button>

        <button
          onClick={handleKnown}
          className="btn-primary"
          style={{
            padding: "1.25rem",
            backgroundColor: "#f0fdf4",
            color: "#16a34a",
            border: "2px solid #bbf7d0",
            boxShadow: "0 10px 15px -3px rgba(22, 163, 74, 0.1)",
            fontSize: "1.1rem",
            fontWeight: 800,
            borderRadius: "20px"
          }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#dcfce7")}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#f0fdf4")}
        >
          <Check size={26} strokeWidth={3} />
          瞬间秒杀
        </button>
      </div>
    </div>
  );
}
