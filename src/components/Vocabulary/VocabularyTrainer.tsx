'use client';

import { useState, useEffect } from 'react';
import { useStore } from '@/store/useStore';
import { Check, Search } from 'lucide-react';

export default function VocabularyTrainer() {
    const { vocabulary, chunks, currentChunkIndex, setPhase } = useStore();
    const [currentIndex, setCurrentIndex] = useState(0);
    const [showContext, setShowContext] = useState(false);
    const [definitionData, setDefinitionData] = useState<{ translation: string; dictionary: string[] } | null>(null);
    const [isLoadingDef, setIsLoadingDef] = useState(false);

    // If no vocabulary, skip phase (should handle this in parent/logic but safe check here)
    if (vocabulary.length === 0) {
        setPhase('SPEAKING'); // Or handle gracefully
        return null;
    }

    const currentWord = vocabulary[currentIndex];

    // Fetch translation/definition when currentWord changes
    useEffect(() => {
        setDefinitionData(null);
        setIsLoadingDef(true);
        if (!currentWord) return;

        // Call our local API which fetches from Google
        fetch(`/api/dictionary?word=${encodeURIComponent(currentWord)}`)
            .then(res => res.json())
            .then(data => {
                if (data && !data.error) {
                    setDefinitionData(data);
                }
            })
            .catch(err => {
                console.error('Dictionary error:', err);
            })
            .finally(() => {
                setIsLoadingDef(false);
            });
    }, [currentWord]);

    // Find context: Find the sentence containing the word in the current chunk
    const contextSentence = chunks[currentChunkIndex].en
        .split('.')
        .find(sentence => sentence.toLowerCase().includes(currentWord.toLowerCase()))
        || "Context not found.";

    const handleNext = () => {
        if (currentIndex < vocabulary.length - 1) {
            setCurrentIndex(currentIndex + 1);
            setShowContext(false);
        } else {
            setPhase('SPEAKING');
        }
    };

    const progress = ((currentIndex + 1) / vocabulary.length) * 100;

    return (
        <div style={{
            maxWidth: '600px',
            margin: '0 auto',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            gap: '2rem',
            height: '100%'
        }}>
            {/* Progress Bar */}
            <div style={{ width: '100%', height: '4px', background: 'var(--border)', borderRadius: '2px', overflow: 'hidden' }}>
                <div style={{ width: `${progress}%`, height: '100%', background: 'var(--success)', transition: 'width 0.3s ease' }} />
            </div>

            <div style={{ color: 'var(--secondary-foreground)' }}>
                Word {currentIndex + 1} of {vocabulary.length}
            </div>

            {/* Card */}
            <div style={{
                padding: '4rem 2rem',
                backgroundColor: 'var(--background)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '2rem',
                minHeight: '300px'
            }}>
                <h2 style={{ fontSize: '3rem', fontWeight: 800, color: 'var(--primary)' }}>
                    {currentWord}
                </h2>

                <div style={{ minHeight: '60px' }}>
                    {isLoadingDef ? (
                        <p style={{ opacity: 0.5 }}>Loading definition...</p>
                    ) : definitionData ? (
                        <div style={{ textAlign: 'left', display: 'inline-block', maxWidth: '100%' }}>
                            {/* If dictionary entries exist, show them (richer) */}
                            {definitionData.dictionary && definitionData.dictionary.length > 0 ? (
                                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                                    {definitionData.dictionary.map((entry, idx) => (
                                        <li key={idx} style={{ fontSize: '1.25rem', color: 'var(--foreground)', marginBottom: '0.5rem' }}>
                                            {// Make the part of speech small or gray if needed
                                                entry
                                            }
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                /* Fallback to simple translation */
                                <p style={{ fontSize: '1.5rem', color: 'var(--foreground)' }}>
                                    (中文释义: {definitionData.translation})
                                </p>
                            )}
                        </div>
                    ) : (
                        <p style={{ opacity: 0.5 }}>No definition found.</p>
                    )}
                </div>

                {showContext ? (
                    <div style={{
                        marginTop: '1rem',
                        padding: '1rem',
                        background: 'var(--secondary)',
                        borderRadius: 'var(--radius)',
                        fontSize: '1.125rem',
                        lineHeight: 1.6,
                        fontStyle: 'italic',
                        color: 'var(--secondary-foreground)'
                    }}>
                        "...{contextSentence.trim()}..."
                    </div>
                ) : (
                    <button
                        onClick={() => setShowContext(true)}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            color: 'var(--secondary-foreground)',
                            opacity: 0.7,
                            fontSize: '0.875rem'
                        }}
                    >
                        <Search size={16} />
                        Show Context
                    </button>
                )}
            </div>

            {/* Actions */}
            <button
                onClick={handleNext}
                style={{
                    marginTop: 'auto',
                    backgroundColor: 'var(--foreground)',
                    color: 'var(--background)',
                    padding: '1rem 3rem',
                    borderRadius: 'var(--radius)',
                    fontSize: '1.125rem',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem',
                    width: '100%',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                }}
            >
                <Check size={24} />
                {currentIndex === vocabulary.length - 1 ? 'Finish & Start Speaking' : 'I Know This Word'}
            </button>
        </div>
    );
}
