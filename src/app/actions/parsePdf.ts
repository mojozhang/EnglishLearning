"use server";

import path from "path";

// Polyfill for Node.js environment where DOMMatrix is missing (pdfjs-dist needs this)
if (typeof DOMMatrix === "undefined") {
    (global as any).DOMMatrix = class DOMMatrix {
        constructor() { }
    };
}

export async function parsePdf(formData: FormData): Promise<{ text: string; error?: string }> {
    try {
        const file = formData.get("file") as File;
        if (!file) {
            return { text: "", error: "No file provided" };
        }

        const arrayBuffer = await file.arrayBuffer();

        // Dynamic import to avoid bundling issues, targeted at Node.js environment
        const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");

        // Config CMap and Font paths to ensure ligatures (fi, fl, etc.) are parsed correctly
        const cMapUrl = path.join(process.cwd(), "node_modules/pdfjs-dist/cmaps/");
        const standardFontDataUrl = path.join(process.cwd(), "node_modules/pdfjs-dist/standard_fonts/");

        const loadingTask = pdfjs.getDocument({
            data: new Uint8Array(arrayBuffer),
            cMapUrl,
            cMapPacked: true,
            standardFontDataUrl,
            disableFontFace: false,
        });

        const doc = await loadingTask.promise;
        const numPages = doc.numPages;
        let fullText = "";

        // 1. Coordinate-Based Filtering (Structure Analysis)
        // We define a "Safe Zone". Text outside this zone (top header, bottom footer) is physically ignored.
        const HEADER_HEIGHT_PERCENT = 0.05; // Top 5%
        const FOOTER_HEIGHT_PERCENT = 0.05; // Bottom 5%

        for (let i = 1; i <= numPages; i++) {
            const page = await doc.getPage(i);
            const viewport = page.getViewport({ scale: 1.0 });
            const pageHeight = viewport.height;
            const textContent = await page.getTextContent();

            // Filter items based on Y-coordinate (PDF Coords: 0 is Bottom)
            const validItems = textContent.items.filter((item: any) => {
                const y = item.transform[5]; // transform[5] is Y position

                // Remove Footer (near 0)
                if (y < pageHeight * FOOTER_HEIGHT_PERCENT) return false;

                // Remove Header (near Height)
                if (y > pageHeight * (1 - HEADER_HEIGHT_PERCENT)) return false;

                return true;
            });

            // Join text items for the page
            const pageText = validItems.map((item: any) => item.str).join(" ");
            fullText += pageText + "\n";
        }

        // 2. Robust Ligature Repair (Dictionary-Based Cleaning)
        // Dealing with "ffi" (traffic -> trac), "ffl", etc.
        const LIGATURE_REPAIRS = [
            { pattern: /\btrac\b/gi, replacement: "traffic" },
            { pattern: /\bdicult\b/gi, replacement: "difficult" },
            { pattern: /\bocial\b/gi, replacement: "official" },
            { pattern: /\becient\b/gi, replacement: "efficient" },
            { pattern: /\bsucient\b/gi, replacement: "sufficient" },
            { pattern: /\bdi\s?erent\b/gi, replacement: "different" },
            { pattern: /\bsu\s?er\b/gi, replacement: "suffer" },
            { pattern: /\be\s?ect\b/gi, replacement: "effect" },
            { pattern: /\ba\s?ect\b/gi, replacement: "affect" },
            { pattern: /\bo\s?er\b/gi, replacement: "offer" },
            { pattern: /\bno\s+ner\b/gi, replacement: "no finer" },
            { pattern: /\bner\b/gi, replacement: "finer" },
        ];

        LIGATURE_REPAIRS.forEach(({ pattern, replacement }) => {
            fullText = fullText.replace(pattern, replacement);
        });

        return { text: fullText };
    } catch (error: any) {
        console.error("PDF Parse Error:", error);
        return { text: "", error: error.message || "Failed to parse PDF" };
    }
}
