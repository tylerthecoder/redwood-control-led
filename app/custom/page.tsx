"use client";

import { useState } from "react";
import { examples, type Example } from "../examples";
import { useLEDState } from "../hooks/use-led-state";

export default function CustomPage() {
    const { loading, updateState, error } = useLEDState();
    const [formatText, setFormatText] = useState("");
    const [framerate, setFramerate] = useState(60);
    const [formatError, setFormatError] = useState<string | null>(null);
    const [selectedExample, setSelectedExample] = useState<Example | null>(null);
    const [showExamples, setShowExamples] = useState(false);

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
            mode: "custom",
            frames,
            framerate,
        });
    };

    const loadExample = (example: Example) => {
        const frames = example.generate();
        setFormatText(frames.join("\n"));
        setFramerate(example.framerate);
        setSelectedExample(example);
        setFormatError(null);
    };

    return (
        <div className="flex min-h-screen flex-col bg-zinc-50 font-sans dark:bg-black">
            <main className="flex flex-col items-center gap-8 px-8 py-12 max-w-2xl w-full mx-auto">
                <div className="flex flex-col gap-6 w-full">
                    <div className="flex items-center gap-4">
                        <label className="text-lg font-medium text-black dark:text-zinc-50">
                            Framerate (fps):
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
                    </div>

                    {/* Examples Section */}
                    <div className="flex flex-col gap-4 w-full">
                        <div className="flex items-center justify-between">
                            <label className="text-lg font-medium text-black dark:text-zinc-50">
                                Examples:
                            </label>
                            <button
                                onClick={() => setShowExamples(!showExamples)}
                                className="h-10 px-4 rounded-full border border-solid border-black/[.08] dark:border-white/[.145] hover:bg-black/[.04] dark:hover:bg-[#1a1a1a] transition-colors"
                            >
                                {showExamples ? "Hide" : "Show"} Examples
                            </button>
                        </div>

                        {showExamples && (
                            <div className="flex flex-col gap-3 p-4 rounded border border-solid border-black/[.08] dark:border-white/[.145] bg-white/[.5] dark:bg-black/[.5]">
                                {examples.map((example, index) => (
                                    <div
                                        key={index}
                                        className={`p-4 rounded border border-solid transition-colors cursor-pointer ${selectedExample === example
                                            ? "border-blue-500 bg-blue-50 dark:bg-blue-950"
                                            : "border-black/[.08] dark:border-white/[.145] hover:bg-black/[.04] dark:hover:bg-[#1a1a1a]"
                                            }`}
                                        onClick={() => loadExample(example)}
                                    >
                                        <h3 className="font-semibold text-black dark:text-zinc-50">
                                            {example.name}
                                        </h3>
                                        <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
                                            {example.description}
                                        </p>
                                        <p className="text-xs text-zinc-500 dark:text-zinc-500 mt-1">
                                            {example.generate().length} frames @ {example.framerate} fps
                                        </p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="flex flex-col gap-4 w-full">
                        <label className="text-lg font-medium text-black dark:text-zinc-50">
                            Format (one frame per line, 60 comma-separated hex colors per line):
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
            </main>
        </div>
    );
}

