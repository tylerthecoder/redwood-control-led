/**
 * Script Execution and Validation Library
 * Handles Python script execution and LED output validation
 */

import { executePythonCode } from "./judge0";

// ============================================================================
// TYPES
// ============================================================================

export interface ScriptExecutionOptions {
    title: string;
    description: string;
    pythonCode: string;
}

export interface ScriptExecutionResult {
    success: boolean;
    frames?: string[];
    error?: string;
    executionError?: string;
    validationError?: string;
    frameCount?: number;
    executionTime?: string;
    memory?: number;
}

interface ParsedLEDOutput {
    valid: boolean;
    frames: string[];
    error?: string;
}

// ============================================================================
// CONFIGURATION
// ============================================================================

const NUM_LEDS = 60;

// ============================================================================
// VALIDATION FUNCTIONS
// ============================================================================

/**
 * Parse and validate LED output format
 * @param output - Raw output from Python script
 * @returns Parsed output with validation results
 */
export function parseLEDOutput(output: string): ParsedLEDOutput {
    const lines = output.split("\n").map(line => line.trim()).filter(line => line.length > 0);

    if (lines.length === 0) {
        return {
            valid: false,
            frames: [],
            error: "No output produced. The script should output LED frames (60 comma-separated hex colors per line)."
        };
    }

    const frames: string[] = [];
    const errors: string[] = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Split by comma and validate
        const colors = line.split(",").map(c => c.trim());

        if (colors.length !== NUM_LEDS) {
            errors.push(`Frame ${i + 1}: Expected ${NUM_LEDS} colors, got ${colors.length}`);
            continue;
        }

        // Validate each color
        let validFrame = true;
        for (let j = 0; j < colors.length; j++) {
            const color = colors[j];
            if (!/^#[0-9A-Fa-f]{6}$/.test(color)) {
                errors.push(`Frame ${i + 1}, Color ${j + 1}: Invalid hex color format: "${color}" (expected format: #RRGGBB)`);
                validFrame = false;
                break;
            }
        }

        if (validFrame) {
            frames.push(line);
        }
    }

    if (frames.length === 0) {
        return {
            valid: false,
            frames: [],
            error: `No valid frames found. ${errors.slice(0, 5).join("; ")}${errors.length > 5 ? ` (and ${errors.length - 5} more errors)` : ""}`
        };
    }

    return { valid: true, frames };
}

/**
 * Strip markdown code fences from code string
 * @param code - Code string potentially wrapped in markdown
 * @returns Cleaned code string
 */
export function stripMarkdownCodeFences(code: string): string {
    let cleaned = code.trim();

    // Remove opening code fence (```python, ```py, or just ```)
    cleaned = cleaned.replace(/^```(?:python|py)?\s*\n/i, "");

    // Remove closing code fence
    cleaned = cleaned.replace(/\n```\s*$/, "");

    // Remove any remaining standalone ``` lines
    cleaned = cleaned.replace(/^```\s*$/gm, "");

    return cleaned.trim();
}

// ============================================================================
// MAIN EXECUTION FUNCTION
// ============================================================================

/**
 * Execute and validate a Python script for LED animation
 * @param options - Script execution options (title, description, pythonCode)
 * @returns Execution result with frames or error details
 */
export async function executeAndValidateScript(
    options: ScriptExecutionOptions
): Promise<ScriptExecutionResult> {
    const { title, description, pythonCode } = options;

    // Validate inputs
    if (!title?.trim()) {
        return {
            success: false,
            error: "Title is required"
        };
    }

    if (!description?.trim()) {
        return {
            success: false,
            error: "Description is required"
        };
    }

    if (!pythonCode?.trim()) {
        return {
            success: false,
            error: "Python code is required"
        };
    }

    // Clean the code
    const cleanedCode = stripMarkdownCodeFences(pythonCode);

    // Execute the code
    const executionResult = await executePythonCode(cleanedCode);

    if (!executionResult.success) {
        return {
            success: false,
            executionError: executionResult.error,
            error: `Script execution failed: ${executionResult.error}`
        };
    }

    // Parse and validate the output
    const parsedOutput = parseLEDOutput(executionResult.output || "");

    if (!parsedOutput.valid) {
        return {
            success: false,
            validationError: parsedOutput.error,
            error: `Output validation failed: ${parsedOutput.error}`,
            executionTime: executionResult.executionTime,
            memory: executionResult.memory
        };
    }

    // Success!
    return {
        success: true,
        frames: parsedOutput.frames,
        frameCount: parsedOutput.frames.length,
        executionTime: executionResult.executionTime,
        memory: executionResult.memory
    };
}

// ============================================================================
// HELPER CONSTANTS
// ============================================================================

/**
 * LED language documentation for user reference
 */
export const LED_LANGUAGE_EXPLANATION = `
# LED Language Format

This Arduino has 60 RGB LEDs arranged in a ring. You need to output animation frames
in a specific format that the Arduino can understand.

## Format Rules:
1. Each frame is ONE LINE of output
2. Each frame contains exactly 60 hex color values (one for each LED)
3. Colors are separated by commas
4. Each color is in 6-digit hex format: #RRGGBB (e.g., #FF0000 for red)
5. The framerate is typically 60 fps (frames per second)

## Example Programs:

### Example 1: All LEDs Red (Static)
\`\`\`python
print("#FF0000," * 59 + "#FF0000")
\`\`\`

### Example 2: Breathing Blue Animation (4 frames, loops at 60 fps)
\`\`\`python
colors = ["#0000FF", "#0000AA", "#000055", "#0000AA"]
for color in colors:
    print(f"{color}," * 59 + color)
\`\`\`

### Example 3: Single Light Moving Around
\`\`\`python
num_leds = 60
for i in range(num_leds):
    frame = ["#000000"] * num_leds
    frame[i] = "#FFFFFF"
    print(",".join(frame))
\`\`\`

## Important Notes:
- DO NOT include any explanatory text in the output
- ONLY output the frame data (lines of 60 comma-separated hex colors)
- Make sure each hex color starts with # and has exactly 6 characters after it
- The Arduino will read your output line by line and display each frame in sequence
`;

