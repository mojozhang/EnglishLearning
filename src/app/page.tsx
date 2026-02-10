'use client';

import { useStore } from '@/store/useStore';
import FileUploader from '@/components/Reader/FileUploader';
import ReaderContainer from '@/components/Reader/ReaderContainer';
import VocabularyTrainer from '@/components/Vocabulary/VocabularyTrainer';
import SpeechTrainer from '@/components/SpeechCoach/SpeechTrainer';

export default function Home() {
  const phase = useStore((state) => state.phase);
  const reset = useStore((state) => state.reset);

  return (
    <main style={{
      padding: '2rem',
      display: 'flex',
      flexDirection: 'column',
      gap: '2rem',
      maxWidth: '800px',
      margin: '0 auto',
      minHeight: '100vh',
      fontFamily: 'var(--font-sans)',
      position: 'relative'
    }}>
      <header style={{
        borderBottom: '1px solid var(--border)',
        paddingBottom: '1rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '0.5rem', background: 'linear-gradient(to right, var(--primary), #9333ea)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            English Flow Learner
          </h1>
          <p style={{ color: 'var(--secondary-foreground)', opacity: 0.8 }}>
            Phase: <span style={{
              fontWeight: 600,
              color: 'var(--foreground)',
              backgroundColor: 'var(--secondary)',
              padding: '0.2rem 0.5rem',
              borderRadius: '4px',
              fontSize: '0.75rem',
              textTransform: 'uppercase'
            }}>{phase}</span>
          </p>
        </div>
        {phase !== 'UPLOAD' && (
          <button
            onClick={reset}
            style={{
              fontSize: '0.875rem',
              color: 'var(--error)',
              textDecoration: 'underline',
              cursor: 'pointer'
            }}
          >
            Reset Project
          </button>
        )}
      </header>

      <div style={{ flex: 1, paddingTop: '1rem' }}>
        {phase === 'UPLOAD' && <FileUploader />}
        {phase === 'READING' && <ReaderContainer />}
        {phase === 'MEMORIZING' && <VocabularyTrainer />}
        {phase === 'SPEAKING' && <SpeechTrainer />}
      </div>
    </main>
  );
}
