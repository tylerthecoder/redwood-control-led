import { NextResponse } from "next/server";
import { getClaudeFramesById } from "../state";

export async function GET(
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

        const script = await getClaudeFramesById(id);

        if (!script) {
            return NextResponse.json(
                { error: "Script not found" },
                { status: 404 }
            );
        }

        return NextResponse.json(script);
    } catch (error) {
        console.error("Error fetching Claude script:", error);
        return NextResponse.json(
            {
                error: "Failed to fetch Claude script",
                message: error instanceof Error ? error.message : String(error),
            },
            { status: 500 }
        );
    }
}

