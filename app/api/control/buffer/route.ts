// Buffer endpoint - returns a specific buffer by index
import { ledState } from "../state";

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const indexParam = searchParams.get("index");

    if (ledState.mode !== "script") {
        return Response.json(
            {
                error: "LED state is not in script mode",
                currentMode: ledState.mode,
                message: "Animation may have been changed. Please check current mode."
            },
            { status: 400 }
        );
    }

    const scriptState = ledState;
    const totalBuffers = scriptState.buffers.length;

    if (totalBuffers === 0) {
        return Response.json(
            {
                error: "No buffers available",
                totalBuffers: 0,
                message: "Script mode has no buffers loaded. Upload animation first."
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

    const requestedBuffer = scriptState.buffers[requestedIndex] || [];

    // Convert buffer to hex string for more efficient transfer
    // Format: continuous hex string "FF0000FF0000..." (6 chars per color)
    const hexBuffer = requestedBuffer.map(n => n.toString(16).padStart(6, '0')).join('');

    return Response.json({
        buffer: hexBuffer,  // Hex string instead of number array
        bufferIndex: requestedIndex,
        totalBuffers: totalBuffers,
        framerate: scriptState.framerate,
        format: 'hex',  // Indicate format for client
    });
}

