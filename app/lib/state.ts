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

export type LedState = SimpleMode | LoopMode | ScriptMode;

// ============================================================================
// CLAUDE FRAMES TYPES
// ============================================================================

export interface ClaudeFrameData {
    id: number;
    name: string;
    description: string;
    frames: string[];
    reasoning: string;
    pythonCode: string;
    timestamp: string;
    frameCount: number;
    isActive: boolean;
}

// ============================================================================
// STORAGE TYPES (used by storage layer)
// ============================================================================

export interface LEDStateData {
    mode: string;
    data: Record<string, unknown>;
    timestamp: string;
}

