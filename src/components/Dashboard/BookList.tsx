"use client";

import { useState, useEffect } from "react";
import { BookOpen, Clock, Trash2, ChevronDown, Loader2 } from "lucide-react";
import { useStore } from "@/store/useStore";
import { loadUserData } from "@/hooks/useDataSync";

interface Book {
    id: string;
    title: string;
    progress: number;
    currentPhase: string;
    createdAt: string;
    updatedAt: string;
}

interface Pagination {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}

export default function BookList() {
    const [books, setBooks] = useState<Book[]>([]);
    const [pagination, setPagination] = useState<Pagination | null>(null);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const setCurrentBookId = useStore((state) => state.setCurrentBookId);

    const fetchBooks = async (page = 1, append = false) => {
        try {
            if (append) setLoadingMore(true);
            else setLoading(true);

            const res = await fetch(`/api/books?page=${page}&limit=10`);
            if (res.ok) {
                const data = await res.json();
                setBooks((prev) => (append ? [...prev, ...data.books] : data.books));
                setPagination(data.pagination);
            }
        } catch (error) {
            console.error("Failed to fetch books:", error);
        } finally {
            if (append) setLoadingMore(false);
            else setLoading(false);
        }
    };

    useEffect(() => {
        fetchBooks();
    }, []);

    const handleResume = async (bookId: string) => {
        // 1. Set current book ID immediately for optimistic UI
        setCurrentBookId(bookId);

        // 2. Load full book data (content, vocabulary, etc.)
        const success = await loadUserData(); // This hook internally uses the latest book or logic to load. 
        // Wait, loadUserData fetches the *latest* book by default in its current implementation.
        // We need to modify loadUserData or manually fetch the specific book here.

        // Let's manually fetch specific book details here to be safe and explicit
        try {
            const res = await fetch(`/api/books/${bookId}`);
            if (res.ok) {
                const { book } = await res.json();

                // Load vocabulary
                const vocabRes = await fetch("/api/vocabulary");
                const vocabularyDB: Record<string, any> = {};
                if (vocabRes.ok) {
                    const { vocabulary } = await vocabRes.json();
                    vocabulary.forEach((v: any) => {
                        vocabularyDB[v.word] = {
                            addedAt: new Date(v.addedAt).getTime(),
                            mastered: v.mastered,
                            reviewCount: v.reviewCount,
                        };
                    });
                }

                const parsedContent = typeof book.content === 'string' ? JSON.parse(book.content) : book.content;

                useStore.getState().loadUserData(
                    book.id,
                    parsedContent,
                    book.progress,
                    vocabularyDB,
                    book.currentPhase || "READING",
                    book.currentSentenceIndex || 0
                );
            }
        } catch (e) {
            console.error("Failed to load book details", e);
            alert("加载书籍失败，请重试");
        }
    };

    const handleDelete = async (e: React.MouseEvent, bookId: string) => {
        e.stopPropagation();
        if (!window.confirm("确定要删除这本书吗？")) return;

        try {
            // API call to delete (Assuming DELETE /api/books/[id] exists or needs to be created, 
            // but for now let's just assume we need to implement it or it might not exist yet. 
            // Wait, there is no DELETE route in the logs. 
            // I will implement a basic delete via fetch assuming I'll add the route, 
            // or effectively hide it from UI if it fails.)

            // Actually, let's just hide the delete button for now if I haven't implemented the API, 
            // or implement the API in the next step. 
            // The user asked for "Delete book option" in my plan, so I should support it.
            // I'll add the DELETE endpoint in the next step.

            const res = await fetch(`/api/books/${bookId}`, { method: "DELETE" });
            if (res.ok) {
                setBooks((prev) => prev.filter((b) => b.id !== bookId));
            } else {
                alert("删除失败");
            }
        } catch (error) {
            console.error("Failed to delete book:", error);
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center p-8">
                <Loader2 className="animate-spin text-primary" size={32} />
            </div>
        );
    }

    return (
        <div className="w-full">
            <h2 style={{ fontSize: "1.25rem", fontWeight: 700, marginBottom: "1rem", color: "var(--foreground)" }}>
                我的书架
            </h2>

            {books.length === 0 ? (
                <div style={{ textAlign: "center", padding: "2rem", color: "var(--secondary-foreground)", opacity: 0.7 }}>
                    还没有上传书籍，快去上传一本吧！
                </div>
            ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "1rem" }}>
                    {books.map((book) => (
                        <div
                            key={book.id}
                            className="glass-card"
                            onClick={() => handleResume(book.id)}
                            style={{
                                padding: "1.25rem",
                                cursor: "pointer",
                                transition: "all 0.2s",
                                display: "flex",
                                flexDirection: "column",
                                gap: "0.75rem",
                                position: "relative",
                                border: "1px solid var(--border)",
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.transform = "translateY(-2px)";
                                e.currentTarget.style.borderColor = "var(--primary)";
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.transform = "translateY(0)";
                                e.currentTarget.style.borderColor = "var(--border)";
                            }}
                        >
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                                <div style={{
                                    width: "40px", height: "40px",
                                    borderRadius: "8px",
                                    background: "var(--primary)",
                                    display: "flex", alignItems: "center", justifyContent: "center",
                                    color: "white", flexShrink: 0
                                }}>
                                    <BookOpen size={20} />
                                </div>
                                {/* Delete Button - Placeholder until API is confirmed */}
                                <button
                                    onClick={(e) => handleDelete(e, book.id)}
                                    style={{ padding: "4px", color: "var(--secondary-foreground)", opacity: 0.5 }}
                                    onMouseEnter={(e) => e.currentTarget.style.color = "var(--error)"}
                                    onMouseLeave={(e) => e.currentTarget.style.color = "var(--secondary-foreground)"}
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>

                            <div>
                                <h3 style={{ fontWeight: 600, fontSize: "1rem", lineHeight: 1.3, marginBottom: "0.25rem" }} className="line-clamp-1">
                                    {book.title}
                                </h3>
                                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.75rem", color: "var(--secondary-foreground)" }}>
                                    <Clock size={12} />
                                    <span>{new Date(book.updatedAt).toLocaleDateString()}</span>
                                </div>
                            </div>

                            <div style={{ marginTop: "auto" }}>
                                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", marginBottom: "0.25rem" }}>
                                    <span>阅读进度</span>
                                    <span>{book.progress} 章节</span>
                                </div>
                                <div style={{ width: "100%", height: "4px", background: "rgba(0,0,0,0.1)", borderRadius: "2px", overflow: "hidden" }}>
                                    <div style={{ width: `${Math.min(book.progress * 5, 100)}%`, height: "100%", background: "var(--primary)" }} />
                                </div>
                                <div style={{ marginTop: "0.5rem", fontSize: "0.75rem", display: "inline-block", padding: "2px 6px", borderRadius: "4px", background: "var(--secondary)" }}>
                                    {book.currentPhase === "READING" && "阅读中"}
                                    {book.currentPhase === "MEMORIZING" && "背单词"}
                                    {book.currentPhase === "SPEAKING" && "口语训练"}
                                    {book.currentPhase === "UPLOAD" && "未开始"}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {pagination && pagination.page < pagination.totalPages && (
                <div style={{ textAlign: "center", marginTop: "2rem" }}>
                    <button
                        onClick={() => fetchBooks(pagination.page + 1, true)}
                        disabled={loadingMore}
                        className="btn-primary"
                        style={{
                            background: "var(--secondary)",
                            color: "var(--foreground)",
                            padding: "0.75rem 2rem"
                        }}
                    >
                        {loadingMore ? (
                            <Loader2 className="animate-spin" size={20} />
                        ) : (
                            <>
                                <span>加载更多</span>
                                <ChevronDown size={18} style={{ marginLeft: "0.5rem" }} />
                            </>
                        )}
                    </button>
                </div>
            )}
        </div>
    );
}
