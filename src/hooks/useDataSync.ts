import { useEffect } from "react";
import { useStore } from "@/store/useStore";

/**
 * Hook to sync progress and vocabulary to database
 */
export function useDataSync(userId: string | null) {
  const currentBookId = useStore((state) => state.currentBookId);
  const currentChunkIndex = useStore((state) => state.currentChunkIndex);
  const currentPhase = useStore((state) => state.phase);
  const currentSentenceIndex = useStore((state) => state.currentSentenceIndex);
  const vocabularyDB = useStore((state) => state.vocabularyDB);

  // Sync progress and phase when they change
  useEffect(() => {
    if (!userId || !currentBookId) return;

    const syncProgress = async () => {
      try {
        await fetch(`/api/books/${currentBookId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            progress: currentChunkIndex,
            currentPhase: currentPhase,
            currentSentenceIndex: currentSentenceIndex,
          }),
        });
      } catch (error) {
        console.error("Failed to sync progress:", error);
      }
    };

    // Debounce to avoid too many requests
    const timeoutId = setTimeout(syncProgress, 1000);
    return () => clearTimeout(timeoutId);
  }, [
    userId,
    currentBookId,
    currentChunkIndex,
    currentPhase,
    currentSentenceIndex,
  ]);

  // Sync vocabulary when it changes
  useEffect(() => {
    if (!userId || Object.keys(vocabularyDB).length === 0) return;

    const syncVocabulary = async () => {
      try {
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
      } catch (error) {
        console.error("Failed to sync vocabulary:", error);
      }
    };

    // Debounce to avoid too many requests
    const timeoutId = setTimeout(syncVocabulary, 2000);
    return () => clearTimeout(timeoutId);
  }, [userId, vocabularyDB]);
}

/**
 * Hook to load user data on mount
 */
export async function loadUserData() {
  try {
    const [booksRes, vocabRes] = await Promise.all([
      fetch("/api/books"),
      fetch("/api/vocabulary"),
    ]);

    // Load vocabulary
    const vocabularyDB: Record<
      string,
      { addedAt: number; mastered: boolean; reviewCount: number }
    > = {};
    if (vocabRes.ok) {
      const { vocabulary } = await vocabRes.json();
      vocabulary.forEach((v: any) => {
        vocabularyDB[v.word] = {
          addedAt: new Date(v.addedAt).getTime(),
          mastered: v.mastered,
          reviewCount: v.reviewCount,
        };
      });
    }

    // Load the most recent book
    if (booksRes.ok) {
      const { books } = await booksRes.json();
      if (books && books.length > 0) {
        const latestBook = books[0];
        const bookDetailRes = await fetch(`/api/books/${latestBook.id}`);

        if (bookDetailRes.ok) {
          const { book } = await bookDetailRes.json();
          useStore
            .getState()
            .loadUserData(
              book.id,
              book.content,
              book.progress,
              vocabularyDB,
              book.currentPhase || "READING",
              book.currentSentenceIndex || 0,
            );
          return true;
        }
      }
    }

    return false;
  } catch (error) {
    console.error("Failed to load user data:", error);
    return false;
  }
}
