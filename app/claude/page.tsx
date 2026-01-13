"use client";

import { useState, useEffect } from "react";
import { setClaudeMode, getAllScriptsSummaryAction } from "../lib/actions";
import type { ScriptSummary } from "../lib/model";

export default function ClaudePage() {
    const [loading, setLoading] = useState(false);
    const [activated, setActivated] = useState(false);
    const [generating, setGenerating] = useState(false);
    const [claudeScripts, setClaudeScripts] = useState<ScriptSummary[]>([]);
    const [loadingScripts, setLoadingScripts] = useState(true);

    // Pagination state
    const [currentPage, setCurrentPage] = useState(1);
    const scriptsPerPage = 10;

    useEffect(() => {
        fetchClaudeScripts();
    }, []);

    const fetchClaudeScripts = async () => {
        try {
            setLoadingScripts(true);
            // Use summary endpoint to avoid loading large frame data
            const allScripts = await getAllScriptsSummaryAction();
            const claudeOnly = allScripts.filter(s => s.createdBy === "claude");
            setClaudeScripts(claudeOnly);
        } catch (error) {
            console.error("Failed to fetch Claude scripts:", error);
        } finally {
            setLoadingScripts(false);
        }
    };

    const activateClaudeMode = async () => {
        setLoading(true);
        try {
            await setClaudeMode();
            setActivated(true);
        } catch (error) {
            console.error("Failed to activate Claude mode:", error);
        } finally {
            setLoading(false);
        }
    };

    const generateNewScript = async () => {
        setGenerating(true);
        try {
            const response = await fetch("/api/cron", { method: "GET" });
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || "Failed to generate script");
            }
            // Refresh the scripts list
            await fetchClaudeScripts();
        } catch (error) {
            console.error("Failed to generate Claude script:", error);
            alert(`Failed to generate script: ${error instanceof Error ? error.message : "Unknown error"}`);
        } finally {
            setGenerating(false);
        }
    };

    // Pagination computed values
    const totalPages = Math.ceil(claudeScripts.length / scriptsPerPage);
    const startIndex = (currentPage - 1) * scriptsPerPage;
    const endIndex = startIndex + scriptsPerPage;
    const paginatedScripts = claudeScripts.slice(startIndex, endIndex);

    // Reset to page 1 if current page is out of bounds
    useEffect(() => {
        if (currentPage > totalPages && totalPages > 0) {
            setCurrentPage(totalPages);
        }
    }, [currentPage, totalPages]);

    return (
        <div className="flex min-h-screen flex-col bg-zinc-50 font-sans dark:bg-black pb-24">
            <main className="flex flex-row max-w-7xl w-full mx-auto flex-1">
                {/* Sidebar */}
                <aside className="hidden lg:flex w-80 flex-col gap-4 p-8 border-r border-zinc-200 dark:border-zinc-800 max-h-[calc(100vh-6rem)] overflow-y-auto">
                    <div className="sticky top-0 bg-zinc-50 dark:bg-black py-2 z-10 border-b border-zinc-200 dark:border-zinc-800 -mx-4 px-4 mb-2">
                        <h2 className="text-xl font-semibold text-black dark:text-zinc-50">
                            Past Claude Scripts
                        </h2>
                    </div>

                    {loadingScripts ? (
                        <div className="text-sm text-zinc-600 dark:text-zinc-400">Loading scripts...</div>
                    ) : claudeScripts.length === 0 ? (
                        <div className="text-sm text-zinc-600 dark:text-zinc-400">No Claude scripts yet. Generate one!</div>
                    ) : (
                        <>
                            {/* Script count */}
                            <div className="text-xs text-zinc-500 dark:text-zinc-400">
                                Showing {startIndex + 1}-{Math.min(endIndex, claudeScripts.length)} of {claudeScripts.length} scripts
                            </div>

                            <div className="flex flex-col gap-3">
                                {paginatedScripts.map((script) => (
                                    <div
                                        key={script.id}
                                        className={`p-4 rounded border border-solid transition-colors ${script.isActive
                                            ? "border-green-500 bg-green-50 dark:bg-green-950"
                                            : "border-black/[.08] dark:border-white/[.145] hover:bg-black/[.04] dark:hover:bg-[#1a1a1a]"
                                            }`}
                                    >
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2">
                                                    <h3 className="font-semibold text-black dark:text-zinc-50">
                                                        {script.title}
                                                    </h3>
                                                    {script.isActive && (
                                                        <span className="text-xs px-2 py-0.5 rounded bg-green-500 text-white">
                                                            Active
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-xs text-zinc-500 dark:text-zinc-500 mt-1">
                                                    {new Date(script.timestamp).toLocaleDateString()}
                                                </p>
                                                <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-2 line-clamp-2">
                                                    {script.description}
                                                </p>
                                                <p className="text-xs text-zinc-500 dark:text-zinc-500 mt-1">
                                                    {script.frameCount} frames
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Pagination controls */}
                            {totalPages > 1 && (
                                <div className="flex items-center justify-between gap-2 pt-2 border-t border-zinc-200 dark:border-zinc-800">
                                    <button
                                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                        disabled={currentPage === 1}
                                        className="px-3 py-1.5 text-sm rounded bg-zinc-200 dark:bg-zinc-800 text-black dark:text-zinc-50 hover:bg-zinc-300 dark:hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                    >
                                        ← Prev
                                    </button>
                                    <span className="text-sm text-zinc-600 dark:text-zinc-400">
                                        {currentPage} / {totalPages}
                                    </span>
                                    <button
                                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                        disabled={currentPage === totalPages}
                                        className="px-3 py-1.5 text-sm rounded bg-zinc-200 dark:bg-zinc-800 text-black dark:text-zinc-50 hover:bg-zinc-300 dark:hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                    >
                                        Next →
                                    </button>
                                </div>
                            )}
                        </>
                    )}
                </aside>

                {/* Main content */}
                <div className="flex-1 flex flex-col items-center justify-center gap-8 px-8 py-12">
                    <div className="flex flex-col gap-6 w-full max-w-2xl">
                        <h2 className="text-2xl font-semibold text-black dark:text-zinc-50">
                            Claude Mode
                        </h2>

                        <div className="p-6 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-black">
                            <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-6">
                                Claude mode activates AI-generated LED animations created by Claude.
                                These animations are automatically generated based on current events and Claude&apos;s thoughts.
                            </p>

                            {activated ? (
                                <div className="p-4 rounded-lg bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800">
                                    <p className="text-green-800 dark:text-green-200 font-medium">
                                        ✓ Claude mode activated!
                                    </p>
                                    <p className="text-sm text-green-600 dark:text-green-400 mt-2">
                                        The Arduino will now display Claude&apos;s AI-generated animations.
                                    </p>
                                </div>
                            ) : (
                                <div className="flex flex-col gap-4">
                                    <p className="text-zinc-600 dark:text-zinc-400">
                                        Click the button below to activate Claude mode. This will switch the LED controller
                                        to display animations generated by Claude AI.
                                    </p>
                                    <button
                                        onClick={activateClaudeMode}
                                        disabled={loading}
                                        className="px-6 py-3 rounded-full bg-foreground text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc] disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                                    >
                                        {loading ? "Activating..." : "🤖 Activate Claude Mode"}
                                    </button>
                                </div>
                            )}
                        </div>

                        <div className="p-6 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-black">
                            <h3 className="text-lg font-semibold text-black dark:text-zinc-50 mb-4">
                                Generate New Script
                            </h3>
                            <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
                                Ask Claude to generate a new LED animation script based on current events and its thoughts.
                                This will create a new script and set it as active.
                            </p>
                            <button
                                onClick={generateNewScript}
                                disabled={generating}
                                className="px-6 py-3 rounded-full bg-purple-600 text-white transition-colors hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                            >
                                {generating ? "Generating..." : "✨ Generate New Claude Script"}
                            </button>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}

