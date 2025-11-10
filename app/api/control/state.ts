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

interface FormatMode {
    mode: "format";
    buffers: number[][];
    framerate: number;
    currentBufferIndex: number;
}

export type LedState = SimpleMode | LoopMode | FormatMode;

// Use a mutable object that can be reassigned
const state: { value: LedState } = {
    value: {
        mode: "simple",
        on: false,
        color: "#0000FF",
    },
};


export const ledState = new Proxy(state, {
    get(target, prop) {
        if (prop === "value") return target.value;
        return target.value[prop as keyof LedState];
    },
    set(target, prop, value) {
        if (prop === "value") {
            target.value = value;
            return true;
        }
        (target.value as unknown as Record<string, unknown>)[prop as string] = value;
        return true;
    },
}) as LedState & { value: LedState };

// Helper to update state
export function updateState(newState: LedState) {
    state.value = newState;
}

