'use client';

import { useStore } from '@/store/useStore';
import { clsx } from 'clsx';
import { useMemo } from 'react';

interface TextRendererProps {
    text: string;
}

export default function TextRenderer({ text }: TextRendererProps) {
    const vocabulary = useStore((state) => state.vocabulary);
    const addWord = useStore((state) => state.addWord);
    const removeWord = useStore((state) => state.removeWord);

    // Split text into words and punctuation
    // This regex captures words and non-words (punctuation/whitespace)
    const tokens = useMemo(() => {
        return text.split(/([a-zA-Z0-9']+)/).filter(Boolean);
    }, [text]);

    const handleWordClick = (word: string) => {
        // Basic normalization: remove trailing punctuation if any (though regex handles most)
        // and lower case for check? Maybe keep case for display but store lowercase?
        // Let's store as is for now or lowercase for comparison.
        const cleanWord = word.toLowerCase();

        if (vocabulary.includes(cleanWord)) {
            removeWord(cleanWord);
        } else {
            addWord(cleanWord);
        }
    };

    return (
        <div style={{ lineHeight: 1.8, fontSize: '1.125rem', whiteSpace: 'pre-wrap' }}>
            {tokens.map((token, index) => {
                const isWord = /^[a-zA-Z0-9']+$/.test(token);
                const cleanWord = token.toLowerCase();
                const isSelected = isWord && vocabulary.includes(cleanWord);

                if (!isWord) {
                    return <span key={index}>{token}</span>;
                }

                return (
                    <span
                        key={index}
                        onClick={() => handleWordClick(token)}
                        className={clsx(
                            'cursor-pointer transition-colors duration-200 rounded px-0.5',
                            isSelected ? 'bg-yellow-200 text-yellow-900 border-b-2 border-yellow-500' : 'hover:bg-blue-100'
                        )}
                        style={{
                            backgroundColor: isSelected ? 'var(--highlight)' : 'transparent',
                            color: isSelected ? '#000' : 'inherit',
                            cursor: 'pointer',
                            fontWeight: isSelected ? 'bold' : 'normal',
                        }}
                        title="Click to add to vocabulary"
                    >
                        {token}
                    </span>
                );
            })}
        </div>
    );
}
