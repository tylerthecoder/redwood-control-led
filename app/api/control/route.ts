// API route for getting LED state (used by Arduino)
import { getArduinoState } from "@/app/lib/ledstate";

export async function GET() {
    return Response.json(await getArduinoState());
}
