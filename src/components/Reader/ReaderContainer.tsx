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
    <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
      {/* Navigation & Progress Bar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          backgroundColor: "var(--secondary)",
          padding: "0.5rem 1rem",
          borderRadius: "var(--radius)",
          border: "1px solid var(--border)",
        }}
      >
        <button
          onClick={handlePrev}
          disabled={currentChunkIndex === 0}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.25rem",
            background: "none",
            border: "none",
            cursor: currentChunkIndex === 0 ? "not-allowed" : "pointer",
            opacity: currentChunkIndex === 0 ? 0.5 : 1,
            color: "var(--foreground)",
            fontSize: "0.875rem",
          }}
        >
          <ChevronLeft size={16} />
          上一节
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <select
            value={currentChunkIndex}
            onChange={handleJump}
            style={{
              padding: "0.25rem 0.5rem",
              borderRadius: "4px",
              border: "1px solid var(--border)",
              fontSize: "0.875rem",
              maxWidth: "120px",
            }}
          >
            {chunks.map((_, idx) => (
              <option key={idx} value={idx}>
                第 {idx + 1} 节
              </option>
            ))}
          </select>
          <span
            style={{
              fontSize: "0.75rem",
              color: "var(--secondary-foreground)",
            }}
          >
            / {chunks.length}
          </span>
        </div>

        <button
          onClick={handleNext}
          disabled={currentChunkIndex === chunks.length - 1}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.25rem",
            background: "none",
            border: "none",
            cursor:
              currentChunkIndex === chunks.length - 1
                ? "not-allowed"
                : "pointer",
            opacity: currentChunkIndex === chunks.length - 1 ? 0.5 : 1,
            color: "var(--foreground)",
            fontSize: "0.875rem",
          }}
        >
          下一节
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Content Area */}
      <div style={{ display: "grid", gap: "2rem" }}>
        {/* English Text with Interleaved Translation */}
        <div
          style={{
            padding: "1.5rem",
            backgroundColor: "var(--background)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius)",
            boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "1rem",
            }}
          >
            <h3
              style={{
                fontSize: "0.875rem",
                fontWeight: 600,
                color: "var(--secondary-foreground)",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              阅读与翻译
            </h3>
            {translating ? (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  color: "var(--primary)",
                }}
              >
                <RefreshCw className="animate-spin" size={16} />
                <span style={{ fontSize: "0.75rem" }}>翻译中...</span>
              </div>
            ) : (
              <button
                onClick={fetchTranslation}
                style={{
                  fontSize: "0.75rem",
                  color: "var(--primary)",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.25rem",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                }}
                title="重试翻译"
              >
                <RefreshCw size={14} />
                重试
              </button>
            )}
          </div>
          <TextRenderer text={currentChunk.en} translation={currentChunk.cn} />
        </div>
      </div>

      {/* Control Bar */}
      <div
        style={{
          position: "sticky",
          bottom: "2rem",
          backgroundColor: "var(--background)",
          padding: "1rem",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1)",
          zIndex: 10,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <BookOpen size={20} color="var(--primary)" />
          <span style={{ fontWeight: 500 }}>点击你不认识的单词</span>
        </div>

        <button
          onClick={handleNextAction}
          style={{
            backgroundColor: "var(--foreground)",
            color: "var(--background)",
            padding: "0.75rem 1.5rem",
            borderRadius: "var(--radius)",
            fontWeight: 600,
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            transition: "opacity 0.2s",
          }}
        >
          {hasVocabulary ? (
            <>
              <Brain size={20} />
              复习单词 ({vocabulary.length})
            </>
          ) : (
            <>
              开始跟读
              <ChevronRight size={20} />
            </>
          )}
        </button>
      </div>
    </div>
  );
}
