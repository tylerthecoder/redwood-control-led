// Buffer management for script and claude modes
import { getLEDStateAsState } from "./ledstate";
import { getAllScripts } from "./storage";
import type { Script } from "./model";

const BUFFER_DURATION_SECONDS = 0.5; // 0.5 second buffers to reduce JSON size (~16KB vs ~32KB)
const NUM_LEDS = 60;

// Convert hex color string to 24-bit RGB number
function hexToNumber(hex: string): number {
    const cleaned = hex.replace("#", "");
    if (cleaned.length !== 6) return 0;
    return parseInt(cleaned, 16);
}

// Convert frames from hex strings to numeric format and split into buffers
function processFormatFrames(frames: string[], framerate: number): number[][] {
    const framesPerBuffer = Math.floor(framerate * BUFFER_DURATION_SECONDS);
    const buffers: number[][] = [];

    for (let i = 0; i < frames.length; i += framesPerBuffer) {
        const buffer: number[] = [];
        const bufferFrames = frames.slice(i, i + framesPerBuffer);

        for (const frame of bufferFrames) {
            const colors = frame.split(/[,\s]+/).filter(c => c.trim());
            for (const color of colors) {
                buffer.push(hexToNumber(color));
            }
        }

        buffers.push(buffer);
    }

    return buffers;
}

/**
 * Get the most recent script created by Claude
 */
async function getMostRecentClaudeScript(): Promise<Script | null> {
    const scripts = await getAllScripts();
    const claudeScripts = scripts.filter(s => s.createdBy === "claude");

    if (claudeScripts.length === 0) {
        return null;
    }

    // Scripts are already sorted by created_at DESC, so first claude script is most recent
    return claudeScripts[0];
}

/**
 * Get buffer data for a given index
 * Handles both script mode (uses stored buffers) and claude mode (uses most recent claude script)
 */
export async function getBufferData(index: number): Promise<{
    buffer: string; // Hex string format
    buffer_index: number;
    next_buffer_index: number;
    framerate: number;
    format: 'hex';
} | null> {
    const currentState = await getLEDStateAsState();

    let buffers: number[][];
    let framerate: number;

    if (currentState.mode === "script") {
        // Use buffers from script mode state
        buffers = currentState.buffers;
        framerate = currentState.framerate;
    } else if (currentState.mode === "claude") {
        // Get most recent Claude script and process its frames
        const claudeScript = await getMostRecentClaudeScript();

        if (!claudeScript || claudeScript.frames.length === 0) {
            return null; // No Claude script available
        }

        framerate = claudeScript.framerate || 60;
        buffers = processFormatFrames(claudeScript.frames, framerate);
    } else {
        // Not in script or claude mode
        return null;
    }

    const totalBuffers = buffers.length;

    if (totalBuffers === 0) {
        return null;
    }

    // If index is invalid or out of range, return the first buffer (index 0)
    // This allows automatic wrapping and recovery from desync
    let bufferIndex = 0;
    if (!isNaN(index) && index >= 0 && index < totalBuffers) {
        bufferIndex = index;
    }

    const requestedBuffer = buffers[bufferIndex] || [];

    // Calculate next buffer index (wrap around)
    const nextBufferIndex = (bufferIndex + 1) % totalBuffers;

    // Convert buffer to hex string for more efficient transfer
    // Format: continuous hex string "FF0000FF0000..." (6 chars per color)
    const hexBuffer = requestedBuffer.map((n: number) => n.toString(16).padStart(6, '0')).join('');

    return {
        buffer: hexBuffer,
        buffer_index: bufferIndex,
        next_buffer_index: nextBufferIndex,
        framerate,
        format: 'hex',
    };
}

