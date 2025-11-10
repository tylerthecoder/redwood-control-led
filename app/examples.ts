// Example generators for ControlLEDFormat

const NUM_LEDS = 60;
const FRAMERATE = 60;

export interface Example {
    name: string;
    description: string;
    framerate: number;
    generate: () => string[];
}

// Red and Green Animation - 10 seconds
export const redGreenExample: Example = {
    name: "Red and Green",
    description: "First 30 LEDs red, last 30 LEDs green for 10 seconds",
    framerate: 60,
    generate: () => {
        const DURATION_SECONDS = 10;
        const TOTAL_FRAMES = FRAMERATE * DURATION_SECONDS;
        const RED = "#FF0000";
        const GREEN = "#00FF00";

        const frames: string[] = [];

        for (let frameNum = 0; frameNum < TOTAL_FRAMES; frameNum++) {
            const colors: string[] = [];
            // First 30 LEDs: red
            for (let i = 0; i < 30; i++) {
                colors.push(RED);
            }
            // Last 30 LEDs: green
            for (let i = 0; i < 30; i++) {
                colors.push(GREEN);
            }
            frames.push(colors.join(","));
        }

        return frames;
    },
};

// Ring Animation - single light moving around
export const ringExample: Example = {
    name: "Ring Animation",
    description: "Single light moving around the ring, completing one full rotation",
    framerate: 60,
    generate: () => {
        const ON_COLOR = "#FFFFFF";
        const OFF_COLOR = "#000000";

        const frames: string[] = [];

        // Generate frames for one complete rotation (60 frames for 60 LEDs)
        for (let frameNum = 0; frameNum < NUM_LEDS; frameNum++) {
            const colors: string[] = [];

            for (let ledIndex = 0; ledIndex < NUM_LEDS; ledIndex++) {
                // Turn on the LED at the current position, all others off
                if (ledIndex === frameNum) {
                    colors.push(ON_COLOR);
                } else {
                    colors.push(OFF_COLOR);
                }
            }

            frames.push(colors.join(","));
        }

        return frames;
    },
};

export const examples: Example[] = [
    redGreenExample,
    ringExample,
];

