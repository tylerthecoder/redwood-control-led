import { NextResponse } from "next/server";
import { getClaudeFrames } from "./state";

export async function GET() {
    const state = await getClaudeFrames();

    if (!state) {
        return NextResponse.json(
            {
                error: "No Claude-generated frames available yet",
                message: "The cron job hasn't generated any animations yet. Wait for it to run or trigger it manually."
            },
            { status: 404 }
        );
    }

    return NextResponse.json({
        frames: state.frames,
        reasoning: state.reasoning,
        pythonCode: state.pythonCode,
        timestamp: state.timestamp,
        frameCount: state.frameCount,
    });
}

