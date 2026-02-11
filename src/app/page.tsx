"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/store/useStore";
import { useDataSync, loadUserData } from "@/hooks/useDataSync";
import FileUploader from "@/components/Reader/FileUploader";
import ReaderContainer from "@/components/Reader/ReaderContainer";
import VocabularyTrainer from "@/components/Vocabulary/VocabularyTrainer";
import SpeechTrainer from "@/components/SpeechCoach/SpeechTrainer";
import { ArrowLeft, LogOut, User } from "lucide-react";

export default function Home() {
  const router = useRouter();
  const { phase, setPhase, vocabulary } = useStore();
  const reset = useStore((state) => state.reset);

  const [user, setUser] = useState<{
    id: string;
    username: string;
    nickname: string | null;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  // Auto-sync data to database
  useDataSync(user?.id || null);

  // Check authentication
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch("/api/auth/me");
        const data = await res.json();

        if (!res.ok || !data.user) {
          router.push("/login");
          return;
        }

        setUser(data.user);

        // Load user's data
        await loadUserData();
      } catch (error) {
        router.push("/login");
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, [router]);

  const handleLogout = async () => {
    try {
      // Force sync all data before logout
      const currentBookId = useStore.getState().currentBookId;
      const currentChunkIndex = useStore.getState().currentChunkIndex;
      const currentPhase = useStore.getState().phase;
      const vocabularyDB = useStore.getState().vocabularyDB;

      if (currentBookId) {
        // Sync progress and phase
        await fetch(`/api/books/${currentBookId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            progress: currentChunkIndex,
            currentPhase: currentPhase,
          }),
        });

        // Sync vocabulary
        if (Object.keys(vocabularyDB).length > 0) {
          const words = Object.entries(vocabularyDB).map(([word, data]) => ({
            word,
            mastered: data.mastered,
            reviewCount: data.reviewCount,
          }));

          await fetch("/api/vocabulary", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ words }),
          });
        }
      }

      // Now logout
      await fetch("/api/auth/logout", { method: "POST" });

      // Clear local state
      reset();

      router.push("/login");
      router.refresh();
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  const handleBack = () => {
    if (phase === "SPEAKING") {
      // If we had vocabulary, go back to memorizing. Otherwise reading.
      if (vocabulary.length > 0) {
        setPhase("MEMORIZING");
      } else {
        setPhase("READING");
      }
    } else if (phase === "MEMORIZING") {
      setPhase("READING");
    } else if (phase === "READING") {
      setPhase("UPLOAD");
    }
  };

  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100vh",
          fontSize: "1.25rem",
          color: "#6b7280",
        }}
      >
        加载中...
      </div>
    );
  }

  if (!user) {
    return null; // Will redirect
  }

  return (
    <main
      style={{
        padding: "2rem",
        display: "flex",
        flexDirection: "column",
        gap: "2rem",
        maxWidth: "800px",
        margin: "0 auto",
        minHeight: "100vh",
        fontFamily: "var(--font-sans)",
        position: "relative",
      }}
    >
      <header
        style={{
          borderBottom: "1px solid var(--border)",
          paddingBottom: "1rem",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          {phase !== "UPLOAD" && (
            <button
              onClick={handleBack}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: "40px",
                height: "40px",
                borderRadius: "50%",
                border: "1px solid var(--border)",
                background: "var(--background)",
                cursor: "pointer",
                color: "var(--foreground)",
                transition: "background 0.2s",
              }}
              title="Go Back"
            >
              <ArrowLeft size={20} />
            </button>
          )}

          <div>
            <h1
              style={{
                fontSize: "2rem",
                fontWeight: "bold",
                marginBottom: "0.5rem",
                background:
                  "linear-gradient(to right, var(--primary), #9333ea)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                lineHeight: 1.2,
              }}
            >
              妈妈我要学英语
            </h1>
            <p style={{ color: "var(--secondary-foreground)", opacity: 0.8 }}>
              阶段：
              <span
                style={{
                  fontWeight: 600,
                  color: "var(--foreground)",
                  backgroundColor: "var(--secondary)",
                  padding: "0.2rem 0.5rem",
                  borderRadius: "4px",
                  fontSize: "0.75rem",
                  textTransform: "uppercase",
                }}
              >
                {phase === "UPLOAD" && "上传"}
                {phase === "READING" && "阅读"}
                {phase === "MEMORIZING" && "生词记忆"}
                {phase === "SPEAKING" && "口语"}
              </span>
            </p>
          </div>
        </div>

        {phase !== "UPLOAD" && (
          <button
            onClick={() => {
              if (
                window.confirm("确定要换一本小说吗？这将清除当前的所有进度。")
              ) {
                reset();
              }
            }}
            style={{
              fontSize: "0.875rem",
              color: "var(--error)",
              textDecoration: "underline",
              cursor: "pointer",
            }}
          >
            换一本小说
          </button>
        )}

        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              color: "var(--foreground)",
            }}
          >
            <User size={18} />
            <span style={{ fontSize: "0.875rem", fontWeight: 500 }}>
              {user.nickname || user.username}
            </span>
          </div>
          <button
            onClick={handleLogout}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              padding: "0.5rem 1rem",
              borderRadius: "8px",
              border: "1px solid var(--border)",
              background: "var(--background)",
              cursor: "pointer",
              color: "var(--foreground)",
              fontSize: "0.875rem",
              transition: "background 0.2s",
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.backgroundColor = "var(--secondary)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.backgroundColor = "var(--background)")
            }
          >
            <LogOut size={16} />
            登出
          </button>
        </div>
      </header>

      <div style={{ flex: 1, paddingTop: "1rem" }}>
        {phase === "UPLOAD" && <FileUploader />}
        {phase === "READING" && <ReaderContainer />}
        {phase === "MEMORIZING" && <VocabularyTrainer />}
        {phase === "SPEAKING" && <SpeechTrainer />}
      </div>
    </main>
  );
}
