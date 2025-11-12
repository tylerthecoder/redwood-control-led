import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { saveScript } from "@/app/lib/storage";
import { executeAndValidateScript, LED_LANGUAGE_EXPLANATION } from "@/app/lib/script-execution";

// ============================================================================
// CONFIGURATION
// ============================================================================

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || "";
const ANTHROPIC_MODEL = "claude-sonnet-4-20250514";
const ENABLE_WEB_SEARCH = true;
const MAX_RETRIES = 3;

// ============================================================================
// LOGGING UTILITIES
// ============================================================================

function log(section: string, message: string, data?: unknown) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${section}] ${message}`;
    console.log(logMessage);

    if (data !== undefined) {
        const dataStr = JSON.stringify(data, null, 2);
        console.log(dataStr);
    }
}

function logError(section: string, message: string, error: unknown) {
    const timestamp = new Date().toISOString();
    const errorMessage = `[${timestamp}] [${section}] ERROR: ${message}`;
    console.error(errorMessage);
    console.error(error);
}


// ============================================================================
// ANTHROPIC API INTEGRATION
// ============================================================================

async function callClaude(prompt: string, retryCount = 0): Promise<{ title: string; description: string; pythonCode: string }> {
    log("ANTHROPIC", `Calling Claude 3.5 Sonnet (attempt ${retryCount + 1}/${MAX_RETRIES + 1})`);

    try {
        const anthropic = new Anthropic({
            apiKey: ANTHROPIC_API_KEY,
        });

        log("ANTHROPIC", `Sending prompt to Claude (model: ${ANTHROPIC_MODEL}, web_search: ${ENABLE_WEB_SEARCH})`);
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
            ],
            thinking: {
                type: "enabled",
                budget_tokens: 10000
            },
            tools: [{
                type: "web_search_20250305",
                name: "web_search",
                max_uses: 5
            }]
        };

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

        // Extract text blocks
        let pythonCode = "";
        let title = "";
        let description = "";
        let fullText = "";

        for (const block of message.content) {
            if (block.type === "text") {
                fullText += block.text + "\n";
                log("ANTHROPIC", "Extracted Claude's response (text block)");
            }
        }

        // Parse XML format from full text
        const titleMatch = fullText.match(/<title>([\s\S]*?)<\/title>/i);
        const descMatch = fullText.match(/<description>([\s\S]*?)<\/description>/i);
        const codeMatch = fullText.match(/<code>([\s\S]*?)<\/code>/i);

        if (titleMatch) {
            title = titleMatch[1].trim();
        }
        if (descMatch) {
            description = descMatch[1].trim();
        }
        if (codeMatch) {
            pythonCode = codeMatch[1].trim();
            // Remove any code fences that might be inside the XML tag
            pythonCode = pythonCode.replace(/^```(?:python|py)?\s*\n?/i, "").replace(/\n?```\s*$/, "");
        } else {
            // Fallback: look for code blocks if XML format not found
            const codeBlockMatch = fullText.match(/```python\s*([\s\S]+?)```/i) ||
                fullText.match(/```\s*([\s\S]+?)```/i);
            if (codeBlockMatch) {
                pythonCode = codeBlockMatch[1].trim();
                log("ANTHROPIC", "WARNING: XML format not found, using code block fallback");
            } else {
                // Last resort: check if there's an incomplete code block at the end
                const incompleteCodeMatch = fullText.match(/```python\s*([\s\S]+)$/i) ||
                    fullText.match(/```\s*([\s\S]+)$/i);
                if (incompleteCodeMatch) {
                    pythonCode = incompleteCodeMatch[1].trim();
                    log("ANTHROPIC", "WARNING: Code block appears incomplete (no closing ```)");
                } else {
                    // Use entire text as code if no structured format found
                    pythonCode = fullText.trim();
                    log("ANTHROPIC", "WARNING: No structured format found, using entire text as code");
                }
            }
        }

        // If title/description not found, generate fallbacks
        if (!title) {
            const date = new Date();
            title = `Claude's Animation - ${date.toLocaleDateString()}`;
            log("ANTHROPIC", "No title found in response, using fallback");
        }
        if (!description) {
            description = "AI-generated LED animation expressing Claude's current thoughts and feelings.";
            log("ANTHROPIC", "No description found in response, using fallback");
        }

        log("ANTHROPIC", "=== CLAUDE'S TITLE ===");
        log("ANTHROPIC", title);
        log("ANTHROPIC", "=== CLAUDE'S DESCRIPTION ===");
        log("ANTHROPIC", description);
        log("ANTHROPIC", "=== CLAUDE'S FULL TEXT RESPONSE ===");
        log("ANTHROPIC", fullText);
        log("ANTHROPIC", "=== END FULL TEXT ===");
        log("ANTHROPIC", "=== EXTRACTED CODE (before cleanup) ===");
        log("ANTHROPIC", pythonCode);
        log("ANTHROPIC", "=== END EXTRACTED CODE ===");

        // Check if code appears to be truncated or incomplete
        if (pythonCode.length < 50 || pythonCode.split('\n').length < 3) {
            log("ANTHROPIC", "WARNING: Extracted code appears suspiciously short or incomplete");
            log("ANTHROPIC", `Code length: ${pythonCode.length}, Lines: ${pythonCode.split('\n').length}`);
            // If code is too short, it's likely truncated - throw error to trigger retry
            throw new Error(`Claude's response appears truncated. Code is only ${pythonCode.length} characters and ${pythonCode.split('\n').length} lines. Expected a complete Python program.`);
        }

        log("ANTHROPIC", "=== FINAL PYTHON CODE ===");
        log("ANTHROPIC", pythonCode);
        log("ANTHROPIC", "=== END PYTHON CODE ===");

        return { title, description, pythonCode };

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
// MAIN CRON JOB LOGIC
// ============================================================================

async function executeCronJob() {
    log("CRON", "========================================");
    log("CRON", "STARTING CRON JOB EXECUTION");
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
3. Write a Python program that creates a COMPLEX and visually interesting LED animation expressing these feelings

The LED animation will run on an Arduino with 60 LEDs arranged in a ring.

${LED_LANGUAGE_EXPLANATION}

IMPORTANT: You must provide your response in the following XML format:

<claude_response>
<title>A short, descriptive title for this animation (max 50 characters)</title>
<description>A detailed description (2-4 sentences, up to 500 characters) that explains:
- What this animation represents visually
- What emotions, thoughts, or current events inspired it
- Why you chose this particular pattern, color scheme, and animation style
- What makes this animation interesting or meaningful
Make it detailed and thoughtful!</description>
<code>
Your complete Python 3 program here
</code>
</claude_response>

CRITICAL REQUIREMENTS:
- Create COMPLEX and sophisticated patterns - use multiple effects, color transitions, wave patterns, pulsing, rotating elements, etc.
- Don't make simple static colors or basic patterns - be creative and ambitious!
- Use multiple colors, gradients, and dynamic effects that change over time
- Make the animation visually striking and engaging
- Your Python program should ONLY output the LED frame data (lines of 60 comma-separated hex colors). No other text should be in the output.
- Each frame is one line with exactly 60 colors separated by commas
- Each color must be in format #RRGGBB (e.g., #FF0000)

The title and description are required and will be displayed to users, so make them meaningful, descriptive, and include your reasoning for why you created this particular animation.`;

    log("CRON", "Prompt created successfully");

    // Step 2: Call Claude API
    let claudeResponse: { title: string; description: string; pythonCode: string };
    try {
        log("CRON", "Step 2: Calling Claude API");
        claudeResponse = await callClaude(prompt);
    } catch (error) {
        logError("CRON", "Failed to get response from Claude after all retries", error);
        // Even on error, provide fallback values
        const date = new Date();
        throw new Error(`Claude API call failed. Title: "Claude's Animation - ${date.toLocaleDateString()}", Description: "Failed to generate animation due to API error"`);
    }

    // Step 3: Execute and validate the script (with retry logic)
    log("CRON", "Step 3: Executing and validating Python code");
    let executionResult = await executeAndValidateScript({
        title: claudeResponse.title,
        description: claudeResponse.description,
        pythonCode: claudeResponse.pythonCode
    });

    let retryAttempt = 0;
    const MAX_RETRY_ATTEMPTS = MAX_RETRIES;

    // If execution or validation failed, ask Claude to fix it
    while (!executionResult.success && retryAttempt < MAX_RETRY_ATTEMPTS) {
        retryAttempt++;
        log("CRON", `Script execution/validation failed (attempt ${retryAttempt}/${MAX_RETRY_ATTEMPTS}), asking Claude to fix...`);
        log("CRON", `Error: ${executionResult.error}`);

        const fixPrompt = `Your Python program had an issue:

${executionResult.error}

Here was your previous code:
\`\`\`python
${claudeResponse.pythonCode}
\`\`\`

Please fix the error and provide a corrected response in the following XML format:

<claude_response>
<title>${claudeResponse.title}</title>
<description>${claudeResponse.description}</description>
<code>
Your corrected Python program here
</code>
</claude_response>

Remember:
- The program should ONLY output LED frame data (lines of 60 comma-separated hex colors starting with #)
- Each frame is one line
- Each line has exactly 60 colors separated by commas
- No explanatory text in the output
- Each color must be in format #RRGGBB (e.g., #FF0000)
- Keep the same title and description unless you want to update them`;

        claudeResponse = await callClaude(fixPrompt);
        executionResult = await executeAndValidateScript({
            title: claudeResponse.title,
            description: claudeResponse.description,
            pythonCode: claudeResponse.pythonCode
        });
    }

    // If still failed after all retries, save with empty frames
    if (!executionResult.success) {
        log("CRON", "WARNING: Failed to generate valid LED output after all retries");
        log("CRON", `Final error: ${executionResult.error}`);

        const scriptName = claudeResponse.title;
        const scriptDescription = `${claudeResponse.description} (Note: Failed - ${executionResult.error})`;

        await saveScript(
            scriptName,
            scriptDescription,
            claudeResponse.pythonCode,
            [], // Empty frames array
            "claude",
            undefined, // No reasoning field
            false // Don't set as active if it failed
        );

        throw new Error(`Failed to generate valid LED output after all retries: ${executionResult.error}`);
    }

    const frames = executionResult.frames || [];

    // Step 4: Log final results
    log("CRON", "========================================");
    log("CRON", "CRON JOB COMPLETED SUCCESSFULLY");
    log("CRON", "========================================");
    log("CRON", `Generated ${frames.length} valid LED animation frames`);
    log("CRON", "");
    log("CRON", "=== FINAL PYTHON PROGRAM ===");
    console.log(claudeResponse.pythonCode);
    log("CRON", "");
    log("CRON", "=== LED ANIMATION OUTPUT (first 3 frames) ===");
    frames.slice(0, 3).forEach((frame, i) => {
        const framePreview = `Frame ${i + 1}: ${frame.substring(0, 100)}...`;
        console.log(framePreview);
    });
    log("CRON", `... (${frames.length} total frames)`);
    log("CRON", "");
    log("CRON", "========================================");

    // Use Claude-provided title and description
    const scriptName = claudeResponse.title;
    const scriptDescription = claudeResponse.description;

    // Save script to database
    log("CRON", "Saving script to database");
    log("CRON", `Script name: ${scriptName}`);
    log("CRON", `Script description: ${scriptDescription}`);
    await saveScript(
        scriptName,
        scriptDescription,
        claudeResponse.pythonCode,
        frames,
        "claude",
        undefined, // No reasoning field
        true // Set as active by default
    );
    log("CRON", "Script saved successfully");

    return {
        success: true,
        pythonCode: claudeResponse.pythonCode,
        frameCount: frames.length,
        sampleFrames: frames.slice(0, 3)
    };
}

// ============================================================================
// API ROUTE HANDLER
// ============================================================================

export async function GET() {
    log("API", "Cron job triggered");

    // Verify environment variables are set
    if (!ANTHROPIC_API_KEY) {
        logError("API", "ANTHROPIC_API_KEY environment variable not set", null);
        return NextResponse.json(
            { error: "Server configuration error: Missing ANTHROPIC_API_KEY" },
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

        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Unknown error occurred",
                details: error
            },
            { status: 500 }
        );
    }
}



