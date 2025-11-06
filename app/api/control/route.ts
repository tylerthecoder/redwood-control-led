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

type LedState = SimpleMode | LoopMode;

let ledState: LedState = {
    mode: "simple",
    on: false,
    color: "#0000FF", // default blue
};

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
