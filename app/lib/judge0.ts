/**
 * Judge0 API Integration
 * Handles code execution via Judge0 service
 */

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

export interface ExecutionResult {
    success: boolean;
    output?: string;
    error?: string;
    executionTime?: string;
    memory?: number;
}

// ============================================================================
// CONFIGURATION
// ============================================================================

const JUDGE0_API_KEY = process.env.JUDGE0_API_KEY || "";
const JUDGE0_ENDPOINT = process.env.JUDGE0_ENDPOINT || "";

// ============================================================================
// EXECUTION FUNCTIONS
// ============================================================================

/**
 * Execute Python code using Judge0 API
 * @param code - Python source code to execute
 * @returns ExecutionResult with output or error details
 */
export async function executePythonCode(code: string): Promise<ExecutionResult> {
    if (!JUDGE0_API_KEY || !JUDGE0_ENDPOINT) {
        return {
            success: false,
            error: "Judge0 API not configured. Missing API key or endpoint."
        };
    }

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
            const errorText = await response.text();
            return {
                success: false,
                error: `Judge0 API returned status ${response.status}: ${errorText}`
            };
        }

        const result: Judge0Result = await response.json();

        if (result.status.id === 3) { // Accepted
            const output = result.stdout ? Buffer.from(result.stdout, "base64").toString("utf-8") : "";
            return {
                success: true,
                output,
                executionTime: result.time || undefined,
                memory: result.memory || undefined
            };
        } else {
            const stderr = result.stderr ? Buffer.from(result.stderr, "base64").toString("utf-8") : "";
            const compileOutput = result.compile_output ? Buffer.from(result.compile_output, "base64").toString("utf-8") : "";

            const errorMsg = `Execution failed: ${result.status.description}\n${stderr}\n${compileOutput}`.trim();
            return {
                success: false,
                error: errorMsg
            };
        }

    } catch (error) {
        return {
            success: false,
            error: `Failed to execute code: ${error instanceof Error ? error.message : String(error)}`
        };
    }
}

