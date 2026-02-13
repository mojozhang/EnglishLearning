"use server";

import AdmZip from "adm-zip";
import fs from "fs";
import path from "path";
import os from "os";
import { v4 as uuidv4 } from "uuid";

/**
 * Custom EPUB Parser using adm-zip
 * deeply inspects the EPUB structure (container.xml -> opf -> manifest/spine -> html)
 */
export async function parseEpub(formData: FormData): Promise<{ text: string; error?: string }> {
    console.log("Starting parseEpub...");

    try {
        const file = formData.get("file") as File;
        if (!file) {
            return { text: "", error: "No file provided" };
        }

        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        console.log(`File received: ${file.name}, size: ${buffer.length}`);

        // Save to temp file because adm-zip needs a file path or buffer 
        const zip = new AdmZip(buffer);
        const zipEntries = zip.getEntries();

        console.log(`Zip entries found: ${zipEntries.length}`);

        // 1. Find META-INF/container.xml to locate the OPF file
        const containerEntry = zipEntries.find((entry: any) => entry.entryName === "META-INF/container.xml");
        if (!containerEntry) {
            throw new Error("Invalid EPUB: META-INF/container.xml not found");
        }

        const containerXml = containerEntry.getData().toString("utf8");
        // Regex to find full-path attribute (supports single and double quotes)
        const opfPathMatch = containerXml.match(/full-path=["']([^"']+)["']/);
        if (!opfPathMatch) {
            console.error("Container XML content:", containerXml);
            throw new Error("Invalid EPUB: Could not find OPF path in container.xml");
        }

        const opfPath = opfPathMatch[1];
        const opfDir = path.dirname(opfPath) === "." ? "" : path.dirname(opfPath) + "/";

        console.log(`OPF Path: ${opfPath}, Dir: ${opfDir}`);

        // 2. Read the OPF file
        const opfEntry = zipEntries.find((entry: any) => entry.entryName === opfPath);
        if (!opfEntry) {
            throw new Error(`Invalid EPUB: OPF file not found at ${opfPath}`);
        }
        const opfContent = opfEntry.getData().toString("utf8");

        // 3. Parse Manifest (id -> href) and Spine (ordered ids)

        // Manifest: <item id="x" href="y" ... />
        const manifest: Record<string, string> = {};
        const itemRegex = /<[^:]*:?item\s+[^>]*id=["']([^"']+)["']\s+[^>]*href=["']([^"']+)["']/g;
        let match;
        while ((match = itemRegex.exec(opfContent)) !== null) {
            manifest[match[1]] = match[2];
        }

        // Spine: <itemref idref="x" />
        const spine: string[] = [];
        const itemrefRegex = /<[^:]*:?itemref\s+[^>]*idref=["']([^"']+)["']/g;
        while ((match = itemrefRegex.exec(opfContent)) !== null) {
            spine.push(match[1]);
        }

        console.log(`Parsed Manifest items: ${Object.keys(manifest).length}, Spine items: ${spine.length}`);

        // 4. Extract text from each spine item
        let fullText = "";

        for (const id of spine) {
            const href = manifest[id];
            if (href) {
                // Resolve relative path
                const fullPath = opfDir ? path.join(opfDir, href) : href;
                // Normalise path separators for zip lookup (mostly forward slashes)
                const zipPath = fullPath.replace(/\\/g, "/");

                const chapterEntry = zipEntries.find((entry: any) => entry.entryName === zipPath);
                if (chapterEntry) {
                    const html = chapterEntry.getData().toString("utf8");
                    // 5. Strip HTML tags to get raw text
                    // Remove <style>...</style> and <script>...</script> first
                    let cleanText = html.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "");
                    cleanText = cleanText.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "");
                    // Remove tags
                    cleanText = cleanText.replace(/<[^>]+>/g, "\n");
                    // Decode entities (basic ones)
                    cleanText = cleanText
                        .replace(/&nbsp;/g, " ")
                        .replace(/&amp;/g, "&")
                        .replace(/&lt;/g, "<")
                        .replace(/&gt;/g, ">")
                        .replace(/&quot;/g, '"')
                        .replace(/&apos;/g, "'");

                    // Normalize whitespace
                    cleanText = cleanText.replace(/\s+/g, " ").trim();

                    if (cleanText.length > 0) {
                        fullText += cleanText + "\n\n";
                    }
                }
            }
        }

        console.log(`Extracted text length: ${fullText.length}`);
        return { text: fullText };

    } catch (error: any) {
        console.error("EPUB Parse Error:", error);
        return { text: "", error: error.message || "Failed to parse EPUB" };
    }
}
