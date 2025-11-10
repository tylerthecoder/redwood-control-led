// Buffer endpoint - returns a specific buffer by index
import { ledState } from "../state";

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const indexParam = searchParams.get("index");

    if (ledState.mode !== "custom") {
        return Response.json(
            { error: "LED state is not in custom mode" },
            { status: 400 }
        );
    }

    const customState = ledState;
    const totalBuffers = customState.buffers.length;

    if (indexParam === null) {
        return Response.json(
            { error: "index parameter is required" },
            { status: 400 }
        );
    }

    const requestedIndex = parseInt(indexParam, 10);
    if (isNaN(requestedIndex) || requestedIndex < 0 || requestedIndex >= totalBuffers) {
        return Response.json(
            { error: `Invalid index: ${indexParam}. Must be between 0 and ${totalBuffers - 1}` },
            { status: 400 }
        );
    }

    const requestedBuffer = customState.buffers[requestedIndex] || [];

    return Response.json({
        buffer: requestedBuffer,
        bufferIndex: requestedIndex,
        totalBuffers: totalBuffers,
        framerate: customState.framerate,
    });
}

