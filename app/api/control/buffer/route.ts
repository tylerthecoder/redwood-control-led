// Buffer endpoint - returns a specific buffer by index
import { ledState } from "../state";

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const indexParam = searchParams.get("index");

    if (ledState.mode !== "custom") {
        return Response.json(
            {
                error: "LED state is not in custom mode",
                currentMode: ledState.mode,
                message: "Animation may have been changed. Please check current mode."
            },
            { status: 400 }
        );
    }

    const customState = ledState;
    const totalBuffers = customState.buffers.length;

    if (totalBuffers === 0) {
        return Response.json(
            {
                error: "No buffers available",
                totalBuffers: 0,
                message: "Custom mode has no buffers loaded. Upload animation first."
            },
            { status: 400 }
        );
    }

    if (indexParam === null) {
        return Response.json(
            {
                error: "index parameter is required",
                totalBuffers: totalBuffers,
                message: "Please provide ?index=N in the URL"
            },
            { status: 400 }
        );
    }

    const requestedIndex = parseInt(indexParam, 10);
    if (isNaN(requestedIndex) || requestedIndex < 0 || requestedIndex >= totalBuffers) {
        return Response.json(
            {
                error: `Invalid index: ${indexParam}. Must be between 0 and ${totalBuffers - 1}`,
                requestedIndex: indexParam,
                totalBuffers: totalBuffers,
                validRange: `0-${totalBuffers - 1}`,
                message: "Buffer index out of range. Animation may have changed."
            },
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

