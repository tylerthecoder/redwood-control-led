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

interface CustomMode {
    mode: "custom";
    buffers: number[][];
    framerate: number;
}

export type LedState = SimpleMode | LoopMode | CustomMode;

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

// Export getter function to access state
export function getLedState(): LedState {
    return ledState;
}

// Export the state directly (for backward compatibility)
export { ledState };

