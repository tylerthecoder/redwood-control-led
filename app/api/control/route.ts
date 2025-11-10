// Global variable to store the LED control state
import { ledState, updateState, type LedState } from "./state";

const BUFFER_DURATION_SECONDS = 0.5; // 0.5 second buffers to reduce JSON size (~16KB vs ~32KB)
const NUM_LEDS = 60;

// Convert hex color string to 24-bit RGB number
function hexToNumber(hex: string): number {
    const cleaned = hex.replace("#", "");
    if (cleaned.length !== 6) return 0;
    return parseInt(cleaned, 16);
}

// Convert 24-bit RGB number to hex string (for display purposes)
function numberToHex(num: number): string {
    return `#${num.toString(16).padStart(6, "0").toUpperCase()}`;
}

// Convert frames from hex strings to numeric format and split into buffers
function processFormatFrames(frames: string[], framerate: number): number[][] {
    const framesPerBuffer = framerate * BUFFER_DURATION_SECONDS;
    const buffers: number[][] = [];

    for (let i = 0; i < frames.length; i += framesPerBuffer) {
        const buffer: number[] = [];
        const bufferFrames = frames.slice(i, i + framesPerBuffer);

        for (const frame of bufferFrames) {
            const colors = frame.split(/[,\s]+/).filter(c => c.trim());
            for (const color of colors) {
                buffer.push(hexToNumber(color));
            }
        }

        buffers.push(buffer);
    }

    return buffers;
}

// Validate format: each frame should have exactly 60 comma-separated hex colors
function validateFormat(frames: string[]): { valid: boolean; error?: string } {
    const hexColorRegex = /^#[0-9A-Fa-f]{6}$/;

    if (!Array.isArray(frames) || frames.length === 0) {
        return { valid: false, error: "Frames must be a non-empty array" };
    }

    for (let i = 0; i < frames.length; i++) {
        const frame = frames[i].trim();
        if (!frame) {
            return { valid: false, error: `Frame ${i + 1} is empty` };
        }

        // Split by comma or space
        const colors = frame.split(/[,\s]+/).filter(c => c.trim());

        if (colors.length !== NUM_LEDS) {
            return {
                valid: false,
                error: `Frame ${i + 1} has ${colors.length} colors, expected ${NUM_LEDS}`
            };
        }

        for (let j = 0; j < colors.length; j++) {
            const color = colors[j].trim();
            if (!hexColorRegex.test(color)) {
                return {
                    valid: false,
                    error: `Frame ${i + 1}, LED ${j + 1}: Invalid hex color "${color}"`
                };
            }
        }
    }

    return { valid: true };
}

export async function POST(request: Request) {
    try {
        const body = await request.json();

        // Update mode if provided
        if (body.mode === "simple") {
            updateState({
                mode: "simple",
                on: body.on !== undefined ? body.on : (ledState.mode === "simple" ? ledState.on : false),
                color: body.color || (ledState.mode === "simple" ? ledState.color : "#0000FF"),
            });
        } else if (body.mode === "loop") {
            updateState({
                mode: "loop",
                colors: body.colors || (ledState.mode === "loop" ? ledState.colors : ["#FF0000", "#00FF00", "#0000FF"]),
                delay: body.delay !== undefined ? body.delay : (ledState.mode === "loop" ? ledState.delay : 1000),
            });
        } else if (body.mode === "custom") {
            // Validate format if frames are provided
            if (body.frames) {
                const validation = validateFormat(body.frames);
                if (!validation.valid) {
                    return Response.json(
                        { success: false, error: validation.error },
                        { status: 400 }
                    );
                }

                // Process frames into buffers
                const framerate = body.framerate !== undefined ? body.framerate : (ledState.mode === "custom" ? ledState.framerate : 60);
                const buffers = processFormatFrames(body.frames, framerate);

                updateState({
                    mode: "custom",
                    buffers,
                    framerate,
                    currentBufferIndex: 0,
                });
            } else {
                // Just update framerate or other properties
                if (ledState.mode === "custom") {
                    updateState({
                        ...ledState,
                        framerate: body.framerate !== undefined ? body.framerate : ledState.framerate,
                    });
                } else {
                    updateState({
                        mode: "custom",
                        buffers: [],
                        framerate: body.framerate !== undefined ? body.framerate : 60,
                        currentBufferIndex: 0,
                    });
                }
            }
        } else if (ledState.mode === "simple" && body.on !== undefined) {
            // Just toggle on/off for simple mode
            updateState({
                ...ledState,
                on: body.on,
            });
        } else if (ledState.mode === "simple" && body.color !== undefined) {
            // Just update color for simple mode
            updateState({
                ...ledState,
                color: body.color,
            });
        }

        return Response.json({
            success: true,
            ...ledState,
        });
    } catch {
        // If no body, just return current state
        return Response.json({
            success: true,
            ...ledState,
        });
    }
}

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const bufferIndexParam = searchParams.get("bufferIndex");

    // Return current LED state with mode
    // For custom mode, return specific buffer if bufferIndex is provided
    if (ledState.mode === "custom") {
        const customState = ledState;
        const totalBuffers = customState.buffers.length;

        if (bufferIndexParam !== null) {
            // Return specific buffer requested by Arduino
            const requestedIndex = parseInt(bufferIndexParam, 10);
            if (!isNaN(requestedIndex) && requestedIndex >= 0 && requestedIndex < totalBuffers) {
                const requestedBuffer = customState.buffers[requestedIndex] || [];
                return Response.json({
                    mode: "custom",
                    buffer: requestedBuffer,
                    bufferIndex: requestedIndex,
                    totalBuffers: totalBuffers,
                    framerate: customState.framerate,
                });
            } else {
                return Response.json(
                    { error: `Invalid bufferIndex: ${bufferIndexParam}. Must be between 0 and ${totalBuffers - 1}` },
                    { status: 400 }
                );
            }
        }

        // No bufferIndex specified, return current buffer info (don't include all buffers)
        const currentBuffer = customState.buffers[customState.currentBufferIndex] || [];
        return Response.json({
            mode: "custom",
            currentBuffer,
            currentBufferIndex: customState.currentBufferIndex,
            totalBuffers: totalBuffers,
            framerate: customState.framerate,
        });
    }

    return Response.json(ledState);
}
