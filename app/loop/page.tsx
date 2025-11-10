"use client";

import { useState } from "react";
import { loopPresets, type LoopPreset } from "../examples";
import { useLEDState } from "../hooks/use-led-state";

export default function LoopPage() {
  const { loading, updateState } = useLEDState();
  const [colors, setColors] = useState<string[]>(["#FF0000", "#00FF00", "#0000FF"]);
  const [delay, setDelay] = useState(1000);
  const [selectedPreset, setSelectedPreset] = useState<LoopPreset | null>(null);
  const [showCustomize, setShowCustomize] = useState(false);

  const applyPreset = (preset: LoopPreset) => {
    updateState({
      mode: "loop",
      colors: preset.colors,
      delay: preset.delay,
    });
    setColors(preset.colors);
    setDelay(preset.delay);
    setSelectedPreset(preset);
  };

  const addColor = () => {
    setColors([...colors, "#FFFFFF"]);
  };

  const removeColor = (index: number) => {
    if (colors.length > 1) {
      setColors(colors.filter((_, i) => i !== index));
    }
  };

  const updateColor = (index: number, color: string) => {
    const newColors = [...colors];
    newColors[index] = color;
    setColors(newColors);
  };

  const sendCustom = () => {
    updateState({
      mode: "loop",
      colors,
      delay,
    });
    setSelectedPreset(null);
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
            {loopPresets.map((preset, index) => (
              <div
                key={index}
                className={`p-4 rounded border border-solid transition-colors cursor-pointer ${selectedPreset === preset
                    ? "border-blue-500 bg-blue-50 dark:bg-blue-950"
                    : "border-black/[.08] dark:border-white/[.145] hover:bg-black/[.04] dark:hover:bg-[#1a1a1a]"
                  }`}
                onClick={() => applyPreset(preset)}
              >
                <div className="flex items-center gap-2 mb-2">
                  {preset.colors.slice(0, 5).map((c, i) => (
                    <div
                      key={i}
                      className="w-6 h-6 rounded-full border border-zinc-300 dark:border-zinc-600"
                      style={{ backgroundColor: c }}
                    />
                  ))}
                  {preset.colors.length > 5 && (
                    <span className="text-xs text-zinc-500">+{preset.colors.length - 5}</span>
                  )}
                </div>
                <h3 className="font-semibold text-black dark:text-zinc-50">
                  {preset.name}
                </h3>
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
                {loopPresets.map((preset, index) => (
                  <div
                    key={index}
                    className={`p-4 rounded border border-solid transition-colors cursor-pointer ${selectedPreset === preset
                        ? "border-blue-500 bg-blue-50 dark:bg-blue-950"
                        : "border-black/[.08] dark:border-white/[.145] hover:bg-black/[.04] dark:hover:bg-[#1a1a1a]"
                      }`}
                    onClick={() => applyPreset(preset)}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      {preset.colors.slice(0, 5).map((c, i) => (
                        <div
                          key={i}
                          className="w-6 h-6 rounded-full border border-zinc-300 dark:border-zinc-600"
                          style={{ backgroundColor: c }}
                        />
                      ))}
                      {preset.colors.length > 5 && (
                        <span className="text-xs text-zinc-500">+{preset.colors.length - 5}</span>
                      )}
                    </div>
                    <h3 className="font-semibold text-black dark:text-zinc-50">
                      {preset.name}
                    </h3>
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
                  Customize Loop
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
                  Loop mode cycles through a sequence of colors, setting all LEDs to the same color at once.
                  Choose your colors and set how long each one displays. Great for smooth color transitions!
                </p>

                <div className="flex flex-col gap-6">
                  <div className="flex items-center gap-4">
                    <label className="text-lg font-medium text-black dark:text-zinc-50 w-32">
                      Delay:
                    </label>
                    <input
                      type="number"
                      value={delay}
                      onChange={(e) => setDelay(parseInt(e.target.value) || 1000)}
                      disabled={loading}
                      min="100"
                      step="100"
                      className="h-12 px-4 rounded border border-solid border-black/[.08] dark:border-white/[.145] bg-white dark:bg-black text-black dark:text-zinc-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                    <span className="text-sm text-zinc-600 dark:text-zinc-400">ms</span>
                  </div>

                  <div className="flex flex-col gap-4">
                    <label className="text-lg font-medium text-black dark:text-zinc-50">
                      Colors:
                    </label>
                    <div className="flex flex-col gap-3">
                      {colors.map((color, index) => (
                        <div key={index} className="flex items-center gap-3">
                          <span className="text-sm text-zinc-600 dark:text-zinc-400 w-8">
                            {index + 1}.
                          </span>
                          <input
                            type="color"
                            value={color}
                            onChange={(e) => updateColor(index, e.target.value)}
                            disabled={loading}
                            className="h-12 w-24 rounded cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                          />
                          <span className="text-sm text-zinc-600 dark:text-zinc-400 font-mono flex-1">
                            {color}
                          </span>
                          <button
                            onClick={() => removeColor(index)}
                            disabled={loading || colors.length <= 1}
                            className="h-12 px-4 rounded border border-solid border-red-500 text-red-500 hover:bg-red-50 dark:hover:bg-red-950 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                    <button
                      onClick={addColor}
                      disabled={loading}
                      className="h-12 rounded-full border border-solid border-black/[.08] dark:border-white/[.145] hover:bg-black/[.04] dark:hover:bg-[#1a1a1a] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      + Add Color
                    </button>
                  </div>

                  <button
                    onClick={sendCustom}
                    disabled={loading}
                    className="h-12 rounded-full bg-foreground text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc] disabled:opacity-50 disabled:cursor-not-allowed mt-4"
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
