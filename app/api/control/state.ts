// Shared state for LED control
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

interface ScriptMode {
    mode: "script";
    buffers: number[][];
    framerate: number;
}

export type LedState = SimpleMode | LoopMode | ScriptMode;

// Direct state variable
let ledState: LedState = {
    mode: "simple",
    on: false,
    color: "#0000FF",
};

// Helper to update state
export function updateState(newState: LedState) {
    ledState = newState;
}

// Export the state directly
export { ledState };

