// Buffer completion endpoint
import { ledState, updateState } from "../state";

export async function POST(request: Request) {
    try {
        const body = await request.json();

        if (body.action === "completeBuffer" && ledState.mode === "custom") {
            const customState = ledState;
            // Move to next buffer
            const newBufferIndex = (customState.currentBufferIndex + 1) % customState.buffers.length;
            updateState({
                ...customState,
                currentBufferIndex: newBufferIndex,
            });

            return Response.json({
                success: true,
                currentBufferIndex: newBufferIndex,
            });
        }

        return Response.json({ success: false, error: "Invalid action" }, { status: 400 });
    } catch (error) {
        return Response.json({ success: false, error: "Invalid request" }, { status: 400 });
    }
}

