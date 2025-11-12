import { SimpleMode, LoopMode, ScriptMode, ClaudeMode, LedState, LEDStateData, ArduinoState } from "./model";
import { getDatabaseConnection } from "@/app/lib/storage";
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
    } else if (mode === "claude") {
        return {
            mode: "claude",
        } as ClaudeMode;
    }

    // Fallback to default
    return DEFAULT_LED_STATE;
}

export async function saveLEDState(mode: string, data: Record<string, unknown>): Promise<void> {
    const timestamp = new Date().toISOString();

    console.log("[STORAGE:DEBUG] Saving LED state to database:", mode, data);

    const sql = await getDatabaseConnection();

    try {
        await sql`
            UPDATE led_state
            SET mode = ${mode},
                data = ${JSON.stringify(data)}::jsonb,
                updated_at = ${timestamp}::timestamp
            WHERE id = 1
        `;
        console.log("[STORAGE:DEBUG] ✅ Saved LED state to database");
    } catch (error) {
        console.error("[STORAGE:DEBUG] ❌ Failed to save LED state to database:", error);
        throw new Error(`Failed to save LED state: ${error instanceof Error ? error.message : String(error)}`);
    }
}

export async function getLEDState(): Promise<LEDStateData | null> {
    const sql = await getDatabaseConnection();

    try {
        const result = await sql`
            SELECT mode, data, updated_at
            FROM led_state
            WHERE id = 1
        `;

        if (result.length === 0) {
            console.log("[STORAGE:DEBUG] No LED state found in database");
            return null;
        }

        const row = result[0];
        const data: LEDStateData = {
            mode: row.mode as string,
            data: row.data as Record<string, unknown>,
            timestamp: row.updated_at as string,
        };

        console.log("[STORAGE:DEBUG] ✅ Loaded LED state from database");
        return data;
    } catch (error) {
        console.error("[STORAGE:DEBUG] ❌ Failed to read LED state from database:", error);
        throw new Error(`Failed to get LED state: ${error instanceof Error ? error.message : String(error)}`);
    }
}

// Convenience functions that work with LedState directly
export async function saveLEDStateFromState(state: LedState): Promise<void> {
    const { mode, data } = serializeLEDState(state);
    await saveLEDState(mode, data);
}

export async function getLEDStateAsState(): Promise<LedState> {
    const stored = await getLEDState();

    if (!stored) {
        console.log("[STORAGE:DEBUG] No stored LED state found, returning default");
        return DEFAULT_LED_STATE;
    }

    return deserializeLEDState(stored.mode, stored.data);
}

export async function getArduinoState(): Promise<ArduinoState> {
    const stored = await getLEDStateAsState();
    console.log("[STORAGE:DEBUG] Stored LED state:", stored);

    if (!stored) {
        console.log("[STORAGE:DEBUG] No stored LED state found, returning default");
        return DEFAULT_LED_STATE;
    }

    if (stored.mode === "script" || stored.mode === "claude") {
        return {
            mode: "script",
            framerate: 60,
        };
    }

    return stored as ArduinoState;
}
