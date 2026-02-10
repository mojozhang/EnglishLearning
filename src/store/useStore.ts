import { create } from 'zustand';

export type Phase = 'UPLOAD' | 'READING' | 'MEMORIZING' | 'SPEAKING';

interface AppState {
    // Global State
    phase: Phase;

    // Data
    chunks: { en: string; cn: string }[];
    currentChunkIndex: number;

    // Vocabulary for the current chunk (or session)
    vocabulary: string[];

    // Actions
    setChunks: (chunks: { en: string; cn: string }[]) => void;
    setPhase: (phase: Phase) => void;

    nextChunk: () => void;
    prevChunk: () => void; // Optional, strict flow might not allow going back easily

    addWord: (word: string) => void;
    removeWord: (word: string) => void;
    clearVocabulary: () => void;

    updateChunk: (index: number, data: Partial<{ en: string; cn: string }>) => void;

    reset: () => void;
}

export const useStore = create<AppState>((set) => ({
    phase: 'UPLOAD',
    chunks: [],
    currentChunkIndex: 0,
    vocabulary: [],

    setChunks: (chunks) => set({ chunks, currentChunkIndex: 0, phase: 'READING' }),
    setPhase: (phase) => set({ phase }),

    nextChunk: () => set((state) => {
        const nextIndex = state.currentChunkIndex + 1;
        if (nextIndex >= state.chunks.length) {
            alert('Congratulations! You have finished the entire document.');
            return { phase: 'UPLOAD', chunks: [], currentChunkIndex: 0, vocabulary: [] };
        }
        return {
            currentChunkIndex: nextIndex,
            phase: 'READING',
            vocabulary: [] // Start fresh for new chunk
        };
    }),

    prevChunk: () => set((state) => ({
        currentChunkIndex: Math.max(state.currentChunkIndex - 1, 0)
    })),

    addWord: (word) => set((state) => ({
        vocabulary: state.vocabulary.includes(word) ? state.vocabulary : [...state.vocabulary, word]
    })),

    removeWord: (word) => set((state) => ({
        vocabulary: state.vocabulary.filter((w) => w !== word)
    })),

    clearVocabulary: () => set({ vocabulary: [] }),

    updateChunk: (index, data) => set((state) => {
        const newChunks = [...state.chunks];
        if (newChunks[index]) {
            newChunks[index] = { ...newChunks[index], ...data };
        }
        return { chunks: newChunks };
    }),

    reset: () => set({
        phase: 'UPLOAD',
        chunks: [],
        currentChunkIndex: 0,
        vocabulary: []
    }),
}));
