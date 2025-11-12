// Type definitions for application state

// ============================================================================
// LED STATE TYPES
// ============================================================================

export interface SimpleMode {
    mode: "simple";
    on: boolean;
    color: string;
}

export interface LoopMode {
    mode: "loop";
    colors: string[];
    delay: number;
}

export interface ScriptMode {
    mode: "script";
    framerate: number;
    buffers: number[][];
    totalBuffers: number;
}

export interface ClaudeMode {
    mode: "claude";
}

export type LedState = SimpleMode | LoopMode | ScriptMode | ClaudeMode;

// what is sent to the arduino
export type ArduinoState = SimpleMode | LoopMode | { mode: "script", framerate: number };



// ============================================================================
// SCRIPT TYPES (Unified for both user and Claude scripts)
// ============================================================================

export interface Script {
    id: number;
    title: string;
    description: string;
    pythonCode: string;
    frames: string[];
    frameCount: number;
    framerate: number; // Frames per second for this script
    createdBy: "user" | "claude";
    reasoning?: string; // Only for Claude scripts
    isActive: boolean;
    timestamp: string;
}

// ============================================================================
// STORAGE TYPES (used by storage layer)
// ============================================================================

export interface LEDStateData {
    mode: string;
    data: Record<string, unknown>;
    timestamp: string;
}

