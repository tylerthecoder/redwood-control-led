// Storage abstraction layer - Uses Neon Postgres database
import { neon } from "@neondatabase/serverless";
import type { Script } from "./model";

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

export async function getDatabaseConnection() {
    if (dbInitialized) {
        return neon(DATABASE_URL!);
    }

    try {
        console.log("[STORAGE:DEBUG] Initializing database connection...");
        const sql = neon(DATABASE_URL!);

        // Create unified scripts table
        console.log("[STORAGE:DEBUG] Setting up unified scripts table");
        await sql`
            CREATE TABLE IF NOT EXISTS scripts (
                id SERIAL PRIMARY KEY,
                title TEXT NOT NULL,
                description TEXT NOT NULL,
                python_code TEXT NOT NULL,
                frames JSONB NOT NULL,
                frame_count INTEGER NOT NULL,
                framerate INTEGER NOT NULL DEFAULT 60,
                created_by TEXT NOT NULL CHECK (created_by IN ('user', 'claude')),
                reasoning TEXT,
                is_active BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `;

        // Check if framerate column exists, add it if missing
        const framerateColumnExists = await sql`
            SELECT column_name
            FROM information_schema.columns
            WHERE table_name = 'scripts' AND column_name = 'framerate'
        `;

        if (framerateColumnExists.length === 0) {
            console.log("[STORAGE:DEBUG] Adding framerate column to scripts table");
            await sql`
                ALTER TABLE scripts
                ADD COLUMN framerate INTEGER NOT NULL DEFAULT 60
            `;
        }

        // Create index for active script lookup
        await sql`
            CREATE INDEX IF NOT EXISTS idx_scripts_active ON scripts(is_active) WHERE is_active = TRUE
        `;

        // Create index for created_by lookup
        await sql`
            CREATE INDEX IF NOT EXISTS idx_scripts_created_by ON scripts(created_by)
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
        return sql;
    } catch (error) {
        console.error("[STORAGE:DEBUG] ❌ Failed to initialize database:", error);
        throw new Error(`Database initialization failed: ${error instanceof Error ? error.message : String(error)}`);
    }
}

async function initializeDatabase(): Promise<void> {
    await getDatabaseConnection();
}

// ============================================================================
// UNIFIED SCRIPTS STORAGE
// ============================================================================

export async function saveScript(
    title: string,
    description: string,
    pythonCode: string,
    frames: string[],
    createdBy: "user" | "claude",
    reasoning?: string,
    setAsActive: boolean = false,
    framerate: number = 60
): Promise<number> {
    const timestamp = new Date().toISOString();
    const frameCount = frames.length;

    const sql = await getDatabaseConnection();

    try {

        // If setting as active, first deactivate all other scripts
        if (setAsActive) {
            await sql`UPDATE scripts SET is_active = FALSE`;
        }

        const result = await sql`
            INSERT INTO scripts (title, description, python_code, frames, frame_count, framerate, created_by, reasoning, is_active, created_at)
            VALUES (
                ${title},
                ${description},
                ${pythonCode},
                ${JSON.stringify(frames)}::jsonb,
                ${frameCount},
                ${framerate},
                ${createdBy},
                ${reasoning || null},
                ${setAsActive},
                ${timestamp}::timestamp
            )
            RETURNING id
        `;

        const scriptId = result[0].id as number;
        console.log("[STORAGE:DEBUG] ✅ Saved script to database with ID:", scriptId);
        return scriptId;
    } catch (error) {
        console.error("[STORAGE:DEBUG] ❌ Failed to save script to database:", error);
        throw new Error(`Failed to save script: ${error instanceof Error ? error.message : String(error)}`);
    }
}

export async function getAllScripts(): Promise<Script[]> {
    const sql = await getDatabaseConnection();

    try {
        const result = await sql`
            SELECT id, title, description, python_code, frames, frame_count, framerate, created_by, reasoning, is_active, created_at
            FROM scripts
            ORDER BY created_at DESC
        `;

        const scripts: Script[] = result.map((row) => ({
            id: row.id as number,
            title: row.title as string,
            description: row.description as string,
            pythonCode: row.python_code as string,
            frames: row.frames as string[],
            frameCount: row.frame_count as number,
            framerate: (row.framerate as number) || 60,
            createdBy: row.created_by as "user" | "claude",
            reasoning: row.reasoning as string | undefined,
            isActive: row.is_active as boolean,
            timestamp: row.created_at as string,
        }));

        console.log("[STORAGE:DEBUG] ✅ Loaded all scripts from database:", scripts.length);
        return scripts;
    } catch (error) {
        console.error("[STORAGE:DEBUG] ❌ Failed to read scripts from database:", error);
        throw new Error(`Failed to get scripts: ${error instanceof Error ? error.message : String(error)}`);
    }
}

export async function getScriptById(id: number): Promise<Script | null> {
    const sql = await getDatabaseConnection();

    try {
        const result = await sql`
            SELECT id, title, description, python_code, frames, frame_count, framerate, created_by, reasoning, is_active, created_at
            FROM scripts
            WHERE id = ${id}
        `;

        if (result.length === 0) {
            console.log("[STORAGE:DEBUG] No script found with ID:", id);
            return null;
        }

        const row = result[0];
        const script: Script = {
            id: row.id as number,
            title: row.title as string,
            description: row.description as string,
            pythonCode: row.python_code as string,
            frames: row.frames as string[],
            frameCount: row.frame_count as number,
            framerate: (row.framerate as number) || 60,
            createdBy: row.created_by as "user" | "claude",
            reasoning: row.reasoning as string | undefined,
            isActive: row.is_active as boolean,
            timestamp: row.created_at as string,
        };

        console.log("[STORAGE:DEBUG] ✅ Loaded script from database:", script.id);
        return script;
    } catch (error) {
        console.error("[STORAGE:DEBUG] ❌ Failed to read script from database:", error);
        throw new Error(`Failed to get script: ${error instanceof Error ? error.message : String(error)}`);
    }
}

export async function getActiveScript(): Promise<Script | null> {
    const sql = await getDatabaseConnection();

    try {
        const result = await sql`
            SELECT id, title, description, python_code, frames, frame_count, framerate, created_by, reasoning, is_active, created_at
            FROM scripts
            WHERE is_active = TRUE
            LIMIT 1
        `;

        if (result.length === 0) {
            console.log("[STORAGE:DEBUG] No active script found in database");
            return null;
        }

        const row = result[0];
        const script: Script = {
            id: row.id as number,
            title: row.title as string,
            description: row.description as string,
            pythonCode: row.python_code as string,
            frames: row.frames as string[],
            frameCount: row.frame_count as number,
            framerate: (row.framerate as number) || 60,
            createdBy: row.created_by as "user" | "claude",
            reasoning: row.reasoning as string | undefined,
            isActive: row.is_active as boolean,
            timestamp: row.created_at as string,
        };

        console.log("[STORAGE:DEBUG] ✅ Loaded active script from database");
        return script;
    } catch (error) {
        console.error("[STORAGE:DEBUG] ❌ Failed to read active script from database:", error);
        throw new Error(`Failed to get active script: ${error instanceof Error ? error.message : String(error)}`);
    }
}

export async function setActiveScript(id: number): Promise<void> {
    const sql = await getDatabaseConnection();

    try {

        // First deactivate all scripts
        await sql`UPDATE scripts SET is_active = FALSE`;

        // Then activate the specified script
        await sql`
            UPDATE scripts
            SET is_active = TRUE
            WHERE id = ${id}
        `;

        console.log("[STORAGE:DEBUG] ✅ Set script as active:", id);
    } catch (error) {
        console.error("[STORAGE:DEBUG] ❌ Failed to set active script:", error);
        throw new Error(`Failed to set active script: ${error instanceof Error ? error.message : String(error)}`);
    }
}

export async function deleteScript(id: number): Promise<void> {
    const sql = await getDatabaseConnection();

    try {
        await sql`
            DELETE FROM scripts
            WHERE id = ${id}
        `;

        console.log("[STORAGE:DEBUG] ✅ Deleted script:", id);
    } catch (error) {
        console.error("[STORAGE:DEBUG] ❌ Failed to delete script:", error);
        throw new Error(`Failed to delete script: ${error instanceof Error ? error.message : String(error)}`);
    }
}

export async function updateScript(
    id: number,
    title: string,
    description: string,
    pythonCode: string,
    frames: string[],
    framerate: number = 60
): Promise<void> {
    const frameCount = frames.length;

    const sql = await getDatabaseConnection();

    try {
        await sql`
            UPDATE scripts
            SET title = ${title},
                description = ${description},
                python_code = ${pythonCode},
                frames = ${JSON.stringify(frames)}::jsonb,
                frame_count = ${frameCount},
                framerate = ${framerate}
            WHERE id = ${id}
        `;

        console.log("[STORAGE:DEBUG] ✅ Updated script:", id);
    } catch (error) {
        console.error("[STORAGE:DEBUG] ❌ Failed to update script:", error);
        throw new Error(`Failed to update script: ${error instanceof Error ? error.message : String(error)}`);
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

