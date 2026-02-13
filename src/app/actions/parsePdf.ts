"use server";

import pdf from "pdf-parse";

export async function parsePdf(formData: FormData): Promise<{ text: string; error?: string }> {
    try {
        const file = formData.get("file") as File;
        if (!file) {
            return { text: "", error: "No file provided" };
        }

        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Custom render function to replicate "Structure-Aware" filtering
        // pdf-parse allows a 'pagerender' option.
        // We can access the raw PDFJS page object via pageData
        const render_page = async (pageData: any) => {
            // This is roughly equivalent to what we did with pdfjs-dist
            const render_options = {
                normalizeWhitespace: false,
                disableCombineTextItems: false
            };

            const textContent = await pageData.getTextContent(render_options);

            // Get page height from viewport
            const viewport = pageData.getViewport({ scale: 1.0 });
            const pageHeight = viewport.height;

            const HEADER_HEIGHT_PERCENT = 0.05; // Top 5%
            const FOOTER_HEIGHT_PERCENT = 0.05; // Bottom 5%

            // Filter items based on Y-coordinate (PDF Coords: 0 is Bottom)
            const validItems = textContent.items.filter((item: any) => {
                // item.transform is [scaleX, skewY, skewX, scaleY, x, y]
                const y = item.transform[5];

                // Remove Footer (near 0)
                if (y < pageHeight * FOOTER_HEIGHT_PERCENT) return false;

                // Remove Header (near Height)
                if (y > pageHeight * (1 - HEADER_HEIGHT_PERCENT)) return false;

                return true;
            });

            // Join text items
            return validItems.map((item: any) => item.str).join(" ") + "\n";
        };

        const options = {
            pagerender: render_page
        };

        const data = await pdf(buffer, options);
        let fullText = data.text;

        // 2. Robust Ligature Repair (moved from previous implementation)
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

        // Basic clean up of excessive whitespace
        fullText = fullText.replace(/\n\s*\n/g, "\n\n");

        return { text: fullText };

    } catch (error: any) {
        console.error("PDF Parse Error:", error);
        return { text: "", error: error.message || "Failed to parse PDF" };
    }
}
