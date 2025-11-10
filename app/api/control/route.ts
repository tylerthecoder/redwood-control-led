// Global variable to store the LED control state
import { ledState, updateState } from "./state";

const BUFFER_DURATION_SECONDS = 0.5; // 0.5 second buffers to reduce JSON size (~16KB vs ~32KB)
const NUM_LEDS = 60;

// Default values for each mode
const DEFAULTS = {
    simple: { on: false, color: "#0000FF" },
    loop: { colors: ["#FF0000", "#00FF00", "#0000FF"] as string[], delay: 1000 },
    script: { framerate: 60 },
};

// Convert hex color string to 24-bit RGB number
function hexToNumber(hex: string): number {
    const cleaned = hex.replace("#", "");
    if (cleaned.length !== 6) return 0;
    return parseInt(cleaned, 16);
}


// Convert frames from hex strings to numeric format and split into buffers
function processFormatFrames(frames: string[], framerate: number): number[][] {
    const framesPerBuffer = Math.floor(framerate * BUFFER_DURATION_SECONDS);
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

// Request body types
interface RequestBody {
    mode?: string;
    on?: boolean;
    color?: string;
    colors?: string[];
    delay?: number;
    frames?: string[];
    framerate?: number;
}

// Mode-specific handlers
function handleSimpleMode(body: RequestBody): void {
    const currentSimple = ledState.mode === "simple" ? ledState : DEFAULTS.simple;
    updateState({
        mode: "simple",
        on: body.on ?? currentSimple.on,
        color: body.color || currentSimple.color,
    });
}

function handleLoopMode(body: RequestBody): void {
    const currentLoop = ledState.mode === "loop" ? ledState : DEFAULTS.loop;
    updateState({
        mode: "loop",
        colors: body.colors || currentLoop.colors,
        delay: body.delay ?? currentLoop.delay,
    });
}

async function handleScriptMode(body: RequestBody): Promise<Response | null> {
    if (body.frames) {
        // Validate and process frames
        const validation = validateFormat(body.frames);
        if (!validation.valid) {
            return Response.json(
                { success: false, error: validation.error },
                { status: 400 }
            );
        }

        const framerate = body.framerate ?? (ledState.mode === "script" ? ledState.framerate : DEFAULTS.script.framerate);
        const buffers = processFormatFrames(body.frames, framerate);

        updateState({
            mode: "script",
            buffers,
            framerate,
        });
    } else if (ledState.mode === "script") {
        // Update framerate only
        updateState({
            ...ledState,
            framerate: body.framerate ?? ledState.framerate,
        });
    } else {
        // Initialize with empty buffers
        updateState({
            mode: "script",
            buffers: [],
            framerate: body.framerate ?? DEFAULTS.script.framerate,
        });
    }
    return null; // Success
}

function handlePartialUpdate(body: RequestBody): void {
    // Handle partial updates for simple mode when no mode is specified
    if (ledState.mode === "simple") {
        if (body.on !== undefined || body.color !== undefined) {
            updateState({
                ...ledState,
                on: body.on ?? ledState.on,
                color: body.color || ledState.color,
            });
        }
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();

        // Route to appropriate handler based on mode
        if (body.mode === "simple") {
            handleSimpleMode(body);
        } else if (body.mode === "loop") {
            handleLoopMode(body);
        } else if (body.mode === "script") {
            const errorResponse = await handleScriptMode(body);
            if (errorResponse) return errorResponse;
        } else if (body.on !== undefined || body.color !== undefined) {
            // Partial update for simple mode
            handlePartialUpdate(body);
        }

        return Response.json({
            success: true,
            ...ledState,
        });
    } catch {
        // Handle JSON parsing errors or other request errors
        return Response.json({
            success: false,
            error: "Failed to process request: invalid JSON or malformed data"
        }, { status: 400 });
    }
}

export async function GET() {
    // Return current LED state with mode
    // For script mode, only return mode, totalBuffers, and framerate (no buffers)
    if (ledState.mode === "script") {
        const scriptState = ledState;
        return Response.json({
            mode: "script",
            totalBuffers: scriptState.buffers.length,
            framerate: scriptState.framerate,
        });
    }

    return Response.json(ledState);
}
