declare module "epub2" {
    export interface Chapter {
        id: string;
        href: string;
        mediaType: string;
        title?: string;
        order: number;
    }

    export default class EPub {
        static createAsync(path: string, heapSize?: number, ignoreNcx?: boolean): Promise<EPub>;

        flow: Chapter[];
        metadata: Record<string, any>;
        manifest: Record<string, any>;
        spine: { contents: Chapter[] };

        getChapter(chapterId: string, callback: (error: Error | null, text: string) => void): void;
        getChapterRaw(chapterId: string, callback: (error: Error | null, text: string) => void): void;
        getImage(id: string, callback: (error: Error | null, data: Buffer, mimeType: string) => void): void;
        getFile(id: string, callback: (error: Error | null, data: Buffer, mimeType: string) => void): void;
    }
}
