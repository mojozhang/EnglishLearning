"use client";

import { useState } from "react";
import { Upload, Loader2 } from "lucide-react";
import { useStore } from "@/store/useStore";
import { parsePdf } from "@/app/actions/parsePdf";
import { parseEpub } from "@/app/actions/parseEpub";

export default function FileUploader() {
  const [isUploading, setIsUploading] = useState(false);
  const setChunks = useStore((state) => state.setChunks);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      let text = "";
      let error = undefined;

      // Determine file type and route to appropriate parser
      if (file.type === "application/epub+zip" || file.name.toLowerCase().endsWith(".epub")) {
        const result = await parseEpub(formData);
        text = result.text;
        error = result.error;
      } else {
        const result = await parsePdf(formData);
        text = result.text;
        error = result.error;
      }

      if (error || !text) {
        throw new Error(error || "解析失败 (Empty Result)");
      }

      const allTextContent = text;

      // ============================================================
      // STEP 3: V14 Final Cleanup Pipeline
      // ============================================================
      let fullText = allTextContent;

      // Phase 1: Wipe all NULL and control characters
      fullText = fullText.replace(
        /[\u0000-\u0008\u000B-\u001F\u007F-\u009F]/g,
        "",
      );

      // Phase 2: Fix explicit hyphenation (morn- ing)
      fullText = fullText.replace(
        /([a-zA-Z])\s*[-\u2010-\u2015\uFE58\uFE63\uFF0D]\s+([a-zA-Z])/g,
        "$1$2",
      );

      // Phase 3: V14 REGained Suffix Healing (Heals "ex pect", "develop ment", etc.)
      const suffixes = ["pect", "spect", "ing", "ment", "tion", "tive", "ness", "ship", "able", "ible", "full", "less", "ting", "ence", "ance"];
      suffixes.forEach(suffix => {
        // Broad Regex: Handle any letter followed by space and suffix fragment
        const regex = new RegExp(`([a-zA-Z])\\s+(${suffix})`, "gi");
        fullText = fullText.replace(regex, "$1$2");
      });

      // Phase 4: V14 Aggressive Semantic Healing
      const semanticFixes = [
        { regex: /ex\s+pect/gi, replacement: "expect" },
        { regex: /ex\s+perience/gi, replacement: "experience" }, // Fix for "ex perience"
        { regex: /ex\s+plore/gi, replacement: "explore" }, // Safe: plore is not a word
        { regex: /\brm\b/g, replacement: "firm" },
        { regex: /\bght\b/g, replacement: "flight" },
        { regex: /\bclient\b/g, replacement: "efficient" }
      ];
      semanticFixes.forEach(fix => {
        fullText = fullText.replace(fix.regex, fix.replacement);
      });

      // Phase 5: SAFE Whitespace normalization
      fullText = fullText.replace(/\s+/g, " ").trim();

      console.log(`[PDF] V14 Sample: "${fullText.substring(0, 500)}..."`);

      // ============================================================
      // STEP 4: Sentence Reconstruction
      // ============================================================
      // ============================================================
      // STEP 4: Sentence Reconstruction with Abbreviation Protection
      // ============================================================
      // 1. Protect common abbreviations (Mr., Mrs., etc.) to prevent false splits
      let protectedText = fullText
        .replace(/\b(Mr)\./g, "Mr###")
        .replace(/\b(Mrs)\./g, "Mrs###")
        .replace(/\b(Ms)\./g, "Ms###")
        .replace(/\b(Dr)\./g, "Dr###")
        .replace(/\b(Prof)\./g, "Prof###")
        .replace(/\b(Sr)\./g, "Sr###")
        .replace(/\b(Jr)\./g, "Jr###")
        .replace(/\b(St)\./g, "St###"); // St. Paul

      // 2. Split by punctuation followed by space
      // Lookbehind (?<=[.!?]) ensures the punctuation is kept with the sentence
      const rawSentences = protectedText.split(/(?<=[.!?])\s+/);

      // 3. Restore and filter
      const sentences = rawSentences
        .map((s) => s.replace(/###/g, ".").trim())
        .filter((s) => s.length > 10);

      console.log(`[PDF] V14 Final Sentence Count: ${sentences.length}`);

      // ============================================================
      // STEP 5: Generate chunks (9 sentences per chunk, 3 per paragraph)
      // ============================================================
      const chunks: { en: string; cn: string }[] = [];
      const SENTENCES_PER_CHUNK = 9;
      const SENTENCES_PER_PARA = 3;

      for (let i = 0; i < sentences.length; i += SENTENCES_PER_CHUNK) {
        const chunkSentences = sentences.slice(i, i + SENTENCES_PER_CHUNK);

        const paragraphs: string[] = [];
        for (let j = 0; j < chunkSentences.length; j += SENTENCES_PER_PARA) {
          const para = chunkSentences
            .slice(j, j + SENTENCES_PER_PARA)
            .join(" ");
          paragraphs.push(para);
        }

        const enText = paragraphs.join("\n\n");
        const cnText = paragraphs
          .map((_, idx) => `(段落 ${idx + 1} 的中文翻译...)`)
          .join("\n\n");

        if (enText.trim().length > 0) {
          chunks.push({ en: enText, cn: cnText });
        }
      }

      // ============================================================
      // STEP 6: Save and load
      // ============================================================
      if (chunks.length === 0) {
        alert("无法从该 PDF 提取足够的文本，可能是图片扫描版。");
      } else {
        const saveRes = await fetch("/api/books", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: file.name.replace(".pdf", ""),
            content: chunks,
            progress: 0,
          }),
        });

        if (!saveRes.ok) {
          alert("保存书籍到数据库失败，请重试");
          return;
        }

        const { book } = await saveRes.json();
        const { loadUserData: loadDataFunc } =
          await import("@/hooks/useDataSync");
        await loadDataFunc();

        // Auto-activate the new book in store
        const parsedContent =
          typeof book.content === "string"
            ? JSON.parse(book.content)
            : book.content;

        const store = useStore.getState();
        store.loadUserData(
          book.id,
          parsedContent,
          book.progress,
          book.vocabularyDB || {},
          "READING",
          0,
        );

        console.log(`[PDF] V6 Activated: ${book.id}`);
      }
    } catch (error: any) {
      console.error("[Upload] Parse Error:", error);
      const fileType = file.name.toLowerCase().endsWith(".epub") ? "EPUB" : "PDF";
      alert(`${fileType} 解析失败: ${error.message || "未知错误"}`);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div
      className="glass-card animate-slide-up"
      style={{
        padding: "3.5rem 2rem",
        textAlign: "center",
        cursor: "pointer",
        transition: "all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
        backgroundColor: "var(--glass)",
        position: "relative",
        overflow: "hidden",
        border: "2px dashed var(--primary)",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "scale(1.02)";
        e.currentTarget.style.borderColor = "var(--accent)";
        e.currentTarget.style.backgroundColor = "rgba(99, 102, 241, 0.05)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "scale(1)";
        e.currentTarget.style.borderColor = "var(--primary)";
        e.currentTarget.style.backgroundColor = "var(--glass)";
      }}
    >
      <label
        htmlFor="pdf-upload"
        style={{
          cursor: "pointer",
          display: "block",
          width: "100%",
          height: "100%",
        }}
      >
        <input
          id="pdf-upload"
          type="file"
          accept=".pdf,.epub,application/epub+zip"
          onChange={handleFileUpload}
          style={{ display: "none" }}
          disabled={isUploading}
        />
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "1.5rem",
          }}
        >
          <div style={{
            position: "relative",
            width: "80px",
            height: "80px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "linear-gradient(135deg, var(--primary) 0%, var(--accent) 100%)",
            borderRadius: "24px",
            boxShadow: "0 10px 25px -5px rgba(99, 102, 241, 0.4)",
            color: "white",
            marginBottom: "0.5rem"
          }}>
            {isUploading ? (
              <Loader2 className="animate-spin" size={36} />
            ) : (
              <Upload size={36} />
            )}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            <h3 style={{
              fontSize: "1.5rem",
              fontWeight: 800,
              color: "var(--foreground)",
              letterSpacing: "-0.02em"
            }}>
              {isUploading ? "正在解析魔法书..." : "开始你的英文探险"}
            </h3>
            <p style={{
              color: "var(--secondary-foreground)",
              opacity: 0.8,
              fontSize: "0.95rem",
              maxWidth: "280px",
              margin: "0 auto",
              lineHeight: 1.5
            }}>
              {isUploading
                ? "正在为您整理知识点，请稍候"
                : "点击或将 PDF/EPUB 拖到这里，开启高效学习之旅"}
            </p>
          </div>

          {!isUploading && (
            <div
              className="btn-primary"
              style={{
                marginTop: "1rem",
                padding: "0.8rem 2rem",
                fontSize: "1rem"
              }}
            >
              立即上传
            </div>
          )}
        </div>
      </label>

      {/* Background Decorative Circles */}
      <div style={{
        position: "absolute",
        top: "-20px",
        right: "-20px",
        width: "100px",
        height: "100px",
        background: "var(--primary)",
        opacity: 0.05,
        borderRadius: "50%",
        zIndex: -1
      }} />
    </div>
  );
}
