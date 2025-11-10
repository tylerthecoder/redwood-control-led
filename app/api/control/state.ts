// LED state management - uses store layer
import { saveLEDState, getLEDState } from "../../lib/store";
import type { LedState } from "../../lib/state";

// In-memory cache for quick access (still needed for synchronous reads)
let ledStateCache: LedState = {
    mode: "simple",
    on: false,
    color: "#0000FF",
};

// Initialize cache from storage on module load
let cacheInitialized = false;

async function initializeCache() {
    if (cacheInitialized) return;

    try {
        const stored = await getLEDState();
        ledStateCache = stored;
        console.log("[LED_STATE] Cache initialized from storage:", ledStateCache.mode);
    } catch (error) {
        console.error("[LED_STATE] Failed to initialize cache:", error);
    }

    cacheInitialized = true;
}

// Initialize cache (non-blocking)
initializeCache();

// Update state - saves to storage and updates cache
export async function updateState(newState: LedState) {
    ledStateCache = newState;
    await saveLEDState(newState);
    console.log("[LED_STATE] State updated and saved:", newState.mode);
}

// Get current state from cache (synchronous for compatibility)
export function getLedState(): LedState {
    return ledStateCache;
}

// Refresh cache from storage (useful after external updates)
export async function refreshState() {
    cacheInitialized = false;
    await initializeCache();
}
