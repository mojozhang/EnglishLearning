"use server";

import AdmZip from "adm-zip";
import path from "path";
import { XMLParser } from "fast-xml-parser";

/**
 * Custom EPUB Parser using adm-zip and fast-xml-parser
 * Robustly handles XML namespaces, URI encoding, and path resolution.
 */
export async function parseEpub(formData: FormData): Promise<{ text: string; error?: string }> {
    console.log("Starting parseEpub (fast-xml-parser version)...");

    try {
        const file = formData.get("file") as File;
        if (!file) {
            return { text: "", error: "No file provided" };
        }

        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        console.log(`File received: ${file.name}, size: ${buffer.length}`);

        const zip = new AdmZip(buffer);
        const zipEntries = zip.getEntries();

        console.log(`Zip entries found: ${zipEntries.length}`);

        // Helper to parse XML
        const parseXml = (xml: string) => {
            const parser = new XMLParser({
                ignoreAttributes: false,
                attributeNamePrefix: "@_",
                textNodeName: "#text"
            });
            return parser.parse(xml);
        };

        // 1. Find META-INF/container.xml
        const containerEntry = zipEntries.find((entry: any) => entry.entryName === "META-INF/container.xml");
        let opfPath = "";

        if (!containerEntry) {
            console.warn("META-INF/container.xml not found, searching for .opf directly...");
            const opfEntryFallback = zipEntries.find((entry: any) => entry.entryName.endsWith(".opf"));
            if (!opfEntryFallback) {
                throw new Error("Invalid EPUB: No OPF file found");
            }
            opfPath = opfEntryFallback.entryName;
        } else {
            const containerXml = containerEntry.getData().toString("utf8");
            const containerObj = parseXml(containerXml);

            // Navigate structure: container -> rootfiles -> rootfile -> @full-path
            let rootfiles = containerObj?.container?.rootfiles?.rootfile;
            if (Array.isArray(rootfiles)) {
                rootfiles = rootfiles[0];
            }

            // fast-xml-parser uses prefix for attributes
            opfPath = rootfiles?.["@_full-path"];

            if (!opfPath) {
                console.error("Container Object:", JSON.stringify(containerObj, null, 2));
                throw new Error("Invalid EPUB: Could not find OPF path in container.xml");
            }
        }

        console.log(`OPF Path: ${opfPath}`);

        // 2. Read the OPF file
        const opfEntry = zipEntries.find((entry: any) => entry.entryName === opfPath);
        if (!opfEntry) {
            throw new Error(`Invalid EPUB: OPF file not found at ${opfPath}`);
        }
        const opfContent = opfEntry.getData().toString("utf8");
        const opfObj = parseXml(opfContent);

        // 3. Parse Manifest and Spine
        // structure: package -> manifest -> item
        const manifestItems = opfObj?.package?.manifest?.item;
        const spineItems = opfObj?.package?.spine?.itemref;

        if (!manifestItems || !spineItems) {
            console.error("OPF Object:", JSON.stringify(opfObj, null, 2));
            throw new Error("Invalid EPUB: Manifest or Spine missing in OPF");
        }

        // Map id -> href
        const manifest: Record<string, string> = {};
        const itemsArray = Array.isArray(manifestItems) ? manifestItems : [manifestItems];

        for (const item of itemsArray) {
            const id = item["@_id"];
            const href = item["@_href"];
            if (id && href) {
                // DELETE URI COMPONENT to handle %20 etc.
                manifest[id] = decodeURIComponent(href);
            }
        }

        // Ordered spine ids
        const spine: string[] = [];
        const spineArray = Array.isArray(spineItems) ? spineItems : [spineItems];

        for (const item of spineArray) {
            const idref = item["@_idref"];
            if (idref) {
                spine.push(idref);
            }
        }

        console.log(`Manifest items: ${Object.keys(manifest).length}, Spine items: ${spine.length}`);

        // 4. Extract Text
        let fullText = "";
        const opfDir = path.dirname(opfPath) === "." ? "" : path.dirname(opfPath) + "/";

        for (const id of spine) {
            const href = manifest[id];
            if (href) {
                // Resolve path relative to OPF
                const fullPath = opfDir ? path.join(opfDir, href) : href;

                // Normalize for Zip (always forward slashes)
                const zipPath = fullPath.replace(/\\/g, "/");

                const chapterEntry = zipEntries.find((entry: any) => entry.entryName === zipPath);

                if (chapterEntry) {
                    const html = chapterEntry.getData().toString("utf8");
                    // Simple HTML strip
                    let cleanText = html.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "");
                    cleanText = cleanText.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "");
                    // Block level elements to newline
                    cleanText = cleanText.replace(/<\/(div|p|h\d|li|br)>/gi, "\n");
                    // Remove all tags
                    cleanText = cleanText.replace(/<[^>]+>/g, " ");

                    // Decode entities
                    cleanText = cleanText
                        .replace(/&nbsp;/g, " ")
                        .replace(/&amp;/g, "&")
                        .replace(/&lt;/g, "<")
                        .replace(/&gt;/g, ">")
                        .replace(/&quot;/g, '"')
                        .replace(/&apos;/g, "'");

                    cleanText = cleanText.replace(/\s+/g, " ").trim();
                    if (cleanText.length > 0) {
                        fullText += cleanText + "\n\n";
                    }
                } else {
                    console.warn(`Chapter file not found: ${zipPath} (Original href: ${href})`);
                }
            }
        }

        if (fullText.length === 0) {
            console.error("Parsing completed but text is empty.");
            return { text: "", error: "解析为空 (Empty Result): 无法提取文本内容，可能是图片或加密 EPUB，或者路径解析错误。" };
        }

        console.log(`Extracted text length: ${fullText.length}`);
        return { text: fullText };

    } catch (error: any) {
        console.error("EPUB Parse Error:", error);
        return { text: "", error: error.message || "Failed to parse EPUB" };
    }
}
