// Storage abstraction layer - Uses Neon Postgres database
import { neon } from "@neondatabase/serverless";
import type { ClaudeFrameData, LEDStateData } from "./state";

// ============================================================================
// CONFIGURATION
// ============================================================================

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
    throw new Error("DATABASE_URL environment variable is required");
}

let dbInitialized = false;

// ============================================================================
// DATABASE FUNCTIONS
// ============================================================================

async function initializeDatabase(): Promise<void> {
    if (dbInitialized) return;

    try {
        console.log("[STORAGE:DEBUG] Initializing database connection...");
        const sql = neon(DATABASE_URL!);

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

        console.log("[STORAGE:DEBUG] ✅ Database initialized successfully");
        dbInitialized = true;
    } catch (error) {
        console.error("[STORAGE:DEBUG] ❌ Failed to initialize database:", error);
        throw new Error(`Database initialization failed: ${error instanceof Error ? error.message : String(error)}`);
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

    try {
        const sql = neon(DATABASE_URL!);
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
        console.log("[STORAGE:DEBUG] ✅ Saved Claude frames to database");
    } catch (error) {
        console.error("[STORAGE:DEBUG] ❌ Failed to save Claude frames to database:", error);
        throw new Error(`Failed to save Claude frames: ${error instanceof Error ? error.message : String(error)}`);
    }
}

export async function getClaudeFrames(): Promise<ClaudeFrameData | null> {
    await initializeDatabase();

    try {
        const sql = neon(DATABASE_URL!);
        const result = await sql`
            SELECT frames, reasoning, python_code, frame_count, created_at
            FROM claude_frames
            ORDER BY created_at DESC
            LIMIT 1
        `;

        if (result.length === 0) {
            console.log("[STORAGE:DEBUG] No Claude frames found in database");
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

        console.log("[STORAGE:DEBUG] ✅ Loaded Claude frames from database:", {
            frameCount: data.frameCount,
            timestamp: data.timestamp,
        });
        return data;
    } catch (error) {
        console.error("[STORAGE:DEBUG] ❌ Failed to read Claude frames from database:", error);
        throw new Error(`Failed to get Claude frames: ${error instanceof Error ? error.message : String(error)}`);
    }
}

// ============================================================================
// LED STATE STORAGE
// ============================================================================

export async function saveLEDState(mode: string, data: Record<string, unknown>): Promise<void> {
    const timestamp = new Date().toISOString();

    await initializeDatabase();

    try {
        const sql = neon(DATABASE_URL!);
        await sql`
            UPDATE led_state
            SET mode = ${mode},
                data = ${JSON.stringify(data)}::jsonb,
                updated_at = ${timestamp}::timestamp
            WHERE id = 1
        `;
        console.log("[STORAGE:DEBUG] ✅ Saved LED state to database");
    } catch (error) {
        console.error("[STORAGE:DEBUG] ❌ Failed to save LED state to database:", error);
        throw new Error(`Failed to save LED state: ${error instanceof Error ? error.message : String(error)}`);
    }
}

export async function getLEDState(): Promise<LEDStateData | null> {
    await initializeDatabase();

    try {
        const sql = neon(DATABASE_URL!);
        const result = await sql`
            SELECT mode, data, updated_at
            FROM led_state
            WHERE id = 1
        `;

        if (result.length === 0) {
            console.log("[STORAGE:DEBUG] No LED state found in database");
            return null;
        }

        const row = result[0];
        const data: LEDStateData = {
            mode: row.mode as string,
            data: row.data as Record<string, unknown>,
            timestamp: row.updated_at as string,
        };

        console.log("[STORAGE:DEBUG] ✅ Loaded LED state from database");
        return data;
    } catch (error) {
        console.error("[STORAGE:DEBUG] ❌ Failed to read LED state from database:", error);
        throw new Error(`Failed to get LED state: ${error instanceof Error ? error.message : String(error)}`);
    }
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
        usingDatabase: true,
        databaseConfigured: true,
    };
}

