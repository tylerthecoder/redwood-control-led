// Global variable to store the LED control state
import { ledState, updateState, type LedState } from "./state";

const BUFFER_DURATION_SECONDS = 10;
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
        } else if (body.mode === "format") {
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
                const framerate = body.framerate !== undefined ? body.framerate : (ledState.mode === "format" ? ledState.framerate : 60);
                const buffers = processFormatFrames(body.frames, framerate);

                updateState({
                    mode: "format",
                    buffers,
                    framerate,
                    currentBufferIndex: 0,
                });
            } else {
                // Just update framerate or other properties
                if (ledState.mode === "format") {
                    ledState.framerate = body.framerate !== undefined ? body.framerate : ledState.framerate;
                } else {
                    updateState({
                        mode: "format",
                        buffers: [],
                        framerate: body.framerate !== undefined ? body.framerate : 60,
                        currentBufferIndex: 0,
                    });
                }
            }
        } else if (ledState.mode === "simple" && body.on !== undefined) {
            // Just toggle on/off for simple mode
            ledState.on = body.on;
        } else if (ledState.mode === "simple" && body.color !== undefined) {
            // Just update color for simple mode
            ledState.color = body.color;
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

export async function GET() {
    // Return current LED state with mode
    // For format mode, return current buffer and next buffer
    if (ledState.mode === "format") {
        const formatState = ledState;
        const currentBuffer = formatState.buffers[formatState.currentBufferIndex] || [];
        const nextBufferIndex = (formatState.currentBufferIndex + 1) % formatState.buffers.length;
        const nextBuffer = formatState.buffers[nextBufferIndex] || [];

        return Response.json({
            ...formatState,
            currentBuffer,
            nextBuffer,
            currentBufferIndex: formatState.currentBufferIndex,
            totalBuffers: formatState.buffers.length,
        });
    }

    return Response.json(ledState);
}
