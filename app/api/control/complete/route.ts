// Buffer completion endpoint
import { ledState } from "../state";

export async function POST(request: Request) {
    try {
        const body = await request.json();

        if (body.action === "completeBuffer" && ledState.mode === "format") {
            const formatState = ledState;
            // Move to next buffer
            formatState.currentBufferIndex = (formatState.currentBufferIndex + 1) % formatState.buffers.length;

            return Response.json({
                success: true,
                currentBufferIndex: formatState.currentBufferIndex,
            });
        }

        return Response.json({ success: false, error: "Invalid action" }, { status: 400 });
    } catch (error) {
        return Response.json({ success: false, error: "Invalid request" }, { status: 400 });
    }
}

