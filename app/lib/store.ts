// Store layer - Read/write operations for application state
import { saveLEDState as saveToStorage, getLEDState as getFromStorage } from "./storage";
import { saveClaudeFrames as saveClaudeToStorage, getClaudeFrames as getClaudeFromStorage } from "./storage";
import type { LedState, ClaudeFrameData, SimpleMode, LoopMode, ScriptMode } from "./state";

// ============================================================================
// LED STATE STORE
// ============================================================================

// Default LED state
const DEFAULT_LED_STATE: SimpleMode = {
    mode: "simple",
    on: false,
    color: "#0000FF",
};

// Serialize LED state to storage format
function serializeLEDState(state: LedState): { mode: string; data: Record<string, unknown> } {
    const { mode, ...data } = state;
    return { mode, data };
}

// Deserialize storage format to LED state
function deserializeLEDState(mode: string, data: Record<string, unknown>): LedState {
    if (mode === "simple") {
        return {
            mode: "simple",
            on: data.on as boolean,
            color: data.color as string,
        } as SimpleMode;
    } else if (mode === "loop") {
        return {
            mode: "loop",
            colors: data.colors as string[],
            delay: data.delay as number,
        } as LoopMode;
    } else if (mode === "script") {
        return {
            mode: "script",
            framerate: data.framerate as number,
            buffers: data.buffers as number[][],
            totalBuffers: data.totalBuffers as number,
        } as ScriptMode;
    }

    // Fallback to default
    return DEFAULT_LED_STATE;
}

export async function saveLEDState(state: LedState): Promise<void> {
    const { mode, data } = serializeLEDState(state);
    await saveToStorage(mode, data);
}

export async function getLEDState(): Promise<LedState> {
    const stored = await getFromStorage();

    if (!stored) {
        console.log("[STORE] No stored LED state found, returning default");
        return DEFAULT_LED_STATE;
    }

    return deserializeLEDState(stored.mode, stored.data);
}

// ============================================================================
// CLAUDE FRAMES STORE
// ============================================================================

export async function saveClaudeFrames(
    frames: string[],
    reasoning: string,
    pythonCode: string
): Promise<void> {
    await saveClaudeToStorage(frames, reasoning, pythonCode);
}

export async function getClaudeFrames(): Promise<ClaudeFrameData | null> {
    return await getClaudeFromStorage();
}

