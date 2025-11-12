"use server";

import { saveLEDStateFromState, getLEDStateAsState } from "./ledstate";
import type { SimpleMode, LoopMode, ScriptMode, ClaudeMode, Script, LedState } from "./model";
import { getAllScripts, getScriptById, saveScript, updateScript, deleteScript, setActiveScript } from "./storage";
import { executeAndValidateScript } from "./script-execution";

/**
 * Set LED mode to simple
 */
export async function setSimpleMode(options: { on?: boolean; color?: string } = {}) {
    "use server";
    const currentState = await getLEDStateAsState();
    const currentSimple = currentState.mode === "simple" ? currentState : { on: false, color: "#0000FF" };

    const newState: SimpleMode = {
        mode: "simple",
        on: options.on ?? currentSimple.on,
        color: options.color || currentSimple.color,
    };

    await saveLEDStateFromState(newState);
    return newState;
}

/**
 * Set LED mode to loop
 */
export async function setLoopMode(options: { colors?: string[]; delay?: number } = {}) {
    "use server";
    const currentState = await getLEDStateAsState();
    const currentLoop = currentState.mode === "loop" ? currentState : { colors: ["#FF0000", "#00FF00", "#0000FF"], delay: 1000 };

    const newState: LoopMode = {
        mode: "loop",
        colors: options.colors || currentLoop.colors,
        delay: options.delay ?? currentLoop.delay,
    };

    await saveLEDStateFromState(newState);
    return newState;
}

/**
 * Set LED mode to script
 */
export async function setScriptMode(options: { framerate?: number; frames?: string[] } = {}) {
    "use server";
    const currentState = await getLEDStateAsState();

    // If frames are provided, process them
    if (options.frames && options.frames.length > 0) {
        const BUFFER_DURATION_SECONDS = 0.5;
        const framerate = options.framerate ?? (currentState.mode === "script" ? currentState.framerate : 60);
        const framesPerBuffer = Math.floor(framerate * BUFFER_DURATION_SECONDS);
        const buffers: number[][] = [];

        function hexToNumber(hex: string): number {
            const cleaned = hex.replace("#", "");
            if (cleaned.length !== 6) return 0;
            return parseInt(cleaned, 16);
        }

        for (let i = 0; i < options.frames.length; i += framesPerBuffer) {
            const buffer: number[] = [];
            const bufferFrames = options.frames.slice(i, i + framesPerBuffer);

            for (const frame of bufferFrames) {
                const colors = frame.split(/[,\s]+/).filter(c => c.trim());
                for (const color of colors) {
                    buffer.push(hexToNumber(color));
                }
            }

            buffers.push(buffer);
        }

        const newState: ScriptMode = {
            mode: "script",
            buffers,
            framerate,
            totalBuffers: buffers.length,
        };

        await saveLEDStateFromState(newState);
        return newState;
    } else {
        // Just update framerate or initialize
        const newState: ScriptMode = {
            mode: "script",
            buffers: currentState.mode === "script" ? currentState.buffers : [],
            framerate: options.framerate ?? (currentState.mode === "script" ? currentState.framerate : 60),
            totalBuffers: currentState.mode === "script" ? currentState.totalBuffers : 0,
        };

        await saveLEDStateFromState(newState);
        return newState;
    }
}

/**
 * Set LED mode to claude
 */
export async function setClaudeMode() {
    "use server";
    const newState: ClaudeMode = {
        mode: "claude",
    };

    await saveLEDStateFromState(newState);
    return newState;
}

/**
 * Get full LED state (for UI display)
 */
export async function getFullLEDState(): Promise<LedState> {
    "use server";
    return await getLEDStateAsState();
}

// ============================================================================
// SCRIPT CRUD ACTIONS
// ============================================================================

/**
 * Get all scripts
 */
export async function getAllScriptsAction(): Promise<Script[]> {
    "use server";
    return await getAllScripts();
}

/**
 * Get a script by ID
 */
export async function getScriptByIdAction(id: number): Promise<Script | null> {
    "use server";
    if (isNaN(id)) {
        throw new Error("Invalid script ID");
    }
    return await getScriptById(id);
}

/**
 * Test a script without saving
 */
export async function testScriptAction(
    title: string,
    description: string,
    pythonCode: string
): Promise<{
    success: boolean;
    frames?: string[];
    frameCount?: number;
    executionTime?: string;
    memory?: number;
    error?: string;
    executionError?: string;
    validationError?: string;
}> {
    "use server";

    // Validate inputs
    if (!title || typeof title !== "string") {
        return {
            success: false,
            error: "Title is required and must be a string"
        };
    }

    if (!description || typeof description !== "string") {
        return {
            success: false,
            error: "Description is required and must be a string"
        };
    }

    if (!pythonCode || typeof pythonCode !== "string") {
        return {
            success: false,
            error: "Python code is required and must be a string"
        };
    }

    // Execute and validate the script
    const executionResult = await executeAndValidateScript({
        title,
        description,
        pythonCode
    });

    if (!executionResult.success) {
        return {
            success: false,
            error: executionResult.error,
            executionError: executionResult.executionError,
            validationError: executionResult.validationError
        };
    }

    return {
        success: true,
        frames: executionResult.frames,
        frameCount: executionResult.frameCount,
        executionTime: executionResult.executionTime,
        memory: executionResult.memory
    };
}

/**
 * Create a new script
 */
export async function createScriptAction(
    title: string,
    description: string,
    pythonCode: string,
    setAsActive: boolean = false,
    framerate: number = 60
): Promise<{
    success: boolean;
    scriptId?: number;
    frameCount?: number;
    executionTime?: string;
    memory?: number;
    error?: string;
    executionError?: string;
    validationError?: string;
}> {
    "use server";

    // Validate inputs
    if (!title || typeof title !== "string") {
        return {
            success: false,
            error: "Title is required and must be a string"
        };
    }

    if (!description || typeof description !== "string") {
        return {
            success: false,
            error: "Description is required and must be a string"
        };
    }

    if (!pythonCode || typeof pythonCode !== "string") {
        return {
            success: false,
            error: "Python code is required and must be a string"
        };
    }

    // Execute and validate the script
    const executionResult = await executeAndValidateScript({
        title,
        description,
        pythonCode
    });

    if (!executionResult.success) {
        return {
            success: false,
            error: executionResult.error,
            executionError: executionResult.executionError,
            validationError: executionResult.validationError
        };
    }

    // Save the script
    const scriptId = await saveScript(
        title,
        description,
        pythonCode,
        executionResult.frames || [],
        "user",
        undefined,
        setAsActive,
        framerate
    );

    return {
        success: true,
        scriptId,
        frameCount: executionResult.frameCount,
        executionTime: executionResult.executionTime,
        memory: executionResult.memory
    };
}

/**
 * Update an existing script
 */
export async function updateScriptAction(
    id: number,
    title: string,
    description: string,
    pythonCode: string,
    framerate: number = 60
): Promise<{
    success: boolean;
    frameCount?: number;
    error?: string;
    executionError?: string;
    validationError?: string;
}> {
    "use server";

    if (isNaN(id)) {
        return {
            success: false,
            error: "Invalid script ID"
        };
    }

    // Validate inputs
    if (!title || typeof title !== "string") {
        return {
            success: false,
            error: "Title is required and must be a string"
        };
    }

    if (!description || typeof description !== "string") {
        return {
            success: false,
            error: "Description is required and must be a string"
        };
    }

    if (!pythonCode || typeof pythonCode !== "string") {
        return {
            success: false,
            error: "Python code is required and must be a string"
        };
    }

    // Execute and validate the script
    const executionResult = await executeAndValidateScript({
        title,
        description,
        pythonCode
    });

    if (!executionResult.success) {
        return {
            success: false,
            error: executionResult.error,
            executionError: executionResult.executionError,
            validationError: executionResult.validationError
        };
    }

    // Update the script
    await updateScript(
        id,
        title,
        description,
        pythonCode,
        executionResult.frames || [],
        framerate
    );

    return {
        success: true,
        frameCount: executionResult.frameCount
    };
}

/**
 * Delete a script
 */
export async function deleteScriptAction(id: number): Promise<{ success: boolean; error?: string }> {
    "use server";

    if (isNaN(id)) {
        return {
            success: false,
            error: "Invalid script ID"
        };
    }

    try {
        await deleteScript(id);
        return { success: true };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : "Failed to delete script"
        };
    }
}

/**
 * Activate a script
 */
export async function activateScriptAction(id: number): Promise<{ success: boolean; error?: string }> {
    "use server";

    if (isNaN(id)) {
        return {
            success: false,
            error: "Invalid script ID"
        };
    }

    try {
        // Verify script exists
        const script = await getScriptById(id);
        if (!script) {
            return {
                success: false,
                error: "Script not found"
            };
        }

        // Set as active
        await setActiveScript(id);
        return { success: true };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : "Failed to activate script"
        };
    }
}

