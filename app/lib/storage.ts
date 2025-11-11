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

        // Check if table exists
        const tableExists = await sql`
            SELECT table_name
            FROM information_schema.tables
            WHERE table_name = 'claude_frames'
        `;

        if (tableExists.length === 0) {
            // Create table with full schema (new installation)
            console.log("[STORAGE:DEBUG] Creating claude_frames table with full schema");
            await sql`
                CREATE TABLE claude_frames (
                    id SERIAL PRIMARY KEY,
                    name TEXT NOT NULL,
                    description TEXT NOT NULL,
                    frames JSONB NOT NULL,
                    reasoning TEXT,
                    python_code TEXT,
                    frame_count INTEGER NOT NULL,
                    is_active BOOLEAN DEFAULT FALSE,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `;
        } else {
            // Table exists - check if migration is needed
            const nameColumnExists = await sql`
                SELECT column_name
                FROM information_schema.columns
                WHERE table_name = 'claude_frames' AND column_name = 'name'
            `;

            if (nameColumnExists.length === 0) {
                // Migrate existing table: add new columns
                console.log("[STORAGE:DEBUG] Migrating: Adding name, description, and is_active columns");
                await sql`
                    ALTER TABLE claude_frames
                    ADD COLUMN name TEXT,
                    ADD COLUMN description TEXT,
                    ADD COLUMN is_active BOOLEAN DEFAULT FALSE
                `;

                // Set default values for existing rows
                await sql`
                    UPDATE claude_frames
                    SET name = 'Claude Animation ' || id::text,
                        description = 'AI-generated LED animation with ' || frame_count::text || ' frames',
                        is_active = FALSE
                    WHERE name IS NULL
                `;

                // Make name and description NOT NULL after setting defaults
                await sql`
                    ALTER TABLE claude_frames
                    ALTER COLUMN name SET NOT NULL,
                    ALTER COLUMN description SET NOT NULL
                `;
            }
        }

        // Create index for active script lookup
        await sql`
            CREATE INDEX IF NOT EXISTS idx_claude_frames_active ON claude_frames(is_active) WHERE is_active = TRUE
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
    name: string,
    description: string,
    frames: string[],
    reasoning: string,
    pythonCode: string,
    setAsActive: boolean = false
): Promise<number> {
    const timestamp = new Date().toISOString();
    const frameCount = frames.length;

    await initializeDatabase();

    try {
        const sql = neon(DATABASE_URL!);

        // If setting as active, first deactivate all other scripts
        if (setAsActive) {
            await sql`UPDATE claude_frames SET is_active = FALSE`;
        }

        const result = await sql`
            INSERT INTO claude_frames (name, description, frames, reasoning, python_code, frame_count, is_active, created_at)
            VALUES (
                ${name},
                ${description},
                ${JSON.stringify(frames)}::jsonb,
                ${reasoning},
                ${pythonCode},
                ${frameCount},
                ${setAsActive},
                ${timestamp}::timestamp
            )
            RETURNING id
        `;

        const scriptId = result[0].id as number;
        console.log("[STORAGE:DEBUG] ✅ Saved Claude frames to database with ID:", scriptId);
        return scriptId;
    } catch (error) {
        console.error("[STORAGE:DEBUG] ❌ Failed to save Claude frames to database:", error);
        throw new Error(`Failed to save Claude frames: ${error instanceof Error ? error.message : String(error)}`);
    }
}

export async function getAllClaudeFrames(): Promise<ClaudeFrameData[]> {
    await initializeDatabase();

    try {
        const sql = neon(DATABASE_URL!);
        const result = await sql`
            SELECT id, name, description, frames, reasoning, python_code, frame_count, is_active, created_at
            FROM claude_frames
            ORDER BY created_at DESC
        `;

        const scripts: ClaudeFrameData[] = result.map((row) => ({
            id: row.id as number,
            name: row.name as string,
            description: row.description as string,
            frames: row.frames as string[],
            reasoning: row.reasoning as string,
            pythonCode: row.python_code as string,
            timestamp: row.created_at as string,
            frameCount: row.frame_count as number,
            isActive: row.is_active as boolean,
        }));

        console.log("[STORAGE:DEBUG] ✅ Loaded all Claude frames from database:", scripts.length);
        return scripts;
    } catch (error) {
        console.error("[STORAGE:DEBUG] ❌ Failed to read Claude frames from database:", error);
        throw new Error(`Failed to get Claude frames: ${error instanceof Error ? error.message : String(error)}`);
    }
}

export async function getClaudeFramesById(id: number): Promise<ClaudeFrameData | null> {
    await initializeDatabase();

    try {
        const sql = neon(DATABASE_URL!);
        const result = await sql`
            SELECT id, name, description, frames, reasoning, python_code, frame_count, is_active, created_at
            FROM claude_frames
            WHERE id = ${id}
        `;

        if (result.length === 0) {
            console.log("[STORAGE:DEBUG] No Claude frames found with ID:", id);
            return null;
        }

        const row = result[0];
        const data: ClaudeFrameData = {
            id: row.id as number,
            name: row.name as string,
            description: row.description as string,
            frames: row.frames as string[],
            reasoning: row.reasoning as string,
            pythonCode: row.python_code as string,
            timestamp: row.created_at as string,
            frameCount: row.frame_count as number,
            isActive: row.is_active as boolean,
        };

        console.log("[STORAGE:DEBUG] ✅ Loaded Claude frames from database:", data.id);
        return data;
    } catch (error) {
        console.error("[STORAGE:DEBUG] ❌ Failed to read Claude frames from database:", error);
        throw new Error(`Failed to get Claude frames: ${error instanceof Error ? error.message : String(error)}`);
    }
}

export async function getActiveClaudeFrames(): Promise<ClaudeFrameData | null> {
    await initializeDatabase();

    try {
        const sql = neon(DATABASE_URL!);
        const result = await sql`
            SELECT id, name, description, frames, reasoning, python_code, frame_count, is_active, created_at
            FROM claude_frames
            WHERE is_active = TRUE
            LIMIT 1
        `;

        if (result.length === 0) {
            console.log("[STORAGE:DEBUG] No active Claude frames found in database");
            return null;
        }

        const row = result[0];
        const data: ClaudeFrameData = {
            id: row.id as number,
            name: row.name as string,
            description: row.description as string,
            frames: row.frames as string[],
            reasoning: row.reasoning as string,
            pythonCode: row.python_code as string,
            timestamp: row.created_at as string,
            frameCount: row.frame_count as number,
            isActive: row.is_active as boolean,
        };

        console.log("[STORAGE:DEBUG] ✅ Loaded active Claude frames from database");
        return data;
    } catch (error) {
        console.error("[STORAGE:DEBUG] ❌ Failed to read active Claude frames from database:", error);
        throw new Error(`Failed to get active Claude frames: ${error instanceof Error ? error.message : String(error)}`);
    }
}

export async function setActiveClaudeFrames(id: number): Promise<void> {
    await initializeDatabase();

    try {
        const sql = neon(DATABASE_URL!);

        // First deactivate all scripts
        await sql`UPDATE claude_frames SET is_active = FALSE`;

        // Then activate the specified script
        await sql`
            UPDATE claude_frames
            SET is_active = TRUE
            WHERE id = ${id}
        `;

        console.log("[STORAGE:DEBUG] ✅ Set Claude frames as active:", id);
    } catch (error) {
        console.error("[STORAGE:DEBUG] ❌ Failed to set active Claude frames:", error);
        throw new Error(`Failed to set active Claude frames: ${error instanceof Error ? error.message : String(error)}`);
    }
}

// Legacy function for backward compatibility - returns active script or latest
export async function getClaudeFrames(): Promise<ClaudeFrameData | null> {
    const active = await getActiveClaudeFrames();
    if (active) return active;

    // If no active script, return the latest one
    const all = await getAllClaudeFrames();
    return all.length > 0 ? all[0] : null;
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

