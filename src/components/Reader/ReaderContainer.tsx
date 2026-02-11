"use client";

import { useEffect, useState } from "react";
import { useStore } from "@/store/useStore";
import TextRenderer from "./TextRenderer";
import {
  BookOpen,
  Brain,
  ChevronRight,
  RefreshCw,
  ChevronLeft,
} from "lucide-react";

export default function ReaderContainer() {
  const {
    chunks,
    currentChunkIndex,
    vocabulary,
    setPhase,
    updateChunk,
    prevChunk,
    nextChunk,
    setChunkIndex,
    masteredWords,
  } = useStore();
  const [translating, setTranslating] = useState(false);

  if (!chunks || chunks.length === 0) {
    return <div>No content loaded.</div>;
  }

  const currentChunk = chunks[currentChunkIndex];
  const hasVocabulary = vocabulary.length > 0;
  const unmasteredCount = vocabulary.filter(
    (w) => !masteredWords.includes(w),
  ).length;

  const fetchTranslation = async () => {
    if (!currentChunk || translating) return;

    // Capture specific index and text to prevent race conditions
    const targetIndex = currentChunkIndex;
    const targetText = currentChunk.en;

    setTranslating(true);

    try {
      // Split text by paragraphs (matching TextRenderer split logic)
      // Use a regex that handles various newline combinations but keeps empty lines significant for structure
      // Actually, best to just split by double newline as chunks are constructed that way
      const paragraphs = targetText.split(/\n\n+/);

      // Parallel requests for each paragraph to ensure 1:1 alignment
      // This prevents "Automatic Merging" fallback which confuses users when API returns partial/merged text
      const translations = await Promise.all(
        paragraphs.map(async (para) => {
          if (!para.trim()) return "";
          try {
            const res = await fetch("/api/translate", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ text: para.trim() }),
            });
            if (res.ok) {
              const data = await res.json();
              return data.translation || para; // Fallback to original if empty
            }
          } catch (e) {
            console.error("Para trans failed", e);
          }
          return para; // Fallback on error
        }),
      );

      // Join with same delimiter
      const finalTranslation = translations.join("\n\n");

      // CRITICAL FIX: Ensure we update the correct chunk index
      // And double check we haven't raced (though targetIndex handles this logic for data consistency)
      if (targetIndex === currentChunkIndex) {
        updateChunk(targetIndex, { cn: finalTranslation });
      } else {
        // Even if user navigated away, update the store so when they come back it's ready
        updateChunk(targetIndex, { cn: finalTranslation });
      }
    } catch (e) {
      console.error("Translation failed", e);
    } finally {
      setTranslating(false);
    }
  };

  const handleNextAction = () => {
    // If there are words, go to memorizing (even if mastered, to show summary/confirm)
    // Or if all mastered, we could go straight to speaking?
    // Let's keep it simple: if vocabulary exists, go to trainer. Trainer handles "all managed" case.
    if (hasVocabulary) {
      setPhase("MEMORIZING");
    } else {
      setPhase("SPEAKING");
    }
  };

  // Auto-translate if text contains placeholder or is empty
  useEffect(() => {
    if (!currentChunk) return;

    // Check if translation is needed:
    // 1. Empty string
    // 2. Placeholder text (including FileUploader V6 default)
    const isPlaceholder =
      !currentChunk.cn ||
      currentChunk.cn.trim() === "" ||
      currentChunk.cn.includes("[翻译 - ") ||
      currentChunk.cn.includes("[模拟中文翻译") ||
      currentChunk.cn.includes("(段落") ||
      currentChunk.cn.includes("翻译占位符");

    if (isPlaceholder && !translating) {
      console.log("Triggering auto-translation for chunk:", currentChunkIndex);
      fetchTranslation();
    }
  }, [currentChunk]); // Depend on currentChunk to re-run if we switch chunks

  const handlePrev = () => {
    if (unmasteredCount > 0) {
      alert(`本章节还有 ${unmasteredCount} 个未掌握的生词！请先完成复习。`);
      setPhase("MEMORIZING");
      return;
    }
    if (currentChunkIndex > 0) {
      prevChunk();
    }
  };

  const handleNext = () => {
    if (unmasteredCount > 0) {
      alert(
        `本章节还有 ${unmasteredCount} 个未掌握的生词！请先完成复习，加深印象后再进入下一节。`,
      );
      setPhase("MEMORIZING");
      return;
    }
    if (currentChunkIndex < chunks.length - 1) {
      nextChunk();
    }
  };

  const handleJump = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const idx = parseInt(e.target.value);
    if (idx === currentChunkIndex) return;

    if (unmasteredCount > 0) {
      alert(
        `本章节还有 ${unmasteredCount} 个未掌握的生词！请先完成复习，才能进行跳转。`,
      );
      setPhase("MEMORIZING");
      return;
    }
    setChunkIndex(idx);
  };

  return (
    <div
      className="animate-slide-up"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "1.5rem",
        paddingBottom: "100px" // Space for fixed bottom bar
      }}
    >
      {/* Navigation & Progress Bar */}
      <div
        className="glass-card"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "0.75rem 1.25rem",
          background: "var(--glass)",
        }}
      >
        <button
          onClick={handlePrev}
          disabled={currentChunkIndex === 0}
          className="btn-primary"
          style={{
            background: "none",
            boxShadow: "none",
            color: "var(--foreground)",
            padding: "0.5rem",
            width: "auto",
            opacity: currentChunkIndex === 0 ? 0.3 : 1,
            fontSize: "0.875rem",
            border: "1px solid var(--border)"
          }}
        >
          <ChevronLeft size={18} />
          <span className="mobile-hide">上一节</span>
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <div style={{ position: "relative" }}>
            <select
              value={currentChunkIndex}
              onChange={handleJump}
              style={{
                padding: "0.4rem 2rem 0.4rem 0.75rem",
                borderRadius: "12px",
                border: "1px solid var(--border)",
                background: "var(--background)",
                fontSize: "0.9rem",
                fontWeight: 600,
                appearance: "none",
                cursor: "pointer",
              }}
            >
              {chunks.map((_, idx) => (
                <option key={idx} value={idx}>
                  第 {idx + 1} 节
                </option>
              ))}
            </select>
            <div style={{
              position: "absolute",
              right: "0.75rem",
              top: "50%",
              transform: "translateY(-50%)",
              pointerEvents: "none",
              opacity: 0.5
            }}>
              <ChevronRight size={14} style={{ transform: "rotate(90deg)" }} />
            </div>
          </div>
          <span
            style={{
              fontSize: "0.8rem",
              color: "var(--secondary-foreground)",
              fontWeight: 500,
              opacity: 0.6
            }}
          >
            共 {chunks.length} 节
          </span>
        </div>

        <button
          onClick={handleNext}
          disabled={currentChunkIndex === chunks.length - 1}
          className="btn-primary"
          style={{
            background: "none",
            boxShadow: "none",
            color: "var(--foreground)",
            padding: "0.5rem",
            width: "auto",
            opacity: currentChunkIndex === chunks.length - 1 ? 0.3 : 1,
            fontSize: "0.875rem",
            border: "1px solid var(--border)"
          }}
        >
          <span className="mobile-hide">下一节</span>
          <ChevronRight size={18} />
        </button>
      </div>

      {/* Content Area */}
      <div className="glass-card" style={{
        padding: "2rem",
        background: "var(--secondary)",
        minHeight: "400px"
      }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "1.5rem",
            borderBottom: "1px solid var(--border)",
            paddingBottom: "1rem"
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <div style={{
              width: "32px",
              height: "32px",
              borderRadius: "8px",
              background: "rgba(99, 102, 241, 0.1)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--primary)"
            }}>
              <BookOpen size={18} />
            </div>
            <h3
              style={{
                fontSize: "1rem",
                fontWeight: 700,
                color: "var(--foreground)",
                letterSpacing: "-0.01em",
              }}
            >
              内容沉浸探索
            </h3>
          </div>

          {translating ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                color: "var(--primary)",
                padding: "0.4rem 0.8rem",
                borderRadius: "10px",
                background: "rgba(99, 102, 241, 0.05)",
              }}
            >
              <RefreshCw className="animate-spin" size={16} />
              <span style={{ fontSize: "0.75rem", fontWeight: 600 }}>魔法翻译中...</span>
            </div>
          ) : (
            <button
              onClick={fetchTranslation}
              style={{
                fontSize: "0.75rem",
                color: "var(--primary)",
                fontWeight: 600,
                display: "flex",
                alignItems: "center",
                gap: "0.25rem",
                padding: "0.4rem 0.8rem",
                borderRadius: "10px",
                background: "rgba(99, 102, 241, 0.05)",
                transition: "all 0.2s"
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(99, 102, 241, 0.1)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(99, 102, 241, 0.05)")}
            >
              <RefreshCw size={14} />
              重试翻译
            </button>
          )}
        </div>
        <TextRenderer text={currentChunk.en} translation={currentChunk.cn} />
      </div>

      {/* Control Bar - Floating at Bottom */}
      <div
        className="glass-card"
        style={{
          position: "fixed",
          bottom: "1.5rem",
          left: "50%",
          transform: "translateX(-50%)",
          width: "calc(100% - 2rem)",
          maxWidth: "760px",
          padding: "1rem 1.5rem",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.1)",
          zIndex: 100,
          background: "rgba(255, 255, 255, 0.9)",
          border: "2px solid var(--primary)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <div style={{
            width: "36px",
            height: "36px",
            borderRadius: "50%",
            background: "var(--highlight)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center"
          }}>
            <Brain size={20} color="#854d0e" />
          </div>
          <div>
            <p style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--foreground)" }}>点词即学</p>
            <p style={{ fontSize: "0.7rem", color: "var(--secondary-foreground)", opacity: 0.7 }}>点击你不认识的单词</p>
          </div>
        </div>

        <button
          onClick={handleNextAction}
          className="btn-primary"
          style={{
            padding: "0.75rem 2rem",
            fontSize: "1rem",
            width: "auto"
          }}
        >
          {hasVocabulary ? (
            <>
              <Brain size={20} />
              强化记忆 ({vocabulary.length})
            </>
          ) : (
            <>
              开始跟读挑战
              <ChevronRight size={20} />
            </>
          )}
        </button>
      </div>
    </div>
  );
}
