import { NextResponse } from "next/server";
import { setActiveClaudeFrames } from "../../state";

export async function POST(
    request: Request,
    { params }: { params: { id: string } }
) {
    try {
        const id = parseInt(params.id);
        if (isNaN(id)) {
            return NextResponse.json(
                { error: "Invalid script ID" },
                { status: 400 }
            );
        }

        await setActiveClaudeFrames(id);

        return NextResponse.json({ success: true, activeId: id });
    } catch (error) {
        console.error("Error setting active Claude script:", error);
        return NextResponse.json(
            {
                error: "Failed to set active script",
                message: error instanceof Error ? error.message : String(error),
            },
            { status: 500 }
        );
    }
}

