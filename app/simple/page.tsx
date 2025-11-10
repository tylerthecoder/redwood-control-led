"use client";

import { useState } from "react";
import { useLEDState } from "../hooks/use-led-state";

interface SimplePageContentProps {
    initialOn: boolean;
    initialColor: string;
}

function SimplePageContent({ initialOn, initialColor }: SimplePageContentProps) {
    const { loading, updateState } = useLEDState();
    const [on, setOn] = useState(initialOn);
    const [color, setColor] = useState(initialColor);

    const sendToArduino = () => {
        updateState({
            mode: "simple",
            on,
            color,
        });
    };

    return (
        <div className="flex min-h-screen flex-col bg-zinc-50 font-sans dark:bg-black">
            <main className="flex flex-col items-center gap-8 px-8 py-12 max-w-2xl w-full mx-auto">
                <div className="flex flex-col gap-6 w-full">
                    <div className="flex items-center gap-4">
                        <label className="text-lg font-medium text-black dark:text-zinc-50">
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
                        <label className="text-lg font-medium text-black dark:text-zinc-50">
                            Color:
                        </label>
                        <input
                            type="color"
                            value={color ?? "#0000FF"}
                            onChange={(e) => setColor(e.target.value)}
                            disabled={loading}
                            className="h-12 w-24 rounded cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                        />
                    </div>

                    <button
                        onClick={sendToArduino}
                        disabled={loading}
                        className="h-12 rounded-full bg-foreground text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc] disabled:opacity-50 disabled:cursor-not-allowed mt-4"
                    >
                        {loading ? "Sending..." : "Send to Arduino"}
                    </button>
                </div>
            </main>
        </div>
    );
}

export default function SimplePage() {
    const { state, loading } = useLEDState();


    // Extract initial values from server state
    const initialOn = state?.mode === "simple" ? (state.on ?? false) : false;
    const initialColor = state?.mode === "simple" ? (state.color ?? "#0000FF") : "#0000FF";

    console.log("state", state);
    console.log("loading", loading);
    console.log("initialOn", initialOn);
    console.log("initialColor", initialColor);

    if (loading) {
        return (
            <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 font-sans dark:bg-black">
                <div className="text-zinc-600 dark:text-zinc-400">Loading...</div>
            </div>
        );
    }

    return <SimplePageContent initialOn={initialOn} initialColor={initialColor} />;
}
