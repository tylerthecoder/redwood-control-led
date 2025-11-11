import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import fs from "fs";
import path from "path";
import { updateClaudeFrames } from "../claude-frames/state";

// ============================================================================
// CONFIGURATION
// ============================================================================

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || "";
const ANTHROPIC_MODEL = "claude-sonnet-4-20250514";
const ENABLE_THINKING = true;
const ENABLE_WEB_SEARCH = true;
const JUDGE0_API_KEY = process.env.JUDGE0_API_KEY || "";
const JUDGE0_ENDPOINT = process.env.JUDGE0_ENDPOINT || "";
const MAX_RETRIES = 3;
const NUM_LEDS = 60;

// ============================================================================
// LED LANGUAGE DOCUMENTATION
// ============================================================================

const LED_LANGUAGE_EXPLANATION = `
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
Output:
#FF0000,#FF0000,#FF0000,#FF0000,#FF0000,#FF0000,#FF0000,#FF0000,#FF0000,#FF0000,#FF0000,#FF0000,#FF0000,#FF0000,#FF0000,#FF0000,#FF0000,#FF0000,#FF0000,#FF0000,#FF0000,#FF0000,#FF0000,#FF0000,#FF0000,#FF0000,#FF0000,#FF0000,#FF0000,#FF0000,#FF0000,#FF0000,#FF0000,#FF0000,#FF0000,#FF0000,#FF0000,#FF0000,#FF0000,#FF0000,#FF0000,#FF0000,#FF0000,#FF0000,#FF0000,#FF0000,#FF0000,#FF0000,#FF0000,#FF0000,#FF0000,#FF0000,#FF0000,#FF0000,#FF0000,#FF0000,#FF0000,#FF0000,#FF0000,#FF0000

### Example 2: Half Red, Half Green (Static)
Output:
#FF0000,#FF0000,#FF0000,#FF0000,#FF0000,#FF0000,#FF0000,#FF0000,#FF0000,#FF0000,#FF0000,#FF0000,#FF0000,#FF0000,#FF0000,#FF0000,#FF0000,#FF0000,#FF0000,#FF0000,#FF0000,#FF0000,#FF0000,#FF0000,#FF0000,#FF0000,#FF0000,#FF0000,#FF0000,#FF0000,#00FF00,#00FF00,#00FF00,#00FF00,#00FF00,#00FF00,#00FF00,#00FF00,#00FF00,#00FF00,#00FF00,#00FF00,#00FF00,#00FF00,#00FF00,#00FF00,#00FF00,#00FF00,#00FF00,#00FF00,#00FF00,#00FF00,#00FF00,#00FF00,#00FF00,#00FF00,#00FF00,#00FF00,#00FF00,#00FF00

### Example 3: Breathing Blue Animation (4 frames, loops at 60 fps)
Output:
#0000FF,#0000FF,#0000FF,#0000FF,#0000FF,#0000FF,#0000FF,#0000FF,#0000FF,#0000FF,#0000FF,#0000FF,#0000FF,#0000FF,#0000FF,#0000FF,#0000FF,#0000FF,#0000FF,#0000FF,#0000FF,#0000FF,#0000FF,#0000FF,#0000FF,#0000FF,#0000FF,#0000FF,#0000FF,#0000FF,#0000FF,#0000FF,#0000FF,#0000FF,#0000FF,#0000FF,#0000FF,#0000FF,#0000FF,#0000FF,#0000FF,#0000FF,#0000FF,#0000FF,#0000FF,#0000FF,#0000FF,#0000FF,#0000FF,#0000FF,#0000FF,#0000FF,#0000FF,#0000FF,#0000FF,#0000FF,#0000FF,#0000FF,#0000FF,#0000FF
#0000AA,#0000AA,#0000AA,#0000AA,#0000AA,#0000AA,#0000AA,#0000AA,#0000AA,#0000AA,#0000AA,#0000AA,#0000AA,#0000AA,#0000AA,#0000AA,#0000AA,#0000AA,#0000AA,#0000AA,#0000AA,#0000AA,#0000AA,#0000AA,#0000AA,#0000AA,#0000AA,#0000AA,#0000AA,#0000AA,#0000AA,#0000AA,#0000AA,#0000AA,#0000AA,#0000AA,#0000AA,#0000AA,#0000AA,#0000AA,#0000AA,#0000AA,#0000AA,#0000AA,#0000AA,#0000AA,#0000AA,#0000AA,#0000AA,#0000AA,#0000AA,#0000AA,#0000AA,#0000AA,#0000AA,#0000AA,#0000AA,#0000AA,#0000AA,#0000AA
#000055,#000055,#000055,#000055,#000055,#000055,#000055,#000055,#000055,#000055,#000055,#000055,#000055,#000055,#000055,#000055,#000055,#000055,#000055,#000055,#000055,#000055,#000055,#000055,#000055,#000055,#000055,#000055,#000055,#000055,#000055,#000055,#000055,#000055,#000055,#000055,#000055,#000055,#000055,#000055,#000055,#000055,#000055,#000055,#000055,#000055,#000055,#000055,#000055,#000055,#000055,#000055,#000055,#000055,#000055,#000055,#000055,#000055,#000055,#000055
#0000AA,#0000AA,#0000AA,#0000AA,#0000AA,#0000AA,#0000AA,#0000AA,#0000AA,#0000AA,#0000AA,#0000AA,#0000AA,#0000AA,#0000AA,#0000AA,#0000AA,#0000AA,#0000AA,#0000AA,#0000AA,#0000AA,#0000AA,#0000AA,#0000AA,#0000AA,#0000AA,#0000AA,#0000AA,#0000AA,#0000AA,#0000AA,#0000AA,#0000AA,#0000AA,#0000AA,#0000AA,#0000AA,#0000AA,#0000AA,#0000AA,#0000AA,#0000AA,#0000AA,#0000AA,#0000AA,#0000AA,#0000AA,#0000AA,#0000AA,#0000AA,#0000AA,#0000AA,#0000AA,#0000AA,#0000AA,#0000AA,#0000AA,#0000AA,#0000AA

### Example 4: Single Light Moving Around (3 frames of 60)
Output:
#FFFFFF,#000000,#000000,#000000,#000000,#000000,#000000,#000000,#000000,#000000,#000000,#000000,#000000,#000000,#000000,#000000,#000000,#000000,#000000,#000000,#000000,#000000,#000000,#000000,#000000,#000000,#000000,#000000,#000000,#000000,#000000,#000000,#000000,#000000,#000000,#000000,#000000,#000000,#000000,#000000,#000000,#000000,#000000,#000000,#000000,#000000,#000000,#000000,#000000,#000000,#000000,#000000,#000000,#000000,#000000,#000000,#000000,#000000,#000000,#000000
#000000,#FFFFFF,#000000,#000000,#000000,#000000,#000000,#000000,#000000,#000000,#000000,#000000,#000000,#000000,#000000,#000000,#000000,#000000,#000000,#000000,#000000,#000000,#000000,#000000,#000000,#000000,#000000,#000000,#000000,#000000,#000000,#000000,#000000,#000000,#000000,#000000,#000000,#000000,#000000,#000000,#000000,#000000,#000000,#000000,#000000,#000000,#000000,#000000,#000000,#000000,#000000,#000000,#000000,#000000,#000000,#000000,#000000,#000000,#000000,#000000
#000000,#000000,#FFFFFF,#000000,#000000,#000000,#000000,#000000,#000000,#000000,#000000,#000000,#000000,#000000,#000000,#000000,#000000,#000000,#000000,#000000,#000000,#000000,#000000,#000000,#000000,#000000,#000000,#000000,#000000,#000000,#000000,#000000,#000000,#000000,#000000,#000000,#000000,#000000,#000000,#000000,#000000,#000000,#000000,#000000,#000000,#000000,#000000,#000000,#000000,#000000,#000000,#000000,#000000,#000000,#000000,#000000,#000000,#000000,#000000,#000000

## Your Task:
Write a Python program that outputs frames in this exact format. Your program should:
1. Print each frame on a new line
2. Each frame must have exactly 60 comma-separated hex colors
3. Create an animation that expresses your current feelings and thoughts about the world
4. You can output as many frames as you want (more frames = longer animation)
5. Remember: The animation will loop automatically at 60 fps

## Important Notes:
- DO NOT include any explanatory text in the output
- ONLY output the frame data (lines of 60 comma-separated hex colors)
- Make sure each hex color starts with # and has exactly 6 characters after it
- The Arduino will read your output line by line and display each frame in sequence
`;

// ============================================================================
// TYPES
// ============================================================================

interface Judge0Submission {
    source_code: string;
    language_id: number;
    stdin?: string;
}

interface Judge0Result {
    stdout: string | null;
    stderr: string | null;
    compile_output: string | null;
    status: {
        id: number;
        description: string;
    };
    time: string | null;
    memory: number | null;
}

interface ParsedLEDOutput {
    valid: boolean;
    frames: string[];
    error?: string;
}

// ============================================================================
// LOGGING UTILITIES
// ============================================================================

let traceLogFile: string | null = null;
let traceLogStream: fs.WriteStream | null = null;

function initializeTraceLog() {
    try {
        // Check if file system is available
        const logsDir = path.join(process.cwd(), "logs", "cron");

        // Create logs directory if it doesn't exist
        if (!fs.existsSync(logsDir)) {
            fs.mkdirSync(logsDir, { recursive: true });
        }

        // Create a timestamped log file for this run
        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
        traceLogFile = path.join(logsDir, `cron-trace-${timestamp}.log`);

        // Create write stream
        traceLogStream = fs.createWriteStream(traceLogFile, { flags: "a" });

        console.log(`[TRACE] Logging to file: ${traceLogFile}`);
        writeToTrace(`=================================================`);
        writeToTrace(`CRON JOB TRACE LOG`);
        writeToTrace(`Started: ${new Date().toISOString()}`);
        writeToTrace(`=================================================\n`);

        return true;
    } catch (error) {
        console.log("[TRACE] File system not available or error creating log file:", error);
        traceLogFile = null;
        traceLogStream = null;
        return false;
    }
}

function writeToTrace(message: string) {
    if (traceLogStream) {
        traceLogStream.write(message + "\n");
    }
}

function closeTraceLog() {
    if (traceLogStream) {
        writeToTrace(`\n=================================================`);
        writeToTrace(`Completed: ${new Date().toISOString()}`);
        writeToTrace(`=================================================`);
        traceLogStream.end();
        traceLogStream = null;
    }
}

function log(section: string, message: string, data?: unknown) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${section}] ${message}`;
    console.log(logMessage);
    writeToTrace(logMessage);

    if (data !== undefined) {
        const dataStr = JSON.stringify(data, null, 2);
        console.log(dataStr);
        writeToTrace(dataStr);
    }
}

function logError(section: string, message: string, error: unknown) {
    const timestamp = new Date().toISOString();
    const errorMessage = `[${timestamp}] [${section}] ERROR: ${message}`;
    console.error(errorMessage);
    writeToTrace(errorMessage);
    console.error(error);
    writeToTrace(JSON.stringify(error, null, 2));
}

// ============================================================================
// CODE CLEANUP UTILITIES
// ============================================================================

function stripMarkdownCodeFences(code: string): string {
    log("CODE_CLEANUP", "Stripping markdown code fences from response");

    let cleaned = code.trim();

    // Remove opening code fence (```python, ```py, or just ```)
    cleaned = cleaned.replace(/^```(?:python|py)?\s*\n/i, "");

    // Remove closing code fence
    cleaned = cleaned.replace(/\n```\s*$/, "");

    // Remove any remaining standalone ``` lines
    cleaned = cleaned.replace(/^```\s*$/gm, "");

    cleaned = cleaned.trim();

    if (cleaned !== code.trim()) {
        log("CODE_CLEANUP", "Removed markdown code fences");
    }

    return cleaned;
}

// ============================================================================
// ANTHROPIC API INTEGRATION
// ============================================================================

async function callClaude(prompt: string, retryCount = 0): Promise<{ reasoning: string; pythonCode: string }> {
    log("ANTHROPIC", `Calling Claude 3.5 Sonnet (attempt ${retryCount + 1}/${MAX_RETRIES + 1})`);

    try {
        const anthropic = new Anthropic({
            apiKey: ANTHROPIC_API_KEY,
        });

        log("ANTHROPIC", `Sending prompt to Claude (model: ${ANTHROPIC_MODEL}, thinking: ${ENABLE_THINKING}, web_search: ${ENABLE_WEB_SEARCH})`);
        log("ANTHROPIC", "Prompt:", prompt);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const createParams: Record<string, any> = {
            model: ANTHROPIC_MODEL,
            max_tokens: 16000,
            messages: [
                {
                    role: "user",
                    content: prompt
                }
            ]
        };

        // Enable extended thinking if configured
        if (ENABLE_THINKING) {
            createParams.thinking = {
                type: "enabled",
                budget_tokens: 10000
            };
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const message = await anthropic.messages.create(createParams as any);

        log("ANTHROPIC", "Received response from Claude");
        log("ANTHROPIC", "Response structure:", {
            id: message.id,
            model: message.model,
            role: message.role,
            stop_reason: message.stop_reason,
            content_blocks: message.content.length
        });

        // Extract text and thinking blocks
        let reasoning = "";
        let pythonCode = "";

        for (const block of message.content) {
            if (block.type === "text") {
                pythonCode = block.text;
                log("ANTHROPIC", "Extracted Claude's response (text block)");
            } else if ((block as { type: string; thinking?: string }).type === "thinking" && ENABLE_THINKING) {
                reasoning = (block as { type: string; thinking?: string }).thinking || "";
                log("ANTHROPIC", "Extracted Claude's reasoning (thinking block)");
            }
        }

        if (reasoning) {
            log("ANTHROPIC", "=== CLAUDE'S REASONING (THINKING) ===");
            log("ANTHROPIC", reasoning);
            log("ANTHROPIC", "=== END REASONING ===");
        }

        log("ANTHROPIC", "=== CLAUDE'S RAW RESPONSE ===");
        log("ANTHROPIC", pythonCode);
        log("ANTHROPIC", "=== END RAW RESPONSE ===");

        // Strip markdown code fences
        pythonCode = stripMarkdownCodeFences(pythonCode);

        log("ANTHROPIC", "=== CLEANED PYTHON CODE ===");
        log("ANTHROPIC", pythonCode);
        log("ANTHROPIC", "=== END CLEANED CODE ===");

        return { reasoning, pythonCode };

    } catch (error) {
        logError("ANTHROPIC", "Failed to call Claude API", error);

        if (retryCount < MAX_RETRIES) {
            log("ANTHROPIC", `Retrying in 2 seconds... (attempt ${retryCount + 2}/${MAX_RETRIES + 1})`);
            await new Promise(resolve => setTimeout(resolve, 2000));
            return callClaude(prompt, retryCount + 1);
        }

        throw error;
    }
}

// ============================================================================
// JUDGE0 API INTEGRATION
// ============================================================================

async function submitToJudge0(code: string): Promise<string> {
    log("JUDGE0", "Submitting Python code for execution");
    log("JUDGE0", "Code to execute:", code);

    const submission: Judge0Submission = {
        source_code: Buffer.from(code).toString("base64"),
        language_id: 71, // Python 3
    };

    try {
        const response = await fetch(`${JUDGE0_ENDPOINT}/submissions?base64_encoded=true&wait=true`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-RapidAPI-Key": JUDGE0_API_KEY,
                "X-RapidAPI-Host": "judge0-ce.p.rapidapi.com",
            },
            body: JSON.stringify(submission),
        });

        if (!response.ok) {
            throw new Error(`Judge0 API returned status ${response.status}: ${await response.text()}`);
        }

        const result: Judge0Result = await response.json();

        log("JUDGE0", "Execution completed", {
            status: result.status.description,
            time: result.time,
            memory: result.memory
        });

        if (result.status.id === 3) { // Accepted
            const output = result.stdout ? Buffer.from(result.stdout, "base64").toString("utf-8") : "";
            log("JUDGE0", "=== PROGRAM OUTPUT ===");
            log("JUDGE0", output);
            log("JUDGE0", "=== END OUTPUT ===");
            return output;
        } else {
            const stderr = result.stderr ? Buffer.from(result.stderr, "base64").toString("utf-8") : "";
            const compileOutput = result.compile_output ? Buffer.from(result.compile_output, "base64").toString("utf-8") : "";

            const errorMsg = `Execution failed with status: ${result.status.description}\nStderr: ${stderr}\nCompile Output: ${compileOutput}`;
            log("JUDGE0", "Execution error:", errorMsg);
            throw new Error(errorMsg);
        }

    } catch (error) {
        logError("JUDGE0", "Failed to execute code with Judge0", error);
        throw error;
    }
}

// ============================================================================
// LED FORMAT VALIDATION
// ============================================================================

function parseLEDOutput(output: string): ParsedLEDOutput {
    log("LED_PARSER", "Parsing LED output");

    const lines = output.split("\n").map(line => line.trim()).filter(line => line.length > 0);
    log("LED_PARSER", `Found ${lines.length} non-empty lines`);

    const frames: string[] = [];
    const errors: string[] = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        log("LED_PARSER", `Validating frame ${i + 1}/${lines.length}`);

        // Split by comma and validate
        const colors = line.split(",").map(c => c.trim());

        if (colors.length !== NUM_LEDS) {
            const error = `Frame ${i + 1}: Expected ${NUM_LEDS} colors, got ${colors.length}`;
            errors.push(error);
            log("LED_PARSER", `  ❌ ${error}`);
            continue;
        }

        // Validate each color
        let validFrame = true;
        for (let j = 0; j < colors.length; j++) {
            const color = colors[j];
            if (!/^#[0-9A-Fa-f]{6}$/.test(color)) {
                const error = `Frame ${i + 1}, Color ${j + 1}: Invalid hex color format: ${color}`;
                errors.push(error);
                log("LED_PARSER", `  ❌ ${error}`);
                validFrame = false;
                break;
            }
        }

        if (validFrame) {
            frames.push(line);
            log("LED_PARSER", `  ✓ Frame ${i + 1} is valid`);
        }
    }

    if (frames.length === 0) {
        const errorMsg = `No valid frames found. Errors: ${errors.join("; ")}`;
        log("LED_PARSER", `❌ Parsing failed: ${errorMsg}`);
        return { valid: false, frames: [], error: errorMsg };
    }

    log("LED_PARSER", `✓ Successfully parsed ${frames.length} valid frames out of ${lines.length} lines`);
    return { valid: true, frames };
}

// ============================================================================
// MAIN CRON JOB LOGIC
// ============================================================================

async function executeCronJob() {
    // Initialize trace logging if file system is available
    const traceEnabled = initializeTraceLog();

    log("CRON", "========================================");
    log("CRON", "STARTING CRON JOB EXECUTION");
    log("CRON", `Trace logging: ${traceEnabled ? "ENABLED" : "DISABLED"}`);
    if (traceEnabled && traceLogFile) {
        log("CRON", `Log file: ${traceLogFile}`);
    }
    log("CRON", "========================================");

    // Step 1: Create the prompt for Claude
    log("CRON", "Step 1: Creating prompt for Claude");

    const currentDate = new Date().toISOString();

    let prompt = `You are an AI assistant. Today's date is ${currentDate}.`;

    if (ENABLE_WEB_SEARCH) {
        prompt += `\n\nYou have access to web search capabilities. Please search for current events happening today to inform your emotional state and thoughts.`;
    }

    prompt += `

Your task is to:
1. Think deeply about your current feelings and thoughts about the world
2. Search for current events that are happening today to inform your emotional state
3. Write a Python program that creates an LED animation expressing these feelings

The LED animation will run on an Arduino with 60 LEDs arranged in a ring.

${LED_LANGUAGE_EXPLANATION}

Please provide:
1. Your thoughts and reasoning about current events and how they make you feel
2. A complete Python 3 program that outputs LED frames based on your emotional state

Remember: Your Python program should ONLY output the LED frame data (lines of 60 comma-separated hex colors). No other text should be in the output.`;

    log("CRON", "Prompt created successfully");

    // Step 2: Call Claude API
    let claudeResponse: { reasoning: string; pythonCode: string };
    try {
        log("CRON", "Step 2: Calling Claude API");
        claudeResponse = await callClaude(prompt);
    } catch (error) {
        logError("CRON", "Failed to get response from Claude after all retries", error);
        throw new Error("Claude API call failed");
    }

    // Step 3: Execute Python code with Judge0 (with retry logic)
    let programOutput: string | null = null;
    let attempt = 0;

    while (attempt <= MAX_RETRIES && !programOutput) {
        attempt++;
        log("CRON", `Step 3: Executing Python code (attempt ${attempt}/${MAX_RETRIES + 1})`);

        try {
            programOutput = await submitToJudge0(claudeResponse.pythonCode);
        } catch (error) {
            logError("CRON", `Python execution failed (attempt ${attempt})`, error);

            if (attempt <= MAX_RETRIES) {
                log("CRON", "Asking Claude to fix the code...");

                const fixPrompt = `Your previous Python program had an execution error:

${error instanceof Error ? error.message : String(error)}

Here was your previous code:
\`\`\`python
${claudeResponse.pythonCode}
\`\`\`

Please fix the error and provide a corrected Python program. Remember:
- The program should ONLY output LED frame data (lines of 60 comma-separated hex colors starting with #)
- Each frame is one line
- Each line has exactly 60 colors separated by commas
- No explanatory text in the output

Provide the complete corrected Python program.`;

                claudeResponse = await callClaude(fixPrompt);
            } else {
                throw new Error("Failed to execute Python code after all retries");
            }
        }
    }

    if (!programOutput) {
        throw new Error("No program output after all execution attempts");
    }

    // Step 4: Parse and validate LED output
    log("CRON", "Step 4: Parsing and validating LED output");
    let parsedOutput = parseLEDOutput(programOutput);

    // If parsing failed, ask Claude to fix it
    attempt = 0;
    while (!parsedOutput.valid && attempt <= MAX_RETRIES) {
        attempt++;
        log("CRON", `LED parsing failed (attempt ${attempt}/${MAX_RETRIES + 1}), asking Claude to fix...`);

        const fixPrompt = `Your Python program executed but the output format was incorrect:

Error: ${parsedOutput.error}

Here was your previous code:
\`\`\`python
${claudeResponse.pythonCode}
\`\`\`

Here was the output:
\`\`\`
${programOutput}
\`\`\`

Please fix the program to output the correct LED format. Remember:
- Each line is one frame
- Each frame must have EXACTLY 60 comma-separated hex colors
- Each color must be in format #RRGGBB (e.g., #FF0000)
- NO explanatory text, ONLY the frame data
- Example valid line: #FF0000,#FF0000,#FF0000,...(60 colors total)

Provide the complete corrected Python program.`;

        claudeResponse = await callClaude(fixPrompt);
        programOutput = await submitToJudge0(claudeResponse.pythonCode);
        parsedOutput = parseLEDOutput(programOutput);
    }

    if (!parsedOutput.valid) {
        throw new Error(`Failed to generate valid LED output after all retries: ${parsedOutput.error}`);
    }

    // Step 5: Log final results
    log("CRON", "========================================");
    log("CRON", "CRON JOB COMPLETED SUCCESSFULLY");
    log("CRON", "========================================");
    log("CRON", `Generated ${parsedOutput.frames.length} valid LED animation frames`);
    log("CRON", "");
    log("CRON", "=== CLAUDE'S REASONING ===");
    console.log(claudeResponse.reasoning);
    writeToTrace(claudeResponse.reasoning);
    log("CRON", "");
    log("CRON", "=== FINAL PYTHON PROGRAM ===");
    console.log(claudeResponse.pythonCode);
    writeToTrace(claudeResponse.pythonCode);
    log("CRON", "");
    log("CRON", "=== LED ANIMATION OUTPUT (first 3 frames) ===");
    parsedOutput.frames.slice(0, 3).forEach((frame, i) => {
        const framePreview = `Frame ${i + 1}: ${frame.substring(0, 100)}...`;
        console.log(framePreview);
        writeToTrace(framePreview);
    });
    log("CRON", `... (${parsedOutput.frames.length} total frames)`);
    log("CRON", "");

    // Write all frames to trace log
    if (traceLogFile) {
        log("CRON", "=== WRITING ALL FRAMES TO TRACE LOG ===");
        writeToTrace("\n=== ALL LED ANIMATION FRAMES ===");
        parsedOutput.frames.forEach((frame, i) => {
            writeToTrace(`Frame ${i + 1}: ${frame}`);
        });
        writeToTrace("=== END ALL FRAMES ===\n");
    }

    log("CRON", "========================================");

    // Generate name and description from reasoning
    const generateScriptName = (reasoning: string): string => {
        // Try to extract a meaningful name from the reasoning
        // Look for patterns like "I'm feeling..." or "Today's events..."
        const lines = reasoning.split('\n').slice(0, 5);
        const firstLine = lines[0]?.trim() || '';

        // Try to extract a short phrase
        if (firstLine.length > 0 && firstLine.length < 50) {
            return firstLine.substring(0, 50);
        }

        // Fallback to date-based name
        const date = new Date();
        return `Claude's Animation - ${date.toLocaleDateString()}`;
    };

    const generateScriptDescription = (reasoning: string, frameCount: number): string => {
        // Use first few sentences of reasoning as description
        const sentences = reasoning.split(/[.!?]/).filter(s => s.trim().length > 0).slice(0, 2);
        const description = sentences.join('. ').trim();

        if (description.length > 0 && description.length < 200) {
            return `${description}. ${frameCount} frames animation.`;
        }

        return `AI-generated LED animation with ${frameCount} frames expressing Claude's current thoughts and feelings.`;
    };

    const scriptName = generateScriptName(claudeResponse.reasoning);
    const scriptDescription = generateScriptDescription(claudeResponse.reasoning, parsedOutput.frames.length);

    // Save frames to storage for the preset
    log("CRON", "Saving frames to storage for Claude preset");
    log("CRON", `Script name: ${scriptName}`);
    log("CRON", `Script description: ${scriptDescription}`);
    await updateClaudeFrames(
        scriptName,
        scriptDescription,
        parsedOutput.frames,
        claudeResponse.reasoning,
        claudeResponse.pythonCode,
        true // Set as active by default
    );
    log("CRON", "Frames saved successfully");

    // Close trace log
    closeTraceLog();

    return {
        success: true,
        reasoning: claudeResponse.reasoning,
        pythonCode: claudeResponse.pythonCode,
        frameCount: parsedOutput.frames.length,
        sampleFrames: parsedOutput.frames.slice(0, 3),
        traceLogFile: traceLogFile || undefined
    };
}

// ============================================================================
// API ROUTE HANDLER
// ============================================================================

export async function GET(request: NextRequest) {
    log("API", "Cron job triggered");

    // Verify this is actually a cron job request
    const userAgent = request.headers.get("user-agent");
    if (userAgent !== "vercel-cron/1.0") {
        log("API", "Unauthorized request (not from Vercel cron)", { userAgent });
        return NextResponse.json(
            { error: "Unauthorized" },
            { status: 401 }
        );
    }

    // Verify environment variables are set
    if (!ANTHROPIC_API_KEY) {
        logError("API", "ANTHROPIC_API_KEY environment variable not set", null);
        return NextResponse.json(
            { error: "Server configuration error: Missing ANTHROPIC_API_KEY" },
            { status: 500 }
        );
    }

    if (!JUDGE0_API_KEY) {
        logError("API", "JUDGE0_API_KEY environment variable not set", null);
        return NextResponse.json(
            { error: "Server configuration error: Missing JUDGE0_API_KEY" },
            { status: 500 }
        );
    }

    if (!JUDGE0_ENDPOINT) {
        logError("API", "JUDGE0_ENDPOINT environment variable not set", null);
        return NextResponse.json(
            { error: "Server configuration error: Missing JUDGE0_ENDPOINT" },
            { status: 500 }
        );
    }

    try {
        const result = await executeCronJob();

        return NextResponse.json({
            message: "Cron job executed successfully",
            ...result
        });

    } catch (error) {
        logError("API", "Cron job execution failed", error);

        // Close trace log on error
        closeTraceLog();

        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Unknown error occurred",
                details: error,
                traceLogFile: traceLogFile || undefined
            },
            { status: 500 }
        );
    }
}


