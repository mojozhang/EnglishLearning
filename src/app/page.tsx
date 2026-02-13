"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/store/useStore";
import { useDataSync, loadUserData } from "@/hooks/useDataSync";
import FileUploader from "@/components/Reader/FileUploader";
import BookList from "@/components/Dashboard/BookList";
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
      className="animate-slide-up"
      style={{
        padding: "2rem 1rem",
        display: "flex",
        flexDirection: "column",
        gap: "2rem",
        maxWidth: "900px",
        margin: "0 auto",
        minHeight: "100vh",
        position: "relative",
      }}
    >
      <header
        className="glass-card"
        style={{
          padding: "1.5rem",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          position: "sticky",
          top: "1rem",
          zIndex: 50,
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
                width: "42px",
                height: "42px",
                borderRadius: "12px",
                border: "1px solid var(--border)",
                background: "var(--secondary)",
                color: "var(--foreground)",
                transition: "all 0.2s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.transform = "translateX(-3px)")}
              onMouseLeave={(e) => (e.currentTarget.style.transform = "translateX(0)")}
              title="返回"
            >
              <ArrowLeft size={22} />
            </button>
          )}

          <div>
            <h1
              style={{
                fontSize: "1.75rem",
                fontWeight: 800,
                letterSpacing: "-0.025em",
                background: "linear-gradient(135deg, var(--primary) 0%, #9333ea 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                lineHeight: 1.2,
              }}
            >
              妈妈我要学英语
            </h1>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "0.25rem" }}>
              <span style={{ fontSize: "0.75rem", color: "var(--secondary-foreground)", fontWeight: 500 }}>当前状态:</span>
              <span
                style={{
                  fontWeight: 600,
                  color: "white",
                  backgroundColor: "var(--primary)",
                  padding: "0.15rem 0.6rem",
                  borderRadius: "20px",
                  fontSize: "0.7rem",
                  boxShadow: "0 2px 8px rgba(99, 102, 241, 0.3)"
                }}
              >
                {phase === "UPLOAD" && "等待上传"}
                {phase === "READING" && "沉浸阅读"}
                {phase === "MEMORIZING" && "词汇突破"}
                {phase === "SPEAKING" && "开口大声说"}
              </span>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <div
            className="glass-card"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.6rem",
              padding: "0.5rem 1rem",
              border: "none",
              background: "var(--glass)",
            }}
          >
            <div style={{
              width: "28px",
              height: "28px",
              borderRadius: "50%",
              background: "linear-gradient(45deg, var(--primary), var(--accent))",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "white"
            }}>
              <User size={16} />
            </div>
            <span style={{ fontSize: "0.875rem", fontWeight: 600 }}>
              {user.nickname || user.username}
            </span>
          </div>

          <button
            onClick={handleLogout}
            className="btn-primary"
            style={{
              padding: "0.6rem 1.2rem",
              fontSize: "0.875rem",
              background: "rgba(239, 68, 68, 0.1)",
              color: "var(--error)",
              boxShadow: "none",
              border: "1px solid rgba(239, 68, 68, 0.2)"
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(239, 68, 68, 0.2)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(239, 68, 68, 0.1)")}
          >
            <LogOut size={16} />
            退出
          </button>
        </div>
      </header>

      <div style={{ flex: 1, paddingTop: "1rem" }}>
        {phase === "UPLOAD" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
            {/* Upload Area */}
            <div className="glass-card" style={{ padding: "0.5rem" }}>
              <FileUploader />
            </div>

            {/* Book List Area */}
            <BookList />
          </div>
        )}
        {phase === "READING" && <ReaderContainer />}
        {phase === "MEMORIZING" && <VocabularyTrainer />}
        {phase === "SPEAKING" && <SpeechTrainer />}
      </div>

      {phase !== "UPLOAD" && (
        <footer style={{ textAlign: "center", paddingBottom: "2rem" }}>
          <button
            onClick={() => {
              if (window.confirm("确定要换一本小说吗？这将清除当前的所有进度。")) {
                reset();
              }
            }}
            style={{
              fontSize: "0.875rem",
              color: "var(--secondary-foreground)",
              opacity: 0.6,
              transition: "opacity 0.2s"
            }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = "0.6")}
          >
            换一本小说重读
          </button>
        </footer>
      )}
    </main>
  );
}
