'use client';

import { useEffect, useState } from 'react';
import { useStore } from '@/store/useStore';
import TextRenderer from './TextRenderer';
import { BookOpen, Brain, ChevronRight, RefreshCw } from 'lucide-react';

export default function ReaderContainer() {
    const { chunks, currentChunkIndex, vocabulary, setPhase, updateChunk } = useStore();
    const [translating, setTranslating] = useState(false);

    if (!chunks || chunks.length === 0) {
        return <div>No content loaded.</div>;
    }

    const currentChunk = chunks[currentChunkIndex];
    const hasVocabulary = vocabulary.length > 0;

    // Auto-translate if text contains placeholder
    useEffect(() => {
        if (!currentChunk) return;

        // Check if translation is placeholder
        if (currentChunk.cn.includes('[模拟中文翻译') || currentChunk.cn.includes('翻译占位符')) {
            fetchTranslation();
        }
    }, [currentChunkIndex]); // Only run when chunk changes (or we can add currentChunk.cn dependency but careful of loops)

    const fetchTranslation = async () => {
        if (!currentChunk || translating) return;
        setTranslating(true);

        try {
            // Split by newlines to translate paragraph by paragraph (MyMemory has 500 char limit usually)
            // But for simplicity, let's try to translate the first 500 chars or just the first paragraph properly using the API.
            // Since API is limited, let's just translate the provided english text. 
            // Warning: Long text might get cut off by free API key.

            const textToTranslate = currentChunk.en.substring(0, 450); // Safe limit

            const response = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(textToTranslate)}&langpair=en|zh`);
            const data = await response.json();

            if (data && data.responseData && data.responseData.translatedText) {
                // Determine if we have more text not translated
                const translated = data.responseData.translatedText;
                const isPartial = currentChunk.en.length > 450;

                const finalCn = isPartial
                    ? translated + "\n\n(注意：由于免费翻译API限制，仅翻译了前500字符。)"
                    : translated;

                updateChunk(currentChunkIndex, { cn: finalCn });
            }
        } catch (e) {
            console.error('Translation failed', e);
        } finally {
            setTranslating(false);
        }
    };

    const handleNextAction = () => {
        if (hasVocabulary) {
            setPhase('MEMORIZING');
        } else {
            setPhase('SPEAKING');
        }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            {/* Progress Indicator */}
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--secondary-foreground)', fontSize: '0.875rem' }}>
                <span>Section {currentChunkIndex + 1} of {chunks.length}</span>
                <span>{vocabulary.length} words collected</span>
            </div>

            {/* Content Area */}
            <div style={{ display: 'grid', gap: '2rem' }}>
                {/* English Text */}
                <div style={{
                    padding: '1.5rem',
                    backgroundColor: 'var(--background)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius)',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                }}>
                    <h3 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--secondary-foreground)', marginBottom: '1rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Original Text
                    </h3>
                    <TextRenderer text={currentChunk.en} />
                </div>

                {/* Chinese Translation */}
                <div style={{
                    padding: '1.5rem',
                    backgroundColor: 'var(--secondary)',
                    borderRadius: 'var(--radius)',
                    opacity: 0.9,
                    position: 'relative'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                        <h3 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--secondary-foreground)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            Translation
                        </h3>
                        {translating && <RefreshCw className="animate-spin" size={16} />}
                    </div>

                    <div style={{ lineHeight: 1.8, fontSize: '1rem', whiteSpace: 'pre-wrap' }}>
                        {currentChunk.cn}
                    </div>
                </div>
            </div>

            {/* Control Bar */}
            <div style={{
                position: 'sticky',
                bottom: '2rem',
                backgroundColor: 'var(--background)',
                padding: '1rem',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                zIndex: 10
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <BookOpen size={20} color="var(--primary)" />
                    <span style={{ fontWeight: 500 }}>Select words you don't know</span>
                </div>

                <button
                    onClick={handleNextAction}
                    style={{
                        backgroundColor: 'var(--foreground)',
                        color: 'var(--background)',
                        padding: '0.75rem 1.5rem',
                        borderRadius: 'var(--radius)',
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        transition: 'opacity 0.2s'
                    }}
                >
                    {hasVocabulary ? (
                        <>
                            <Brain size={20} />
                            Review Words ({vocabulary.length})
                        </>
                    ) : (
                        <>
                            Start Speaking
                            <ChevronRight size={20} />
                        </>
                    )}
                </button>
            </div>
        </div>
    );
}
