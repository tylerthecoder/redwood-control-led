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
    const [showCustomize, setShowCustomize] = useState(false);

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

    const applyPreset = (preset: ScriptPreset) => {
        const frames = preset.generate();
        updateState({
            mode: "script",
            frames,
            framerate: preset.framerate,
        });
        setSelectedPreset(preset);
    };

    return (
        <div className="flex min-h-screen flex-col bg-zinc-50 font-sans dark:bg-black">
            <main className="flex flex-row max-w-7xl w-full mx-auto">
                {/* Sidebar for larger screens */}
                <aside className="hidden lg:flex w-80 flex-col gap-4 p-8 border-r border-zinc-200 dark:border-zinc-800">
                    <h2 className="text-xl font-semibold text-black dark:text-zinc-50 mb-2">
                        Presets
                    </h2>
                    <div className="flex flex-col gap-3">
                        {scriptPresets.map((preset, index) => (
                            <div
                                key={index}
                                className={`p-4 rounded border border-solid transition-colors cursor-pointer ${
                                    selectedPreset === preset
                                        ? "border-blue-500 bg-blue-50 dark:bg-blue-950"
                                        : "border-black/[.08] dark:border-white/[.145] hover:bg-black/[.04] dark:hover:bg-[#1a1a1a]"
                                }`}
                                onClick={() => applyPreset(preset)}
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
                    <button
                        onClick={() => setShowCustomize(!showCustomize)}
                        className="mt-4 h-12 rounded-full border-2 border-solid border-blue-500 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950 transition-colors font-medium"
                    >
                        {showCustomize ? "Hide" : "Show"} Customize
                    </button>
                </aside>

                {/* Main content */}
                <div className="flex-1 flex flex-col items-center gap-8 px-8 py-12">
                    {/* Mobile preset selector */}
                    <div className="lg:hidden w-full max-w-2xl">
                        <div className="flex flex-col gap-4 p-6 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-black">
                            <h2 className="text-xl font-semibold text-black dark:text-zinc-50">
                                Presets
                            </h2>
                            <div className="flex flex-col gap-3">
                                {scriptPresets.map((preset, index) => (
                                    <div
                                        key={index}
                                        className={`p-4 rounded border border-solid transition-colors cursor-pointer ${
                                            selectedPreset === preset
                                                ? "border-blue-500 bg-blue-50 dark:bg-blue-950"
                                                : "border-black/[.08] dark:border-white/[.145] hover:bg-black/[.04] dark:hover:bg-[#1a1a1a]"
                                        }`}
                                        onClick={() => applyPreset(preset)}
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

                    {/* Customize section */}
                    {(showCustomize || !selectedPreset) && (
                        <div className="flex flex-col gap-6 w-full max-w-2xl">
                            <div className="flex items-center justify-between">
                                <h2 className="text-2xl font-semibold text-black dark:text-zinc-50">
                                    Customize Script
                                </h2>
                                {selectedPreset && (
                                    <button
                                        onClick={() => setShowCustomize(false)}
                                        className="text-sm text-zinc-600 dark:text-zinc-400 hover:text-black dark:hover:text-zinc-50"
                                    >
                                        Hide
                                    </button>
                                )}
                            </div>

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

                                    {/* Quick load presets for customization */}
                                    <div className="flex flex-col gap-3">
                                        <label className="text-sm font-medium text-black dark:text-zinc-50">
                                            Load preset to customize:
                                        </label>
                                        <div className="flex flex-wrap gap-2">
                                            {scriptPresets.map((preset, index) => (
                                                <button
                                                    key={index}
                                                    onClick={() => loadPreset(preset)}
                                                    className="px-4 py-2 text-sm rounded-full border border-solid border-black/[.08] dark:border-white/[.145] hover:bg-black/[.04] dark:hover:bg-[#1a1a1a] transition-colors"
                                                >
                                                    {preset.name}
                                                </button>
                                            ))}
                                        </div>
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
                    )}
                </div>
            </main>
        </div>
    );
}

