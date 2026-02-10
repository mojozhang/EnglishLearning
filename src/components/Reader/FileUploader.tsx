'use client';

import { useState } from 'react';
import { Upload, Loader2 } from 'lucide-react';
import { useStore } from '@/store/useStore';
// Import pdfjs-dist but setup worker carefully
import * as pdfjsLib from 'pdfjs-dist';

// Initialize Worker
if (typeof window !== 'undefined' && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
}

export default function FileUploader() {
    const [isUploading, setIsUploading] = useState(false);
    const setChunks = useStore((state) => state.setChunks);

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploading(true);

        try {
            const arrayBuffer = await file.arrayBuffer();

            // Load PDF
            const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
            const pdf = await loadingTask.promise;

            console.log(`PDF Loaded: ${pdf.numPages} pages.`);

            let fullText = '';

            // Extract text page by page
            for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                const textContent = await page.getTextContent();
                const pageText = textContent.items.map((item: any) => item.str).join(' ');
                fullText += pageText + '\n\n';
            }

            // Process Text (Split logic)
            // 1. Normalize line endings
            // 2. Split by paragraphs (double newlines from page breaks mostly)
            // 3. To simulate "book-like" paragraphs, we can split by '. ' if pages are huge.

            // Simple heuristic: Split by double newline first (page/paragraph breaks)
            let paragraphs = fullText.split(/\n\s*\n/).map(p => p.trim()).filter(p => p.length > 20);

            // If very few paragraphs (e.g. PDF extracted as one big string per page), try to split by sentence groups
            if (paragraphs.length < pdf.numPages * 2) {
                const sentences = fullText.match(/[^.!?]+[.!?]+/g) || [fullText];
                paragraphs = [];
                // Group 3 sentences per "paragraph"
                for (let i = 0; i < sentences.length; i += 3) {
                    paragraphs.push(sentences.slice(i, i + 3).join(' ').trim());
                }
            }

            // Generate Chunks
            const chunks = [];
            const CHUNK_SIZE = 3;

            for (let i = 0; i < paragraphs.length; i += CHUNK_SIZE) {
                const group = paragraphs.slice(i, i + CHUNK_SIZE);
                const enText = group.join('\n\n');
                const cnText = `[模拟中文翻译 - 第 ${chunks.length + 1} 节]\n` +
                    group.map((p, idx) => `(翻译占位符 ${i + idx + 1}: ${p.substring(0, 20)}...)`).join('\n\n');

                if (enText.length > 0) {
                    chunks.push({ en: enText, cn: cnText });
                }
            }

            if (chunks.length === 0) {
                alert("Could not extract enough text from this PDF. It might be an image-based PDF.");
            } else {
                console.log(`Generated ${chunks.length} chunks.`);
                setChunks(chunks);
            }

        } catch (error: any) {
            console.error('Client-side PDF Parse Error:', error);
            alert(`Failed to parse PDF: ${error.message || 'Unknown error'}`);
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <div style={{
            border: '2px dashed var(--border)',
            borderRadius: 'var(--radius)',
            padding: '3rem',
            textAlign: 'center',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            backgroundColor: 'var(--secondary)',
        }}>
            <label htmlFor="pdf-upload" style={{ cursor: 'pointer', display: 'block', width: '100%', height: '100%' }}>
                <input
                    id="pdf-upload"
                    type="file"
                    accept=".pdf"
                    onChange={handleFileUpload}
                    style={{ display: 'none' }}
                    disabled={isUploading}
                />
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                    {isUploading ? (
                        <Loader2 className="animate-spin" size={48} color="var(--primary)" />
                    ) : (
                        <Upload size={48} color="var(--primary)" />
                    )}
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 600 }}>
                        {isUploading ? 'Analyzing PDF...' : 'Click or Drag PDF Here'}
                    </h3>
                    <p style={{ color: 'var(--secondary-foreground)', opacity: 0.7 }}>
                        Supports standard text-based PDF files. Images are not supported.
                    </p>
                </div>
            </label>
        </div>
    );
}
