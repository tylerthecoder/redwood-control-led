// Storage abstraction layer - Uses Neon Postgres with file system fallback
import { neon } from "@neondatabase/serverless";
import fs from "fs";
import path from "path";
import type { ClaudeFrameData, LEDStateData } from "./state";

// ============================================================================
// CONFIGURATION
// ============================================================================

const DATABASE_URL = process.env.DATABASE_URL || "";
const CLAUDE_FRAMES_FILE = path.join(process.cwd(), "data", "claude-frames.json");
const LED_STATE_FILE = path.join(process.cwd(), "data", "led-state.json");

let useDatabase = false;
let dbInitialized = false;

// ============================================================================
// DATABASE FUNCTIONS
// ============================================================================

async function initializeDatabase(): Promise<boolean> {
    if (dbInitialized) return useDatabase;

    if (!DATABASE_URL) {
        console.log("[STORAGE:DEBUG] No DATABASE_URL found, using FILE SYSTEM fallback");
        dbInitialized = true;
        useDatabase = false;
        return false;
    }

    try {
        console.log("[STORAGE:DEBUG] Attempting to connect to DATABASE...");
        const sql = neon(DATABASE_URL);

        // Create tables if they don't exist
        await sql`
            CREATE TABLE IF NOT EXISTS claude_frames (
                id SERIAL PRIMARY KEY,
                frames JSONB NOT NULL,
                reasoning TEXT,
                python_code TEXT,
                frame_count INTEGER NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `;

        await sql`
            CREATE TABLE IF NOT EXISTS led_state (
                id INTEGER PRIMARY KEY DEFAULT 1,
                mode TEXT NOT NULL,
                data JSONB NOT NULL,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT single_row CHECK (id = 1)
            )
        `;

        // Insert initial LED state if not exists
        await sql`
            INSERT INTO led_state (id, mode, data)
            VALUES (1, 'simple', '{"on": false, "color": "#0000FF"}'::jsonb)
            ON CONFLICT (id) DO NOTHING
        `;

        console.log("[STORAGE:DEBUG] ✅ DATABASE initialized successfully - using DATABASE storage");
        useDatabase = true;
        dbInitialized = true;
        return true;
    } catch (error) {
        console.error("[STORAGE:DEBUG] ❌ Failed to initialize database:", error);
        console.log("[STORAGE:DEBUG] Falling back to FILE SYSTEM storage");
        useDatabase = false;
        dbInitialized = true;
        return false;
    }
}

// ============================================================================
// FILE SYSTEM FALLBACK FUNCTIONS
// ============================================================================

function ensureDataDirectory() {
    const dataDir = path.join(process.cwd(), "data");
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }
}

function saveToFile(filePath: string, data: unknown) {
    ensureDataDirectory();
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
}

function readFromFile<T>(filePath: string): T | null {
    try {
        if (!fs.existsSync(filePath)) {
            return null;
        }
        const data = fs.readFileSync(filePath, "utf-8");
        return JSON.parse(data);
    } catch (error) {
        console.error(`[STORAGE] Error reading file ${filePath}:`, error);
        return null;
    }
}

// ============================================================================
// CLAUDE FRAMES STORAGE
// ============================================================================

export async function saveClaudeFrames(
    frames: string[],
    reasoning: string,
    pythonCode: string
): Promise<void> {
    const timestamp = new Date().toISOString();
    const frameCount = frames.length;

    await initializeDatabase();

    console.log(`[STORAGE:DEBUG] Saving Claude frames using: ${useDatabase ? "DATABASE" : "FILE SYSTEM"}`);

    if (useDatabase) {
        try {
            const sql = neon(DATABASE_URL);
            await sql`
                INSERT INTO claude_frames (frames, reasoning, python_code, frame_count, created_at)
                VALUES (
                    ${JSON.stringify(frames)}::jsonb,
                    ${reasoning},
                    ${pythonCode},
                    ${frameCount},
                    ${timestamp}::timestamp
                )
            `;
            console.log("[STORAGE:DEBUG] ✅ Saved Claude frames to DATABASE");
            return;
        } catch (error) {
            console.error("[STORAGE:DEBUG] ❌ Failed to save to database, falling back to file:", error);
        }
    }

    // File system fallback
    const data: ClaudeFrameData = {
        frames,
        reasoning,
        pythonCode,
        timestamp,
        frameCount,
    };
    saveToFile(CLAUDE_FRAMES_FILE, data);
    console.log("[STORAGE:DEBUG] ✅ Saved Claude frames to FILE SYSTEM:", CLAUDE_FRAMES_FILE);
}

export async function getClaudeFrames(): Promise<ClaudeFrameData | null> {
    await initializeDatabase();

    console.log(`[STORAGE:DEBUG] Fetching Claude frames from: ${useDatabase ? "DATABASE" : "FILE SYSTEM"}`);

    if (useDatabase) {
        try {
            const sql = neon(DATABASE_URL);
            const result = await sql`
                SELECT frames, reasoning, python_code, frame_count, created_at
                FROM claude_frames
                ORDER BY created_at DESC
                LIMIT 1
            `;

            if (result.length === 0) {
                console.log("[STORAGE:DEBUG] No Claude frames found in DATABASE");
                return null;
            }

            const row = result[0];
            const data: ClaudeFrameData = {
                frames: row.frames as string[],
                reasoning: row.reasoning as string,
                pythonCode: row.python_code as string,
                timestamp: row.created_at as string,
                frameCount: row.frame_count as number,
            };

            console.log("[STORAGE:DEBUG] ✅ Loaded Claude frames from DATABASE:", {
                frameCount: data.frameCount,
                timestamp: data.timestamp,
            });
            return data;
        } catch (error) {
            console.error("[STORAGE:DEBUG] ❌ Failed to read from database, falling back to file:", error);
        }
    }

    // File system fallback
    const data = readFromFile<ClaudeFrameData>(CLAUDE_FRAMES_FILE);
    if (data) {
        console.log("[STORAGE:DEBUG] ✅ Loaded Claude frames from FILE SYSTEM:", {
            frameCount: data.frameCount,
            timestamp: data.timestamp,
        });
    } else {
        console.log("[STORAGE:DEBUG] No Claude frames found in FILE SYSTEM");
    }
    return data;
}

// ============================================================================
// LED STATE STORAGE
// ============================================================================

export async function saveLEDState(mode: string, data: Record<string, unknown>): Promise<void> {
    const timestamp = new Date().toISOString();

    await initializeDatabase();

    console.log(`[STORAGE:DEBUG] Saving LED state using: ${useDatabase ? "DATABASE" : "FILE SYSTEM"}`);

    if (useDatabase) {
        try {
            const sql = neon(DATABASE_URL);
            await sql`
                UPDATE led_state
                SET mode = ${mode},
                    data = ${JSON.stringify(data)}::jsonb,
                    updated_at = ${timestamp}::timestamp
                WHERE id = 1
            `;
            console.log("[STORAGE:DEBUG] ✅ Saved LED state to DATABASE");
            return;
        } catch (error) {
            console.error("[STORAGE:DEBUG] ❌ Failed to save LED state to database, falling back to file:", error);
        }
    }

    // File system fallback
    const stateData: LEDStateData = {
        mode,
        data,
        timestamp,
    };
    saveToFile(LED_STATE_FILE, stateData);
    console.log("[STORAGE:DEBUG] ✅ Saved LED state to FILE SYSTEM:", LED_STATE_FILE);
}

export async function getLEDState(): Promise<LEDStateData | null> {
    await initializeDatabase();

    console.log(`[STORAGE:DEBUG] Fetching LED state from: ${useDatabase ? "DATABASE" : "FILE SYSTEM"}`);

    if (useDatabase) {
        try {
            const sql = neon(DATABASE_URL);
            const result = await sql`
                SELECT mode, data, updated_at
                FROM led_state
                WHERE id = 1
            `;

            if (result.length === 0) {
                console.log("[STORAGE:DEBUG] No LED state found in DATABASE");
                return null;
            }

            const row = result[0];
            const data: LEDStateData = {
                mode: row.mode as string,
                data: row.data as Record<string, unknown>,
                timestamp: row.updated_at as string,
            };

            console.log("[STORAGE:DEBUG] ✅ Loaded LED state from DATABASE");
            return data;
        } catch (error) {
            console.error("[STORAGE:DEBUG] ❌ Failed to read LED state from database, falling back to file:", error);
        }
    }

    // File system fallback
    const data = readFromFile<LEDStateData>(LED_STATE_FILE);
    if (data) {
        console.log("[STORAGE:DEBUG] ✅ Loaded LED state from FILE SYSTEM");
    } else {
        console.log("[STORAGE:DEBUG] No LED state found in FILE SYSTEM");
    }
    return data;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

export async function getStorageInfo(): Promise<{
    usingDatabase: boolean;
    databaseConfigured: boolean;
}> {
    await initializeDatabase();
    return {
        usingDatabase: useDatabase,
        databaseConfigured: !!DATABASE_URL,
    };
}

