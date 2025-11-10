"use client";

import { useState, useEffect } from "react";
import { examples, type Example } from "./examples";

type Mode = "simple" | "loop" | "format";

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

interface FormatMode {
  mode: "format";
  frames: string[];
  framerate: number;
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
  const [formatState, setFormatState] = useState<FormatMode>({
    mode: "format",
    frames: [],
    framerate: 60,
  });
  const [formatText, setFormatText] = useState("");
  const [formatError, setFormatError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedExample, setSelectedExample] = useState<Example | null>(null);
  const [showExamples, setShowExamples] = useState(false);

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
      } else if (data.mode === "format") {
        setMode("format");
        setFormatState(data);
        setFormatText(data.frames.join("\n"));
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

  const updateFormatMode = async (updates: Partial<FormatMode>) => {
    setLoading(true);
    setFormatError(null);
    try {
      const newState = { ...formatState, ...updates };
      const response = await fetch("/api/control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newState),
      });
      const data = await response.json();
      if (data.error) {
        setFormatError(data.error);
      } else {
        setFormatState(data);
        setFormatText(data.frames.join("\n"));
      }
    } catch (error) {
      console.error("Error updating format mode:", error);
      setFormatError("Failed to update format");
    } finally {
      setLoading(false);
    }
  };

  const handleFormatTextChange = (text: string) => {
    setFormatText(text);
    setFormatError(null);
  };

  const saveFormat = () => {
    const frames = formatText
      .split("\n")
      .map(line => line.trim())
      .filter(line => line.length > 0);

    updateFormatMode({ frames });
  };

  const loadExample = (example: Example) => {
    const frames = example.generate();
    setFormatText(frames.join("\n"));
    setSelectedExample(example);
    setFormatError(null);
    // Switch to format mode if not already
    if (mode !== "format") {
      switchMode("format");
    }
  };

  const sendExampleToArduino = async (example: Example) => {
    setLoading(true);
    setFormatError(null);
    try {
      const frames = example.generate();
      await updateFormatMode({
        frames,
        framerate: example.framerate
      });
      setSelectedExample(example);
    } catch (error) {
      console.error("Error sending example:", error);
      setFormatError("Failed to send example to Arduino");
    } finally {
      setLoading(false);
    }
  };

  const switchMode = async (newMode: Mode) => {
    setLoading(true);
    setFormatError(null);
    try {
      if (newMode === "simple") {
        await updateSimpleMode({ mode: "simple" });
      } else if (newMode === "loop") {
        await updateLoopMode({ mode: "loop" });
      } else if (newMode === "format") {
        await updateFormatMode({ mode: "format" });
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
          <button
            onClick={() => switchMode("format")}
            disabled={loading}
            className={`flex-1 h-12 rounded-full px-6 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${mode === "format"
              ? "bg-foreground text-background"
              : "border border-solid border-black/[.08] dark:border-white/[.145] hover:bg-black/[.04] dark:hover:bg-[#1a1a1a]"
              }`}
          >
            Format
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

        {/* Format Mode Controls */}
        {mode === "format" && (
          <div className="flex flex-col gap-6 w-full">
            <div className="flex items-center gap-4">
              <label className="text-lg font-medium text-black dark:text-zinc-50">
                Framerate (fps):
              </label>
              <input
                type="number"
                value={formatState.framerate}
                onChange={(e) =>
                  updateFormatMode({ framerate: parseInt(e.target.value) || 60 })
                }
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
                      onClick={() => setSelectedExample(example === selectedExample ? null : example)}
                    >
                      <div className="flex items-start justify-between gap-4 mb-2">
                        <div className="flex-1">
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
                        <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => loadExample(example)}
                            disabled={loading}
                            className="h-8 px-3 rounded border border-solid border-black/[.08] dark:border-white/[.145] hover:bg-black/[.04] dark:hover:bg-[#1a1a1a] transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                          >
                            Load
                          </button>
                          <button
                            onClick={() => sendExampleToArduino(example)}
                            disabled={loading}
                            className="h-8 px-3 rounded bg-foreground text-background hover:bg-[#383838] dark:hover:bg-[#ccc] transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                          >
                            Send to Arduino
                          </button>
                        </div>
                      </div>
                      {selectedExample === example && (
                        <div className="mt-3 p-3 rounded bg-black/[.02] dark:bg-white/[.02] max-h-32 overflow-auto">
                          <pre className="text-xs font-mono text-zinc-600 dark:text-zinc-400 whitespace-pre-wrap break-all">
                            {example.generate().slice(0, 3).join("\n")}
                            {example.generate().length > 3 && "\n..."}
                          </pre>
                        </div>
                      )}
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
                onChange={(e) => handleFormatTextChange(e.target.value)}
                disabled={loading}
                rows={15}
                className="w-full px-4 py-3 rounded border border-solid border-black/[.08] dark:border-white/[.145] bg-white dark:bg-black text-black dark:text-zinc-50 font-mono text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                placeholder="#FF0000,#FF0000,...,#00FF00 (60 colors per line)"
              />
              {formatError && (
                <div className="text-red-500 text-sm">
                  {formatError}
                </div>
              )}
              <button
                onClick={saveFormat}
                disabled={loading || !formatText.trim()}
                className="h-12 rounded-full bg-foreground text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Save Format
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
