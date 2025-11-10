"use client";

import { useEffect, useRef, useState } from "react";

interface LEDPreviewModalProps {
    frames: string[];
    framerate: number;
    isOpen: boolean;
    onClose: () => void;
}

export default function LEDPreviewModal({
    frames,
    framerate,
    isOpen,
    onClose,
}: LEDPreviewModalProps) {
    const [currentFrame, setCurrentFrame] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const animationRef = useRef<number | null>(null);
    const lastFrameTimeRef = useRef<number>(0);

    const NUM_LEDS = 60;
    const CANVAS_SIZE = 500;
    const CENTER_X = CANVAS_SIZE / 2;
    const CENTER_Y = CANVAS_SIZE / 2;
    const RING_RADIUS = 200;
    const LED_RADIUS = 12;

    // Parse a frame string into an array of colors
    const parseFrame = (frameString: string): string[] => {
        return frameString.split(",").map((c) => c.trim());
    };

    // Draw the LED ring
    const drawLEDs = (colors: string[]) => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        // Clear canvas
        ctx.fillStyle = "#000000";
        ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

        // Draw each LED
        for (let i = 0; i < NUM_LEDS; i++) {
            // Calculate position (start at top, go clockwise)
            const angle = (i / NUM_LEDS) * Math.PI * 2 - Math.PI / 2;
            const x = CENTER_X + Math.cos(angle) * RING_RADIUS;
            const y = CENTER_Y + Math.sin(angle) * RING_RADIUS;

            // Get color (with fallback to black)
            const color = colors[i] || "#000000";

            // Draw LED
            ctx.beginPath();
            ctx.arc(x, y, LED_RADIUS, 0, Math.PI * 2);
            ctx.fillStyle = color;
            ctx.fill();

            // Add a subtle border
            ctx.strokeStyle = "#333333";
            ctx.lineWidth = 1;
            ctx.stroke();

            // Add glow effect for non-black LEDs
            if (color !== "#000000") {
                ctx.shadowBlur = 15;
                ctx.shadowColor = color;
                ctx.beginPath();
                ctx.arc(x, y, LED_RADIUS, 0, Math.PI * 2);
                ctx.fillStyle = color;
                ctx.fill();
                ctx.shadowBlur = 0;
            }
        }

        // Draw center text
        ctx.fillStyle = "#888888";
        ctx.font = "14px monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(`Frame ${currentFrame + 1}/${frames.length}`, CENTER_X, CENTER_Y);
        ctx.fillText(`${framerate} FPS`, CENTER_X, CENTER_Y + 20);
    };

    // Animation loop
    useEffect(() => {
        if (!isPlaying || frames.length === 0) return;

        const frameDelay = 1000 / framerate;

        const animate = (timestamp: number) => {
            if (!lastFrameTimeRef.current) {
                lastFrameTimeRef.current = timestamp;
            }

            const elapsed = timestamp - lastFrameTimeRef.current;

            if (elapsed >= frameDelay) {
                setCurrentFrame((prev) => (prev + 1) % frames.length);
                lastFrameTimeRef.current = timestamp;
            }

            animationRef.current = requestAnimationFrame(animate);
        };

        animationRef.current = requestAnimationFrame(animate);

        return () => {
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
            }
        };
    }, [isPlaying, framerate, frames.length]);

    // Draw current frame
    useEffect(() => {
        if (frames.length > 0 && currentFrame < frames.length) {
            const colors = parseFrame(frames[currentFrame]);
            drawLEDs(colors);
        }
    }, [currentFrame, frames]);

    // Handle play/pause
    const togglePlayPause = () => {
        setIsPlaying(!isPlaying);
        lastFrameTimeRef.current = 0;
    };

    // Step forward
    const stepForward = () => {
        setIsPlaying(false);
        setCurrentFrame((prev) => (prev + 1) % frames.length);
    };

    // Step backward
    const stepBackward = () => {
        setIsPlaying(false);
        setCurrentFrame((prev) => (prev - 1 + frames.length) % frames.length);
    };

    // Jump to frame
    const jumpToFrame = (frameIndex: number) => {
        setIsPlaying(false);
        setCurrentFrame(frameIndex);
    };

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={onClose}
        >
            <div
                className="bg-white dark:bg-zinc-900 rounded-lg shadow-xl max-w-2xl w-full p-6"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-2xl font-semibold text-black dark:text-zinc-50">
                        Animation Preview
                    </h2>
                    <button
                        onClick={onClose}
                        className="text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 text-2xl font-bold"
                    >
                        ×
                    </button>
                </div>

                {frames.length === 0 ? (
                    <div className="text-center py-12 text-zinc-500">
                        No frames to preview. Enter animation data first.
                    </div>
                ) : (
                    <>
                        {/* Canvas */}
                        <div className="flex justify-center mb-4">
                            <canvas
                                ref={canvasRef}
                                width={CANVAS_SIZE}
                                height={CANVAS_SIZE}
                                className="border border-zinc-200 dark:border-zinc-800 rounded"
                                style={{ maxWidth: "100%" }}
                            />
                        </div>

                        {/* Controls */}
                        <div className="flex flex-col gap-4">
                            {/* Playback controls */}
                            <div className="flex justify-center gap-2">
                                <button
                                    onClick={stepBackward}
                                    className="px-4 py-2 bg-zinc-200 dark:bg-zinc-800 text-black dark:text-zinc-50 rounded hover:bg-zinc-300 dark:hover:bg-zinc-700 transition-colors"
                                >
                                    ← Prev
                                </button>
                                <button
                                    onClick={togglePlayPause}
                                    className="px-6 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors font-semibold"
                                >
                                    {isPlaying ? "⏸ Pause" : "▶ Play"}
                                </button>
                                <button
                                    onClick={stepForward}
                                    className="px-4 py-2 bg-zinc-200 dark:bg-zinc-800 text-black dark:text-zinc-50 rounded hover:bg-zinc-300 dark:hover:bg-zinc-700 transition-colors"
                                >
                                    Next →
                                </button>
                            </div>

                            {/* Frame scrubber */}
                            <div className="flex flex-col gap-2">
                                <input
                                    type="range"
                                    min="0"
                                    max={frames.length - 1}
                                    value={currentFrame}
                                    onChange={(e) => jumpToFrame(parseInt(e.target.value))}
                                    className="w-full"
                                />
                                <div className="flex justify-between text-sm text-zinc-600 dark:text-zinc-400">
                                    <span>Frame {currentFrame + 1}</span>
                                    <span>
                                        {((currentFrame / frames.length) * 100).toFixed(1)}%
                                    </span>
                                    <span>{frames.length} total</span>
                                </div>
                            </div>

                            {/* Info */}
                            <div className="text-center text-sm text-zinc-600 dark:text-zinc-400">
                                {framerate} FPS • Duration:{" "}
                                {(frames.length / framerate).toFixed(2)}s
                                {frames.length > 1 && " (loops)"}
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

