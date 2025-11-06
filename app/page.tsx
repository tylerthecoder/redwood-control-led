"use client";

import { useState, useEffect } from "react";

type Mode = "simple" | "loop";

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

export default function Home() {
  const [mode, setMode] = useState<Mode>("simple");
  const [simpleState, setSimpleState] = useState<SimpleMode>({
    mode: "simple",
    on: false,
    color: "#0000FF",
  });
  const [loopState, setLoopState] = useState<LoopMode>({
    mode: "loop",
    colors: ["#FF0000", "#00FF00", "#0000FF"],
    delay: 1000,
  });
  const [loading, setLoading] = useState(false);

  // Fetch current state on mount
  useEffect(() => {
    fetchCurrentState();
  }, []);

  const fetchCurrentState = async () => {
    try {
      const response = await fetch("/api/control");
      const data = await response.json();
      if (data.mode === "simple") {
        setMode("simple");
        setSimpleState(data);
      } else if (data.mode === "loop") {
        setMode("loop");
        setLoopState(data);
      }
    } catch (error) {
      console.error("Error fetching state:", error);
    }
  };

  const updateSimpleMode = async (updates: Partial<SimpleMode>) => {
    setLoading(true);
    try {
      const newState = { ...simpleState, ...updates };
      const response = await fetch("/api/control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newState),
      });
      const data = await response.json();
      setSimpleState(data);
    } catch (error) {
      console.error("Error updating simple mode:", error);
    } finally {
      setLoading(false);
    }
  };

  const updateLoopMode = async (updates: Partial<LoopMode>) => {
    setLoading(true);
    try {
      const newState = { ...loopState, ...updates };
      const response = await fetch("/api/control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newState),
      });
      const data = await response.json();
      setLoopState(data);
    } catch (error) {
      console.error("Error updating loop mode:", error);
    } finally {
      setLoading(false);
    }
  };

  const switchMode = async (newMode: Mode) => {
    setLoading(true);
    try {
      if (newMode === "simple") {
        await updateSimpleMode({ mode: "simple" });
      } else {
        await updateLoopMode({ mode: "loop" });
      }
      setMode(newMode);
    } catch (error) {
      console.error("Error switching mode:", error);
    } finally {
      setLoading(false);
    }
  };

  const addColorToLoop = () => {
    const newColors = [...loopState.colors, "#FFFFFF"];
    updateLoopMode({ colors: newColors });
  };

  const removeColorFromLoop = (index: number) => {
    const newColors = loopState.colors.filter((_, i) => i !== index);
    updateLoopMode({ colors: newColors });
  };

  const updateLoopColor = (index: number, color: string) => {
    const newColors = [...loopState.colors];
    newColors[index] = color;
    updateLoopMode({ colors: newColors });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex flex-col items-center gap-8 px-8 py-12 max-w-2xl w-full">
        <h1 className="text-4xl font-semibold text-black dark:text-zinc-50">
          Control LED
        </h1>

        {/* Mode Selector */}
        <div className="flex gap-4 w-full">
          <button
            onClick={() => switchMode("simple")}
            disabled={loading}
            className={`flex-1 h-12 rounded-full px-6 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${mode === "simple"
              ? "bg-foreground text-background"
              : "border border-solid border-black/[.08] dark:border-white/[.145] hover:bg-black/[.04] dark:hover:bg-[#1a1a1a]"
              }`}
          >
            Simple
          </button>
          <button
            onClick={() => switchMode("loop")}
            disabled={loading}
            className={`flex-1 h-12 rounded-full px-6 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${mode === "loop"
              ? "bg-foreground text-background"
              : "border border-solid border-black/[.08] dark:border-white/[.145] hover:bg-black/[.04] dark:hover:bg-[#1a1a1a]"
              }`}
          >
            Loop
          </button>
        </div>

        {/* Simple Mode Controls */}
        {mode === "simple" && (
          <div className="flex flex-col gap-6 w-full">
            <div className="flex items-center gap-4">
              <label className="text-lg font-medium text-black dark:text-zinc-50">
                On/Off:
              </label>
              <button
                onClick={() => updateSimpleMode({ on: !simpleState.on })}
                disabled={loading}
                className={`h-12 w-24 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${simpleState.on
                  ? "bg-foreground text-background"
                  : "border border-solid border-black/[.08] dark:border-white/[.145]"
                  }`}
              >
                {simpleState.on ? "ON" : "OFF"}
              </button>
            </div>

            <div className="flex items-center gap-4">
              <label className="text-lg font-medium text-black dark:text-zinc-50">
                Color:
              </label>
              <input
                type="color"
                value={simpleState.color}
                onChange={(e) => updateSimpleMode({ color: e.target.value })}
                disabled={loading}
                className="h-12 w-24 rounded cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>
          </div>
        )}

        {/* Loop Mode Controls */}
        {mode === "loop" && (
          <div className="flex flex-col gap-6 w-full">
            <div className="flex items-center gap-4">
              <label className="text-lg font-medium text-black dark:text-zinc-50">
                Delay (ms):
              </label>
              <input
                type="number"
                value={loopState.delay}
                onChange={(e) =>
                  updateLoopMode({ delay: parseInt(e.target.value) || 1000 })
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
                {loopState.colors.map((color, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <input
                      type="color"
                      value={color}
                      onChange={(e) =>
                        updateLoopColor(index, e.target.value)
                      }
                      disabled={loading}
                      className="h-12 w-24 rounded cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                    <button
                      onClick={() => removeColorFromLoop(index)}
                      disabled={loading || loopState.colors.length <= 1}
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
          </div>
        )}
      </main>
    </div>
  );
}
