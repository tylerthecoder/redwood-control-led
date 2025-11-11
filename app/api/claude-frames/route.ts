import { NextResponse } from "next/server";
import { getAllClaudeFrames, getActiveClaudeFrames } from "./state";

export async function GET() {
    try {
        const scripts = await getAllClaudeFrames();
        const active = await getActiveClaudeFrames();

        return NextResponse.json({
            scripts,
            activeId: active?.id || null,
        });
    } catch (error) {
        console.error("Error fetching Claude frames:", error);
        return NextResponse.json(
            {
                error: "Failed to fetch Claude scripts",
                message: error instanceof Error ? error.message : String(error),
            },
            { status: 500 }
        );
    }
}

