"use client";

import { useState } from "react";
import { simplePresets, type SimplePreset } from "../examples";
import { useLEDState } from "../hooks/use-led-state";

export default function SimplePage() {
    const { loading, updateState } = useLEDState();
    const [on, setOn] = useState(false);
    const [color, setColor] = useState("#0000FF");
    const [selectedPreset, setSelectedPreset] = useState<SimplePreset | null>(null);

    const loadPreset = (preset: SimplePreset) => {
        // "Off" preset has color #000000, everything else should be on
        const isOn = preset.color !== "#000000";
        setOn(isOn);
        setColor(preset.color);
        setSelectedPreset(preset);
    };

    const sendToArduino = () => {
        updateState({
            mode: "simple",
            on,
            color,
        });
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
                        {simplePresets.map((preset, index) => (
                            <div
                                key={index}
                                className={`p-4 rounded border border-solid transition-colors cursor-pointer ${selectedPreset === preset
                                    ? "border-blue-500 bg-blue-50 dark:bg-blue-950"
                                    : "border-black/[.08] dark:border-white/[.145] hover:bg-black/[.04] dark:hover:bg-[#1a1a1a]"
                                    }`}
                                onClick={() => loadPreset(preset)}
                            >
                                <div className="flex items-center gap-3 mb-2">
                                    <div
                                        className="w-8 h-8 rounded border border-zinc-300 dark:border-zinc-600"
                                        style={{ backgroundColor: preset.color, opacity: preset.color !== "#000000" ? 1 : 0.3 }}
                                    />
                                    <h3 className="font-semibold text-black dark:text-zinc-50">
                                        {preset.name}
                                    </h3>
                                </div>
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
                                {simplePresets.map((preset, index) => (
                                    <div
                                        key={index}
                                        className={`p-4 rounded border border-solid transition-colors cursor-pointer ${selectedPreset === preset
                                            ? "border-blue-500 bg-blue-50 dark:bg-blue-950"
                                            : "border-black/[.08] dark:border-white/[.145] hover:bg-black/[.04] dark:hover:bg-[#1a1a1a]"
                                            }`}
                                        onClick={() => loadPreset(preset)}
                                    >
                                        <div className="flex items-center gap-3 mb-2">
                                            <div
                                                className="w-8 h-8 rounded border border-zinc-300 dark:border-zinc-600"
                                                style={{ backgroundColor: preset.color, opacity: preset.color !== "#000000" ? 1 : 0.3 }}
                                            />
                                            <h3 className="font-semibold text-black dark:text-zinc-50">
                                                {preset.name}
                                            </h3>
                                        </div>
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
                            Customize
                        </h2>

                        <div className="p-6 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-black">
                            <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-6">
                                Simple mode lets you set all LEDs to the same color. Turn them on or off,
                                and choose any color you like. Perfect for ambient lighting or a clean look.
                            </p>

                            <div className="flex flex-col gap-6">
                                <div className="flex items-center gap-4">
                                    <label className="text-lg font-medium text-black dark:text-zinc-50 w-32">
                                        On/Off:
                                    </label>
                                    <button
                                        onClick={() => setOn(!on)}
                                        disabled={loading}
                                        className={`h-12 w-24 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${on
                                            ? "bg-foreground text-background"
                                            : "border border-solid border-black/[.08] dark:border-white/[.145]"
                                            }`}
                                    >
                                        {on ? "ON" : "OFF"}
                                    </button>
                                </div>

                                <div className="flex items-center gap-4">
                                    <label className="text-lg font-medium text-black dark:text-zinc-50 w-32">
                                        Color:
                                    </label>
                                    <input
                                        type="color"
                                        value={color ?? "#0000FF"}
                                        onChange={(e) => setColor(e.target.value)}
                                        disabled={loading}
                                        className="h-12 w-24 rounded cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                                    />
                                    <span className="text-sm text-zinc-600 dark:text-zinc-400 font-mono">
                                        {color}
                                    </span>
                                </div>

                                <button
                                    onClick={sendToArduino}
                                    disabled={loading}
                                    className="h-12 rounded-full bg-foreground text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc] disabled:opacity-50 disabled:cursor-not-allowed mt-4"
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
