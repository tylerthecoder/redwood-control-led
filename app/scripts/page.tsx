"use client";

import { useState } from "react";
import { scriptPresets, type ScriptPreset } from "../examples";
import { useLEDState } from "../hooks/use-led-state";

export default function ScriptsPage() {
    const { loading, updateState, error } = useLEDState();
    const [formatText, setFormatText] = useState("");
    const [framerate, setFramerate] = useState(60);
    const [formatError, setFormatError] = useState<string | null>(null);
    const [selectedPreset, setSelectedPreset] = useState<ScriptPreset | null>(null);

    const sendToArduino = () => {
        setFormatError(null);
        const frames = formatText
            .split("\n")
            .map((line) => line.trim())
            .filter((line) => line.length > 0);

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

    const loadPreset = (preset: ScriptPreset) => {
        const frames = preset.generate();
        setFormatText(frames.join("\n"));
        setFramerate(preset.framerate);
        setSelectedPreset(preset);
        setFormatError(null);
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
                        {scriptPresets.map((preset, index) => (
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
                                {scriptPresets.map((preset, index) => (
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
                        </div>
                    </div>

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

                                <button
                                    onClick={sendToArduino}
                                    disabled={loading || !formatText.trim()}
                                    className="h-12 rounded-full bg-foreground text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc] disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {loading ? "Sending..." : "Send to Arduino"}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
