import { create } from "zustand";

export type Phase = "UPLOAD" | "READING" | "MEMORIZING" | "SPEAKING";

interface AppState {
  // Global State
  phase: Phase;
  currentBookId: string | null;

  // Data
  chunks: { en: string; cn: string }[];
  currentChunkIndex: number;
  currentSentenceIndex: number; // For SPEAKING phase

  // Vocabulary for the current chunk (or session)
  vocabulary: string[];
  // Persistent Vocabulary Database
  vocabularyDB: Record<
    string,
    { addedAt: number; mastered: boolean; reviewCount: number }
  >;
  masteredWords: string[];

  // Actions
  setChunks: (chunks: { en: string; cn: string }[]) => void;
  setPhase: (phase: Phase) => void;

  nextChunk: () => void;
  prevChunk: () => void;

  addWord: (word: string) => void;
  removeWord: (word: string) => void;
  markWordAsMastered: (word: string) => void;
  clearVocabulary: () => void;

  setChunkIndex: (index: number) => void;
  setCurrentSentenceIndex: (index: number) => void;
  updateChunk: (
    index: number,
    data: Partial<{ en: string; cn: string }>,
  ) => void;

  // New: Data sync actions
  loadUserData: (
    bookId: string,
    chunks: { en: string; cn: string }[],
    progress: number,
    vocabularyDB: Record<
      string,
      { addedAt: number; mastered: boolean; reviewCount: number }
    >,
    phase?: string,
    sentenceIndex?: number,
  ) => void;
  setCurrentBookId: (bookId: string | null) => void;

  reset: () => void;
}

export const useStore = create<AppState>()((set) => ({
  phase: "UPLOAD",
  chunks: [],
  currentChunkIndex: 0,
  currentSentenceIndex: 0,
  vocabulary: [],
  vocabularyDB: {},
  masteredWords: [],
  currentBookId: null,

  setChunks: (chunks) =>
    set({ chunks, currentChunkIndex: 0, phase: "READING" }),
  setPhase: (phase) => set({ phase }),

  nextChunk: () =>
    set((state) => {
      const nextIndex = state.currentChunkIndex + 1;
      if (nextIndex >= state.chunks.length) {
        alert("恭喜！你已经完成了所有章节。");
        return {
          phase: "UPLOAD",
          chunks: [],
          currentChunkIndex: 0,
          vocabulary: [],
          masteredWords: [],
          currentBookId: null,
        };
      }
      return {
        currentChunkIndex: nextIndex,
        phase: "READING",
        vocabulary: [],
        masteredWords: [],
      };
    }),

  prevChunk: () =>
    set((state) => {
      const prevIndex = Math.max(state.currentChunkIndex - 1, 0);
      return {
        currentChunkIndex: prevIndex,
        phase: "READING",
        vocabulary: [],
        masteredWords: [],
      };
    }),

  setChunkIndex: (index) =>
    set((state) => ({
      currentChunkIndex: index,
      currentSentenceIndex: 0,
      phase: "READING",
      vocabulary: [],
      masteredWords: [],
    })),

  setCurrentSentenceIndex: (index) => set({ currentSentenceIndex: index }),

  addWord: (word) =>
    set((state) => {
      const newVocabulary = state.vocabulary.includes(word)
        ? state.vocabulary
        : [...state.vocabulary, word];

      const newDB = { ...state.vocabularyDB };
      if (!newDB[word]) {
        newDB[word] = { addedAt: Date.now(), mastered: false, reviewCount: 0 };
      }

      return {
        vocabulary: newVocabulary,
        vocabularyDB: newDB,
      };
    }),

  removeWord: (word) =>
    set((state) => ({
      vocabulary: state.vocabulary.filter((w) => w !== word),
    })),

  markWordAsMastered: (word) =>
    set((state) => {
      const newMasteredWords = state.masteredWords.includes(word)
        ? state.masteredWords
        : [...state.masteredWords, word];

      const newDB = { ...state.vocabularyDB };
      if (newDB[word]) {
        newDB[word] = {
          ...newDB[word],
          mastered: true,
          reviewCount: (newDB[word].reviewCount || 0) + 1,
        };
      } else {
        newDB[word] = { addedAt: Date.now(), mastered: true, reviewCount: 1 };
      }

      return {
        masteredWords: newMasteredWords,
        vocabularyDB: newDB,
      };
    }),

  clearVocabulary: () => set({ vocabulary: [], masteredWords: [] }),

  updateChunk: (index, data) =>
    set((state) => {
      const newChunks = [...state.chunks];
      if (newChunks[index]) {
        newChunks[index] = { ...newChunks[index], ...data };
      }
      return { chunks: newChunks };
    }),

  loadUserData: (
    bookId,
    chunks,
    progress,
    vocabularyDB,
    phase,
    sentenceIndex,
  ) =>
    set({
      currentBookId: bookId,
      chunks,
      currentChunkIndex: progress,
      currentSentenceIndex: sentenceIndex || 0,
      vocabularyDB,
      phase: (phase as Phase) || "READING",
      vocabulary: [],
      masteredWords: [],
    }),

  setCurrentBookId: (bookId) => set({ currentBookId: bookId }),

  reset: () =>
    set({
      phase: "UPLOAD",
      chunks: [],
      currentChunkIndex: 0,
      currentSentenceIndex: 0,
      vocabulary: [],
      vocabularyDB: {},
      masteredWords: [],
      currentBookId: null,
    }),
}));
