// Global variable to store the LED control state
interface SimpleMode {
    mode: "simple";
    on: boolean;
    color: string; // hex color
}

interface LoopMode {
    mode: "loop";
    colors: string[]; // array of hex colors
    delay: number; // delay in milliseconds
}

interface FormatMode {
    mode: "format";
    frames: string[]; // array of frame strings, each frame has 60 comma-separated hex colors
    framerate: number; // frames per second, default 60
}

type LedState = SimpleMode | LoopMode | FormatMode;

let ledState: LedState = {
    mode: "simple",
    on: false,
    color: "#0000FF", // default blue
};

// Validate format: each frame should have exactly 60 comma-separated hex colors
function validateFormat(frames: string[]): { valid: boolean; error?: string } {
    const hexColorRegex = /^#[0-9A-Fa-f]{6}$/;
    const NUM_LEDS = 60;

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
            ledState = {
                mode: "simple",
                on: body.on !== undefined ? body.on : (ledState.mode === "simple" ? ledState.on : false),
                color: body.color || (ledState.mode === "simple" ? ledState.color : "#0000FF"),
            };
        } else if (body.mode === "loop") {
            ledState = {
                mode: "loop",
                colors: body.colors || (ledState.mode === "loop" ? ledState.colors : ["#FF0000", "#00FF00", "#0000FF"]),
                delay: body.delay !== undefined ? body.delay : (ledState.mode === "loop" ? ledState.delay : 1000),
            };
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
            }

            ledState = {
                mode: "format",
                frames: body.frames || (ledState.mode === "format" ? ledState.frames : []),
                framerate: body.framerate !== undefined ? body.framerate : (ledState.mode === "format" ? ledState.framerate : 60),
            };
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
    return Response.json(ledState);
}
