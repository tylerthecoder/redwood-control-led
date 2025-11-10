// Global variable to store the LED control state
import { getLedState, updateState } from "./state";

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
async function handleSimpleMode(body: RequestBody): Promise<void> {
    const currentState = getLedState();
    const currentSimple = currentState.mode === "simple" ? currentState : DEFAULTS.simple;
    await updateState({
        mode: "simple",
        on: body.on ?? currentSimple.on,
        color: body.color || currentSimple.color,
    });
}

async function handleLoopMode(body: RequestBody): Promise<void> {
    const currentState = getLedState();
    const currentLoop = currentState.mode === "loop" ? currentState : DEFAULTS.loop;
    await updateState({
        mode: "loop",
        colors: body.colors || currentLoop.colors,
        delay: body.delay ?? currentLoop.delay,
    });
}

async function handleScriptMode(body: RequestBody): Promise<Response | null> {
    const currentState = getLedState();

    if (body.frames) {
        // Validate and process frames
        const validation = validateFormat(body.frames);
        if (!validation.valid) {
            return Response.json(
                { success: false, error: validation.error },
                { status: 400 }
            );
        }

        const framerate = body.framerate ?? (currentState.mode === "script" ? currentState.framerate : DEFAULTS.script.framerate);
        const buffers = processFormatFrames(body.frames, framerate);

        await updateState({
            mode: "script",
            buffers,
            framerate,
            totalBuffers: buffers.length,
        });
    } else if (currentState.mode === "script") {
        // Update framerate only
        await updateState({
            ...currentState,
            framerate: body.framerate ?? currentState.framerate,
        });
    } else {
        // Initialize with empty buffers
        await updateState({
            mode: "script",
            buffers: [],
            framerate: body.framerate ?? DEFAULTS.script.framerate,
            totalBuffers: 0,
        });
    }
    return null; // Success
}

async function handlePartialUpdate(body: RequestBody): Promise<void> {
    // Handle partial updates for simple mode when no mode is specified
    const currentState = getLedState();
    if (currentState.mode === "simple") {
        if (body.on !== undefined || body.color !== undefined) {
            await updateState({
                ...currentState,
                on: body.on ?? currentState.on,
                color: body.color || currentState.color,
            });
        }
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();

        // Route to appropriate handler based on mode
        if (body.mode === "simple") {
            await handleSimpleMode(body);
        } else if (body.mode === "loop") {
            await handleLoopMode(body);
        } else if (body.mode === "script") {
            const errorResponse = await handleScriptMode(body);
            if (errorResponse) return errorResponse;
        } else if (body.on !== undefined || body.color !== undefined) {
            // Partial update for simple mode
            await handlePartialUpdate(body);
        }

        const currentState = getLedState();
        return Response.json({
            success: true,
            ...currentState,
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
    // For script mode, only return mode and framerate (buffer control is on server)
    const currentState = getLedState();

    if (currentState.mode === "script") {
        return Response.json({
            mode: "script",
            framerate: currentState.framerate,
        });
    }

    return Response.json(currentState);
}
