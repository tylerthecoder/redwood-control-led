"use client";

import { useState, useEffect } from "react";
import { useLEDState } from "../hooks/use-led-state";
import LEDPreviewModal from "../components/led-preview-modal";
import type { Script } from "../lib/model";
import { LED_LANGUAGE_EXPLANATION } from "../lib/script-execution";
import {
    getAllScriptsAction,
    testScriptAction,
    createScriptAction,
    updateScriptAction,
    deleteScriptAction,
    activateScriptAction,
} from "../lib/actions";

export default function ScriptsPage() {
    const { loading, updateState } = useLEDState();

    // Script data
    const [scripts, setScripts] = useState<Script[]>([]);
    const [selectedScript, setSelectedScript] = useState<Script | null>(null);
    const [loadingScripts, setLoadingScripts] = useState(true);

    // Form state
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [pythonCode, setPythonCode] = useState("");
    const [frames, setFrames] = useState<string[]>([]);
    const [framerate, setFramerate] = useState(60);

    // UI state
    const [showPreview, setShowPreview] = useState(false);
    const [testResult, setTestResult] = useState<{
        success: boolean;
        error?: string;
        frameCount?: number;
        executionTime?: string;
    } | null>(null);
    const [isRunning, setIsRunning] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [showDocs, setShowDocs] = useState(false);
    const [showOutput, setShowOutput] = useState(false);

    // Fetch scripts on mount
    useEffect(() => {
        fetchScripts();
    }, []);

    const fetchScripts = async () => {
        try {
            setLoadingScripts(true);
            const scripts = await getAllScriptsAction();
            setScripts(scripts);
        } catch (error) {
            console.error("Failed to fetch scripts:", error);
        } finally {
            setLoadingScripts(false);
        }
    };

    const loadScript = (script: Script) => {
        setSelectedScript(script);
        setTitle(script.title);
        setDescription(script.description);
        setPythonCode(script.pythonCode);
        setFrames(script.frames);
        setFramerate(script.framerate || 60);
        setTestResult(null);
    };

    const createNewScript = () => {
        setSelectedScript(null);
        setTitle("");
        setDescription("");
        setPythonCode("");
        setFrames([]);
        setTestResult(null);
    };

    const runScript = async () => {
        setIsRunning(true);
        setTestResult(null);

        try {
            const result = await testScriptAction(title, description, pythonCode);
            setTestResult(result);

            if (result.success && result.frames) {
                setFrames(result.frames);
            }
        } catch (error) {
            setTestResult({
                success: false,
                error: `Failed to run script: ${error instanceof Error ? error.message : "Unknown error"}`
            });
        } finally {
            setIsRunning(false);
        }
    };

    const saveScript = async () => {
        setIsSaving(true);

        try {
            let result;

            if (selectedScript) {
                // Update existing script
                result = await updateScriptAction(
                    selectedScript.id,
                    title,
                    description,
                    pythonCode,
                    framerate
                );
            } else {
                // Create new script
                result = await createScriptAction(
                    title,
                    description,
                    pythonCode,
                    false,
                    framerate
                );
            }

            setTestResult(result);

            if (result.success) {
                await fetchScripts();
                if (result.frameCount !== undefined && frames.length === 0) {
                    // If we didn't have frames before, run the script to get them
                    const testResult = await testScriptAction(title, description, pythonCode);
                    if (testResult.success && testResult.frames) {
                        setFrames(testResult.frames);
                    }
                }
            }
        } catch (error) {
            setTestResult({
                success: false,
                error: `Failed to save script: ${error instanceof Error ? error.message : "Unknown error"}`
            });
        } finally {
            setIsSaving(false);
        }
    };

    const sendToArduino = () => {
        if (frames.length === 0) {
            return;
        }

        updateState({
            mode: "script",
            frames,
            framerate,
        });
    };

    const setActive = async (id: number) => {
        try {
            const result = await activateScriptAction(id);
            if (result.success) {
                await fetchScripts();
            } else {
                console.error("Failed to activate script:", result.error);
            }
        } catch (error) {
            console.error("Failed to activate script:", error);
        }
    };

    const deleteScriptById = async (id: number) => {
        if (!confirm("Are you sure you want to delete this script?")) return;

        try {
            const result = await deleteScriptAction(id);
            if (result.success) {
                await fetchScripts();
                if (selectedScript?.id === id) {
                    createNewScript();
                }
            } else {
                console.error("Failed to delete script:", result.error);
            }
        } catch (error) {
            console.error("Failed to delete script:", error);
        }
    };

    const activeScript = scripts.find(s => s.isActive);

    return (
        <div className="flex min-h-screen flex-col bg-zinc-50 dark:bg-black font-sans pb-24">
            <main className="flex flex-row max-w-7xl w-full mx-auto flex-1">
                {/* Sidebar */}
                <aside className="hidden lg:flex w-80 flex-col gap-4 p-8 border-r border-zinc-200 dark:border-zinc-800 max-h-[calc(100vh-6rem)] overflow-y-auto">
                    <div className="sticky top-0 bg-zinc-50 dark:bg-black py-2 z-10 border-b border-zinc-200 dark:border-zinc-800 -mx-4 px-4 mb-2">
                        <h2 className="text-xl font-semibold text-black dark:text-zinc-50">
                            Scripts
                        </h2>
                    </div>

                    <button
                        onClick={createNewScript}
                        className="w-full p-4 rounded border-2 border-dashed border-blue-500 bg-blue-50 dark:bg-blue-950 hover:bg-blue-100 dark:hover:bg-blue-900 transition-colors"
                    >
                        <span className="text-blue-700 dark:text-blue-300 font-medium">
                            + New Script
                        </span>
                    </button>

                    {loadingScripts ? (
                        <div className="text-sm text-zinc-600 dark:text-zinc-400">Loading scripts...</div>
                    ) : scripts.length === 0 ? (
                        <div className="text-sm text-zinc-600 dark:text-zinc-400">No scripts yet. Create one!</div>
                    ) : (
                        <div className="flex flex-col gap-3">
                            {scripts.map((script) => (
                                <div
                                    key={script.id}
                                    className={`p-4 rounded border border-solid transition-colors ${selectedScript?.id === script.id
                                        ? "border-blue-500 bg-blue-50 dark:bg-blue-950"
                                        : script.isActive
                                            ? "border-green-500 bg-green-50 dark:bg-green-950"
                                            : "border-black/[.08] dark:border-white/[.145] hover:bg-black/[.04] dark:hover:bg-[#1a1a1a]"
                                        }`}
                                >
                                    <div className="flex items-start justify-between gap-2">
                                        <div
                                            className="flex-1 cursor-pointer"
                                            onClick={() => loadScript(script)}
                                        >
                                            <div className="flex items-center gap-2">
                                                <h3 className="font-semibold text-black dark:text-zinc-50">
                                                    {script.title}
                                                </h3>
                                                {script.isActive && (
                                                    <span className="text-xs px-2 py-0.5 rounded bg-green-500 text-white">
                                                        Active
                                                    </span>
                                                )}
                                                {script.createdBy === "claude" && (
                                                    <span className="text-xs px-2 py-0.5 rounded bg-purple-500 text-white">
                                                        Claude
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
                                        <div className="flex flex-col gap-1">
                                            {!script.isActive && (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setActive(script.id);
                                                    }}
                                                    className="text-xs px-2 py-1 rounded bg-zinc-200 dark:bg-zinc-800 text-black dark:text-zinc-50 hover:bg-zinc-300 dark:hover:bg-zinc-700"
                                                >
                                                    Set Active
                                                </button>
                                            )}
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    deleteScriptById(script.id);
                                                }}
                                                className="text-xs px-2 py-1 rounded bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-800"
                                            >
                                                Delete
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </aside>

                {/* Main content */}
                <div className="flex-1 flex flex-col items-center gap-6 px-8 py-12">
                    {/* Script editor */}
                    <div className="flex flex-col gap-6 w-full max-w-4xl">
                        <div className="flex items-center justify-between">
                            <h2 className="text-2xl font-semibold text-black dark:text-zinc-50">
                                {selectedScript ? "Edit Script" : "New Script"}
                            </h2>
                            <button
                                onClick={() => setShowDocs(!showDocs)}
                                className="text-sm px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700"
                            >
                                {showDocs ? "Hide Docs" : "Show Docs"}
                            </button>
                        </div>

                        {showDocs && (
                            <div className="p-6 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
                                <h3 className="text-lg font-semibold mb-3">LED Language Documentation</h3>
                                <pre className="text-xs text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap overflow-x-auto">
                                    {LED_LANGUAGE_EXPLANATION}
                                </pre>
                            </div>
                        )}

                        <div className="p-6 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-black">
                            <div className="flex flex-col gap-6">
                                {/* Title */}
                                <div>
                                    <label htmlFor="title" className="block text-sm font-medium text-black dark:text-zinc-50 mb-2">
                                        Title *
                                    </label>
                                    <input
                                        id="title"
                                        type="text"
                                        value={title}
                                        onChange={(e) => setTitle(e.target.value)}
                                        placeholder="e.g., Rainbow Wave"
                                        className="w-full px-4 py-2 rounded border border-solid border-black/[.08] dark:border-white/[.145] bg-white dark:bg-black text-black dark:text-zinc-50"
                                        maxLength={50}
                                    />
                                    <p className="text-xs text-zinc-500 mt-1">{title.length}/50 characters</p>
                                </div>

                                {/* Description */}
                                <div>
                                    <label htmlFor="description" className="block text-sm font-medium text-black dark:text-zinc-50 mb-2">
                                        Description *
                                    </label>
                                    <textarea
                                        id="description"
                                        value={description}
                                        onChange={(e) => setDescription(e.target.value)}
                                        placeholder="A brief description of what this animation represents..."
                                        rows={2}
                                        className="w-full px-4 py-2 rounded border border-solid border-black/[.08] dark:border-white/[.145] bg-white dark:bg-black text-black dark:text-zinc-50 resize-none"
                                        maxLength={200}
                                    />
                                    <p className="text-xs text-zinc-500 mt-1">{description.length}/200 characters</p>
                                </div>

                                {/* Python Code */}
                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <label htmlFor="pythonCode" className="block text-sm font-medium text-black dark:text-zinc-50">
                                            Python Code *
                                        </label>
                                        <button
                                            onClick={runScript}
                                            disabled={isRunning || !title || !description || !pythonCode}
                                            className="px-4 py-1 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                                        >
                                            {isRunning ? "Running..." : "▶ Run Script"}
                                        </button>
                                    </div>
                                    <textarea
                                        id="pythonCode"
                                        value={pythonCode}
                                        onChange={(e) => setPythonCode(e.target.value)}
                                        placeholder="# Your Python code here&#10;print('#FF0000,' * 59 + '#FF0000')"
                                        rows={15}
                                        className="w-full px-4 py-2 rounded border border-solid border-black/[.08] dark:border-white/[.145] bg-white dark:bg-black text-black dark:text-zinc-50 font-mono text-sm resize-y"
                                    />
                                </div>

                                {/* Test Results */}
                                {testResult && (
                                    <div className={`p-4 rounded-lg border-2 ${testResult.success ? "border-green-200 bg-green-50 dark:bg-green-950" : "border-red-200 bg-red-50 dark:bg-red-950"}`}>
                                        <h3 className={`font-semibold mb-2 ${testResult.success ? "text-green-900 dark:text-green-100" : "text-red-900 dark:text-red-100"}`}>
                                            {testResult.success ? "✓ Success!" : "✗ Error"}
                                        </h3>
                                        {testResult.success ? (
                                            <div className="text-sm text-green-800 dark:text-green-200">
                                                <p>Generated {testResult.frameCount} frames</p>
                                                {testResult.executionTime && <p>Execution time: {testResult.executionTime}s</p>}
                                            </div>
                                        ) : (
                                            <pre className="text-sm text-red-800 dark:text-red-200 whitespace-pre-wrap overflow-x-auto">
                                                {testResult.error}
                                            </pre>
                                        )}
                                    </div>
                                )}

                                {/* Script Output (Frames) */}
                                {(frames.length > 0 || (selectedScript && selectedScript.frames.length > 0)) && (
                                    <div className="border border-solid border-black/[.08] dark:border-white/[.145] rounded-lg overflow-hidden">
                                        <button
                                            onClick={() => setShowOutput(!showOutput)}
                                            className="w-full px-4 py-3 flex items-center justify-between bg-zinc-100 dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors"
                                        >
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm font-medium text-black dark:text-zinc-50">
                                                    Script Output
                                                </span>
                                                <span className="text-xs text-zinc-500 dark:text-zinc-400">
                                                    ({frames.length > 0 ? frames.length : selectedScript?.frames.length ?? 0} frames)
                                                </span>
                                            </div>
                                            <svg
                                                className={`w-5 h-5 text-zinc-600 dark:text-zinc-400 transition-transform ${showOutput ? "rotate-180" : ""}`}
                                                fill="none"
                                                stroke="currentColor"
                                                viewBox="0 0 24 24"
                                            >
                                                <path
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    strokeWidth={2}
                                                    d="M19 9l-7 7-7-7"
                                                />
                                            </svg>
                                        </button>
                                        {showOutput && (
                                            <div className="p-4 bg-white dark:bg-black max-h-96 overflow-y-auto">
                                                <pre className="text-xs font-mono text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap break-all">
                                                    {(frames.length > 0 ? frames : selectedScript?.frames ?? []).join("\n")}
                                                </pre>
                                            </div>
                                        )}
                                    </div>
                                )}

                            </div>
                        </div>
                    </div>
                </div>
            </main>

            {/* Sticky Footer */}
            <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-black border-t border-zinc-200 dark:border-zinc-800 py-4 px-8 shadow-lg z-50">
                <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4 flex-1">
                        <label className="text-sm font-medium text-black dark:text-zinc-50">
                            Framerate:
                        </label>
                        <input
                            type="number"
                            value={framerate}
                            onChange={(e) => setFramerate(parseInt(e.target.value) || 60)}
                            min="1"
                            max="120"
                            className="w-24 px-3 py-2 rounded border border-solid border-black/[.08] dark:border-white/[.145] bg-white dark:bg-black text-black dark:text-zinc-50"
                        />
                        <span className="text-sm text-zinc-600 dark:text-zinc-400">fps</span>

                        {activeScript && (
                            <div className="ml-auto text-sm text-zinc-600 dark:text-zinc-400">
                                Active: <span className="font-medium text-black dark:text-zinc-50">{activeScript.title}</span>
                            </div>
                        )}
                    </div>

                    <div className="flex gap-3">
                        <button
                            onClick={() => frames.length > 0 && setShowPreview(true)}
                            disabled={frames.length === 0}
                            className="px-6 py-3 rounded-full bg-zinc-200 dark:bg-zinc-800 text-black dark:text-zinc-50 transition-colors hover:bg-zinc-300 dark:hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                        >
                            👁 Preview
                        </button>
                        <button
                            onClick={saveScript}
                            disabled={isSaving || !title || !description || !pythonCode}
                            className="px-6 py-3 rounded-full bg-blue-600 text-white transition-colors hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                        >
                            {isSaving ? "Saving..." : "💾 Save Script"}
                        </button>
                        <button
                            onClick={sendToArduino}
                            disabled={loading || frames.length === 0}
                            className="px-6 py-3 rounded-full bg-foreground text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc] disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                        >
                            {loading ? "Sending..." : "📡 Send to Arduino"}
                        </button>
                    </div>
                </div>
            </div>

            {/* Preview Modal */}
            <LEDPreviewModal
                frames={frames}
                framerate={framerate}
                isOpen={showPreview}
                onClose={() => setShowPreview(false)}
            />
        </div>
    );
}
