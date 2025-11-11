"use client";

import { useState, useEffect } from "react";
import { scriptPresets, type ScriptPreset } from "../examples";
import { useLEDState } from "../hooks/use-led-state";
import LEDPreviewModal from "../components/led-preview-modal";
import type { ClaudeFrameData } from "../lib/state";

export default function ScriptsPage() {
    const { loading, updateState, error } = useLEDState();
    const [formatText, setFormatText] = useState("");
    const [framerate, setFramerate] = useState(60);
    const [formatError, setFormatError] = useState<string | null>(null);
    const [selectedPreset, setSelectedPreset] = useState<ScriptPreset | null>(null);
    const [selectedClaudeScript, setSelectedClaudeScript] = useState<ClaudeFrameData | null>(null);
    const [claudeScripts, setClaudeScripts] = useState<ClaudeFrameData[]>([]);
    const [activeClaudeId, setActiveClaudeId] = useState<number | null>(null);
    const [loadingScripts, setLoadingScripts] = useState(true);
    const [showPreview, setShowPreview] = useState(false);
    const [claudeReasoning, setClaudeReasoning] = useState<string>("");
    const [claudePythonCode, setClaudePythonCode] = useState<string>("");
    const [claudeTimestamp, setClaudeTimestamp] = useState<string>("");

    // Fetch Claude scripts on mount
    useEffect(() => {
        const fetchClaudeScripts = async () => {
            try {
                setLoadingScripts(true);
                const response = await fetch("/api/claude-frames");
                if (response.ok) {
                    const data = await response.json();
                    setClaudeScripts(data.scripts || []);
                    setActiveClaudeId(data.activeId || null);
                }
            } catch (error) {
                console.error("Failed to fetch Claude scripts:", error);
            } finally {
                setLoadingScripts(false);
            }
        };

        fetchClaudeScripts();
    }, []);

    const getFrames = () => {
        return formatText
            .split("\n")
            .map((line) => line.trim())
            .filter((line) => line.length > 0);
    };

    const sendToArduino = () => {
        setFormatError(null);
        const frames = getFrames();

        if (frames.length === 0) {
            setFormatError("Please enter at least one frame");
            return;
        }

        updateState({
            mode: "script",
            frames,
            framerate,
        });
    };

    const openPreview = () => {
        setFormatError(null);
        const frames = getFrames();

        if (frames.length === 0) {
            setFormatError("Please enter at least one frame");
            return;
        }

        setShowPreview(true);
    };

    const loadPreset = async (preset: ScriptPreset) => {
        try {
            setFormatError(null);
            setSelectedClaudeScript(null);

            // Clear Claude data for non-Claude presets
            setClaudeReasoning("");
            setClaudePythonCode("");
            setClaudeTimestamp("");
            const frames = await preset.generate();
            setFormatText(frames.join("\n"));
            setFramerate(preset.framerate);
            setSelectedPreset(preset);
        } catch (error) {
            setFormatError(error instanceof Error ? error.message : "Failed to load preset");
        }
    };

    const loadClaudeScript = async (script: ClaudeFrameData) => {
        try {
            setFormatError(null);
            setSelectedPreset(null);
            setSelectedClaudeScript(script);
            setFormatText(script.frames.join("\n"));
            setClaudeReasoning(script.reasoning);
            setClaudePythonCode(script.pythonCode);
            setClaudeTimestamp(script.timestamp);
        } catch (error) {
            setFormatError(error instanceof Error ? error.message : "Failed to load script");
        }
    };

    const setActiveScript = async (id: number) => {
        try {
            const response = await fetch(`/api/claude-frames/${id}/activate`, {
                method: "POST",
            });
            if (response.ok) {
                setActiveClaudeId(id);
                // Refresh scripts to update active status
                const scriptsResponse = await fetch("/api/claude-frames");
                if (scriptsResponse.ok) {
                    const data = await scriptsResponse.json();
                    setClaudeScripts(data.scripts || []);
                }
            }
        } catch (error) {
            console.error("Failed to set active script:", error);
        }
    };


    return (
        <div className="flex min-h-screen flex-col bg-zinc-50 font-sans dark:bg-black">
            <main className="flex flex-row max-w-7xl w-full mx-auto">
                {/* Sidebar for larger screens */}
                <aside className="hidden lg:flex w-80 flex-col gap-4 p-8 border-r border-zinc-200 dark:border-zinc-800 max-h-screen overflow-y-auto">
                    <h2 className="text-xl font-semibold text-black dark:text-zinc-50 mb-2 sticky top-0 bg-zinc-50 dark:bg-black py-2 z-10">
                        Presets
                    </h2>
                    <div className="flex flex-col gap-3 pb-4">
                        {scriptPresets.filter(p => p.name !== "Claude's Feelings").map((preset, index) => (
                            <div
                                key={index}
                                className={`p-4 rounded border border-solid transition-colors cursor-pointer ${selectedPreset === preset
                                        ? "border-blue-500 bg-blue-50 dark:bg-blue-950"
                                        : "border-black/[.08] dark:border-white/[.145] hover:bg-black/[.04] dark:hover:bg-[#1a1a1a]"
                                    }`}
                                onClick={() => loadPreset(preset)}
                            >
                                <h3 className="font-semibold text-black dark:text-zinc-50">
                                    {preset.name}
                                </h3>
                                <p className="text-xs text-zinc-500 dark:text-zinc-500 mt-1">
                                    {preset.category}
                                </p>
                                <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-2">
                                    {preset.description}
                                </p>
                            </div>
                        ))}
                    </div>

                    <h2 className="text-xl font-semibold text-black dark:text-zinc-50 mb-2 mt-4 sticky top-0 bg-zinc-50 dark:bg-black py-2 z-10">
                        Claude Scripts
                    </h2>
                    {loadingScripts ? (
                        <div className="text-sm text-zinc-600 dark:text-zinc-400">Loading scripts...</div>
                    ) : claudeScripts.length === 0 ? (
                        <div className="text-sm text-zinc-600 dark:text-zinc-400">No Claude scripts yet. Wait for the cron job to generate one.</div>
                    ) : (
                        <div className="flex flex-col gap-3 pb-4">
                            {claudeScripts.map((script) => (
                                <div
                                    key={script.id}
                                    className={`p-4 rounded border border-solid transition-colors ${
                                        selectedClaudeScript?.id === script.id
                                            ? "border-blue-500 bg-blue-50 dark:bg-blue-950"
                                            : script.isActive
                                            ? "border-green-500 bg-green-50 dark:bg-green-950"
                                            : "border-black/[.08] dark:border-white/[.145] hover:bg-black/[.04] dark:hover:bg-[#1a1a1a]"
                                    }`}
                                >
                                    <div className="flex items-start justify-between gap-2">
                                        <div
                                            className="flex-1 cursor-pointer"
                                            onClick={() => loadClaudeScript(script)}
                                        >
                                            <div className="flex items-center gap-2">
                                                <h3 className="font-semibold text-black dark:text-zinc-50">
                                                    {script.name}
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
                                            <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-2">
                                                {script.description}
                                            </p>
                                            <p className="text-xs text-zinc-500 dark:text-zinc-500 mt-1">
                                                {script.frameCount} frames
                                            </p>
                                        </div>
                                        {!script.isActive && (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setActiveScript(script.id);
                                                }}
                                                className="text-xs px-2 py-1 rounded bg-zinc-200 dark:bg-zinc-800 text-black dark:text-zinc-50 hover:bg-zinc-300 dark:hover:bg-zinc-700"
                                            >
                                                Set Active
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </aside>

                {/* Main content */}
                <div className="flex-1 flex flex-col items-center gap-8 px-8 py-12">
                    {/* Mobile preset selector */}
                    <div className="lg:hidden w-full max-w-2xl">
                        <div className="flex flex-col gap-4 p-6 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-black max-h-96 overflow-y-auto">
                            <h2 className="text-xl font-semibold text-black dark:text-zinc-50 sticky top-0 bg-white dark:bg-black py-2 z-10">
                                Presets
                            </h2>
                            <div className="flex flex-col gap-3">
                                {scriptPresets.filter(p => p.name !== "Claude's Feelings").map((preset, index) => (
                                    <div
                                        key={index}
                                        className={`p-4 rounded border border-solid transition-colors cursor-pointer ${selectedPreset === preset
                                                ? "border-blue-500 bg-blue-50 dark:bg-blue-950"
                                                : "border-black/[.08] dark:border-white/[.145] hover:bg-black/[.04] dark:hover:bg-[#1a1a1a]"
                                            }`}
                                        onClick={() => loadPreset(preset)}
                                    >
                                        <h3 className="font-semibold text-black dark:text-zinc-50">
                                            {preset.name}
                                        </h3>
                                        <p className="text-xs text-zinc-500 dark:text-zinc-500 mt-1">
                                            {preset.category}
                                        </p>
                                        <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-2">
                                            {preset.description}
                                        </p>
                                    </div>
                                ))}
                            </div>
                            <h2 className="text-xl font-semibold text-black dark:text-zinc-50 mt-4 sticky top-0 bg-white dark:bg-black py-2 z-10">
                                Claude Scripts
                            </h2>
                            {loadingScripts ? (
                                <div className="text-sm text-zinc-600 dark:text-zinc-400">Loading scripts...</div>
                            ) : claudeScripts.length === 0 ? (
                                <div className="text-sm text-zinc-600 dark:text-zinc-400">No Claude scripts yet.</div>
                            ) : (
                                <div className="flex flex-col gap-3">
                                    {claudeScripts.map((script) => (
                                        <div
                                            key={script.id}
                                            className={`p-4 rounded border border-solid transition-colors ${
                                                selectedClaudeScript?.id === script.id
                                                    ? "border-blue-500 bg-blue-50 dark:bg-blue-950"
                                                    : script.isActive
                                                    ? "border-green-500 bg-green-50 dark:bg-green-950"
                                                    : "border-black/[.08] dark:border-white/[.145]"
                                            }`}
                                            onClick={() => loadClaudeScript(script)}
                                        >
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-2">
                                                        <h3 className="font-semibold text-black dark:text-zinc-50">
                                                            {script.name}
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
                                                    <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-2">
                                                        {script.description}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Claude's Reasoning Section - only visible for Claude scripts */}
                    {selectedClaudeScript && claudeReasoning && (
                        <div className="flex flex-col gap-4 w-full max-w-2xl">
                            <h2 className="text-2xl font-semibold text-black dark:text-zinc-50">
                                Claude's Thoughts
                            </h2>
                            <div className="p-6 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950">
                                <div className="flex items-center gap-2 mb-3">
                                    <span className="text-2xl">🤔</span>
                                    <h3 className="font-semibold text-black dark:text-zinc-50">
                                        Reasoning
                                    </h3>
                                    {claudeTimestamp && (
                                        <span className="text-xs text-zinc-500 dark:text-zinc-400 ml-auto">
                                            Generated: {new Date(claudeTimestamp).toLocaleString()}
                                        </span>
                                    )}
                                </div>
                                <div className="text-sm text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap max-h-96 overflow-y-auto">
                                    {claudeReasoning || "No reasoning available"}
                                </div>
                            </div>

                            {claudePythonCode && (
                                <div className="p-6 rounded-lg border border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-950">
                                    <div className="flex items-center gap-2 mb-3">
                                        <span className="text-2xl">💻</span>
                                        <h3 className="font-semibold text-black dark:text-zinc-50">
                                            Generated Python Code
                                        </h3>
                                    </div>
                                    <pre className="text-xs text-zinc-700 dark:text-zinc-300 font-mono whitespace-pre-wrap max-h-96 overflow-y-auto bg-white dark:bg-black p-4 rounded border border-zinc-200 dark:border-zinc-800">
                                        {claudePythonCode}
                                    </pre>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Customize section - always visible */}
                    <div className="flex flex-col gap-6 w-full max-w-2xl">
                        <h2 className="text-2xl font-semibold text-black dark:text-zinc-50">
                            Customize Script
                        </h2>

                        <div className="p-6 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-black">
                            <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-6">
                                Scripts let you create custom frame-by-frame animations. Each line represents one frame,
                                containing 60 comma-separated hex color values (one for each LED). The framerate controls
                                how fast your animation plays. Experiment with different patterns to create mesmerizing effects!
                            </p>

                            <div className="flex flex-col gap-6">
                                <div className="flex items-center gap-4">
                                    <label className="text-lg font-medium text-black dark:text-zinc-50 w-32">
                                        Framerate:
                                    </label>
                                    <input
                                        type="number"
                                        value={framerate}
                                        onChange={(e) => setFramerate(parseInt(e.target.value) || 60)}
                                        disabled={loading}
                                        min="1"
                                        max="120"
                                        className="h-12 px-4 rounded border border-solid border-black/[.08] dark:border-white/[.145] bg-white dark:bg-black text-black dark:text-zinc-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                    />
                                    <span className="text-sm text-zinc-600 dark:text-zinc-400">fps</span>
                                </div>

                                <div className="flex flex-col gap-4">
                                    <label className="text-lg font-medium text-black dark:text-zinc-50">
                                        Animation Frames:
                                    </label>
                                    <textarea
                                        value={formatText}
                                        onChange={(e) => {
                                            setFormatText(e.target.value);
                                            setFormatError(null);
                                        }}
                                        disabled={loading}
                                        rows={15}
                                        className="w-full px-4 py-3 rounded border border-solid border-black/[.08] dark:border-white/[.145] bg-white dark:bg-black text-black dark:text-zinc-50 font-mono text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                                        placeholder="#FF0000,#FF0000,...,#00FF00 (60 colors per line)"
                                    />
                                    {formatError && (
                                        <div className="text-red-500 text-sm">{formatError}</div>
                                    )}
                                    {error && !formatError && (
                                        <div className="text-red-500 text-sm">
                                            {error instanceof Error ? error.message : "Failed to update LED state"}
                                        </div>
                                    )}
                                </div>

                                <div className="flex gap-3">
                                    <button
                                        onClick={openPreview}
                                        disabled={!formatText.trim()}
                                        className="h-12 flex-1 rounded-full bg-zinc-200 dark:bg-zinc-800 text-black dark:text-zinc-50 transition-colors hover:bg-zinc-300 dark:hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        👁 Preview
                                    </button>
                                    <button
                                        onClick={sendToArduino}
                                        disabled={loading || !formatText.trim()}
                                        className="h-12 flex-1 rounded-full bg-foreground text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc] disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {loading ? "Sending..." : "Send to Arduino"}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </main>

            {/* Preview Modal */}
            <LEDPreviewModal
                frames={getFrames()}
                framerate={framerate}
                isOpen={showPreview}
                onClose={() => setShowPreview(false)}
            />
        </div>
    );
}
