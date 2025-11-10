"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

interface SimpleMode {
    mode: "simple";
    on: boolean;
    color: string;
}

interface LoopMode {
    mode: "loop";
    colors: string[];
    delay: number;
}

interface CustomMode {
    mode: "custom";
    framerate: number;
    currentBufferIndex?: number;
}

type LedState = SimpleMode | LoopMode | CustomMode;

async function fetchLEDState(): Promise<LedState> {
    const response = await fetch("/api/control");
    if (!response.ok) {
        throw new Error("Failed to fetch LED state");
    }
    return response.json();
}

function StateModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
    const { data: state, isLoading, error } = useQuery({
        queryKey: ["ledState"],
        queryFn: fetchLEDState,
        refetchInterval: 1000, // Refresh every second
        enabled: isOpen, // Only fetch when modal is open
    });

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
            onClick={onClose}
        >
            <div
                className="bg-white dark:bg-black rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-auto border border-solid border-black/[.08] dark:border-white/[.145]"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-2xl font-semibold text-black dark:text-zinc-50">
                            Current Server State
                        </h2>
                        <button
                            onClick={onClose}
                            className="text-zinc-600 dark:text-zinc-400 hover:text-black dark:hover:text-zinc-50 transition-colors"
                        >
                            <svg
                                className="w-6 h-6"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M6 18L18 6M6 6l12 12"
                                />
                            </svg>
                        </button>
                    </div>

                    {isLoading && (
                        <div className="text-zinc-600 dark:text-zinc-400">Loading...</div>
                    )}

                    {error && (
                        <div className="text-red-500">
                            Error: {error instanceof Error ? error.message : "Failed to load state"}
                        </div>
                    )}

                    {state && (
                        <div className="space-y-4">
                            <div className="p-4 bg-zinc-100 dark:bg-zinc-900 rounded border border-solid border-black/[.08] dark:border-white/[.145]">
                                <div className="font-semibold text-black dark:text-zinc-50 mb-2">
                                    Mode: <span className="capitalize">{state.mode}</span>
                                </div>

                                {state.mode === "simple" && (
                                    <div className="space-y-2 text-sm text-zinc-700 dark:text-zinc-300">
                                        <div>
                                            <span className="font-medium">On:</span>{" "}
                                            {state.on ? "true" : "false"}
                                        </div>
                                        <div>
                                            <span className="font-medium">Color:</span> {state.color}
                                        </div>
                                    </div>
                                )}

                                {state.mode === "loop" && (
                                    <div className="space-y-2 text-sm text-zinc-700 dark:text-zinc-300">
                                        <div>
                                            <span className="font-medium">Delay:</span> {state.delay}ms
                                        </div>
                                        <div>
                                            <span className="font-medium">Colors:</span>{" "}
                                            {state.colors.length}
                                            <div className="mt-2 flex flex-wrap gap-2">
                                                {state.colors.map((color, index) => (
                                                    <div
                                                        key={index}
                                                        className="w-8 h-8 rounded border border-solid border-black/[.08] dark:border-white/[.145]"
                                                        style={{ backgroundColor: color }}
                                                        title={color}
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {state.mode === "custom" && (
                                    <div className="space-y-2 text-sm text-zinc-700 dark:text-zinc-300">
                                        <div>
                                            <span className="font-medium">Framerate:</span>{" "}
                                            {state.framerate} fps
                                        </div>
                                        {state.currentBufferIndex !== undefined && (
                                            <div>
                                                <span className="font-medium">Current Buffer Index:</span>{" "}
                                                {state.currentBufferIndex}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            <div className="p-4 bg-zinc-50 dark:bg-zinc-950 rounded border border-solid border-black/[.08] dark:border-white/[.145]">
                                <div className="text-xs text-zinc-500 dark:text-zinc-500 mb-2">
                                    Raw JSON:
                                </div>
                                <pre className="text-xs font-mono text-zinc-700 dark:text-zinc-300 overflow-auto">
                                    {JSON.stringify(state, null, 2)}
                                </pre>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export function StateViewer() {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <>
            <button
                onClick={() => setIsOpen(true)}
                className="px-4 py-2 rounded-full border border-solid border-black/[.08] dark:border-white/[.145] hover:bg-black/[.04] dark:hover:bg-[#1a1a1a] transition-colors text-sm"
            >
                View State
            </button>
            <StateModal isOpen={isOpen} onClose={() => setIsOpen(false)} />
        </>
    );
}

