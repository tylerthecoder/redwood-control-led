"use client";

import { useState, useEffect } from "react";
import { useLEDState } from "../hooks/use-led-state";

interface LoopMode {
  mode: "loop";
  colors: string[];
  delay: number;
}

export default function LoopPage() {
  const { loading, state, updateState } = useLEDState();
  const [localState, setLocalState] = useState<LoopMode>(() => {
    // Initialize from server state if available, otherwise use defaults
    if (state?.mode === "loop") {
      return {
        mode: "loop",
        colors: state.colors || ["#FF0000", "#00FF00", "#0000FF"],
        delay: state.delay || 1000,
      };
    }
    return {
      mode: "loop",
      colors: ["#FF0000", "#00FF00", "#0000FF"],
      delay: 1000,
    };
  });

  // Initialize from server state once when it first loads
  useEffect(() => {
    if (state?.mode === "loop") {
      const isDefaultState = JSON.stringify(localState.colors) === JSON.stringify(["#FF0000", "#00FF00", "#0000FF"]) && localState.delay === 1000;
      if (isDefaultState) {
        setLocalState({
          mode: "loop",
          colors: state.colors || ["#FF0000", "#00FF00", "#0000FF"],
          delay: state.delay || 1000,
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.mode === "loop" ? JSON.stringify(state.colors) : null, state?.mode === "loop" ? state.delay : null]);

  const updateLocalState = (updates: Partial<LoopMode>) => {
    setLocalState(prev => ({
      ...prev,
      ...updates,
    }));
  };

  const addColorToLoop = () => {
    const newColors = [...localState.colors, "#FFFFFF"];
    updateLocalState({ colors: newColors });
  };

  const removeColorFromLoop = (index: number) => {
    const newColors = localState.colors.filter((_, i) => i !== index);
    updateLocalState({ colors: newColors });
  };

  const updateLoopColor = (index: number, color: string) => {
    const newColors = [...localState.colors];
    newColors[index] = color;
    updateLocalState({ colors: newColors });
  };

  const sendToArduino = () => {
    updateState({
      ...localState,
    });
  };

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 font-sans dark:bg-black">
      <main className="flex flex-col items-center gap-8 px-8 py-12 max-w-2xl w-full mx-auto">
        <div className="flex flex-col gap-6 w-full">
          <div className="flex items-center gap-4">
            <label className="text-lg font-medium text-black dark:text-zinc-50">
              Delay (ms):
            </label>
            <input
              type="number"
              value={localState.delay}
              onChange={(e) =>
                updateLocalState({ delay: parseInt(e.target.value) || 1000 })
              }
              disabled={loading}
              min="100"
              step="100"
              className="h-12 px-4 rounded border border-solid border-black/[.08] dark:border-white/[.145] bg-white dark:bg-black text-black dark:text-zinc-50 disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>

          <div className="flex flex-col gap-4">
            <label className="text-lg font-medium text-black dark:text-zinc-50">
              Colors:
            </label>
            <div className="flex flex-col gap-3">
              {localState.colors.map((color, index) => (
                <div key={index} className="flex items-center gap-3">
                  <input
                    type="color"
                    value={color}
                    onChange={(e) => updateLoopColor(index, e.target.value)}
                    disabled={loading}
                    className="h-12 w-24 rounded cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                  <button
                    onClick={() => removeColorFromLoop(index)}
                    disabled={loading || localState.colors.length <= 1}
                    className="h-12 px-4 rounded border border-solid border-red-500 text-red-500 hover:bg-red-50 dark:hover:bg-red-950 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
            <button
              onClick={addColorToLoop}
              disabled={loading}
              className="h-12 rounded-full border border-solid border-black/[.08] dark:border-white/[.145] hover:bg-black/[.04] dark:hover:bg-[#1a1a1a] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              + Add Color
            </button>
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

