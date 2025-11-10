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

// Helper function to parse hex color to RGB
function hexToRgb(hex: string): [number, number, number] {
    const cleaned = hex.replace("#", "");
    const r = parseInt(cleaned.substring(0, 2), 16);
    const g = parseInt(cleaned.substring(2, 4), 16);
    const b = parseInt(cleaned.substring(4, 6), 16);
    return [r, g, b];
}

// Helper function to convert RGB to hex
function rgbToHex(r: number, g: number, b: number): string {
    const toHex = (n: number) => {
        const hex = Math.round(Math.max(0, Math.min(255, n))).toString(16);
        return hex.length === 1 ? "0" + hex : hex;
    };
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

// Helper function to average multiple colors
function averageColors(colorHexes: string[]): string {
    if (colorHexes.length === 0) return "#000000";
    if (colorHexes.length === 1) return colorHexes[0];

    const rgbs = colorHexes.map(hexToRgb);
    const totalR = rgbs.reduce((sum, [r]) => sum + r, 0);
    const totalG = rgbs.reduce((sum, [, g]) => sum + g, 0);
    const totalB = rgbs.reduce((sum, [, , b]) => sum + b, 0);
    const count = rgbs.length;

    return rgbToHex(totalR / count, totalG / count, totalB / count);
}

// Multi-Ring Animation - 4 lights moving at different speeds
export const multiRingExample: Example = {
    name: "Multi-Ring Animation",
    description: "4 different colored lights moving around the ring at different speeds, colors blend when overlapping",
    framerate: 60,
    generate: () => {
        const DURATION_SECONDS = 10;
        const TOTAL_FRAMES = FRAMERATE * DURATION_SECONDS;

        // 4 lights with different colors and speeds
        const lights = [
            { color: "#FF0000", speed: 1.0 },      // Red - 1 LED per frame (fastest)
            { color: "#00FF00", speed: 0.5 },     // Green - 0.5 LEDs per frame
            { color: "#0000FF", speed: 0.33 },    // Blue - 0.33 LEDs per frame
            { color: "#FFFF00", speed: 0.25 },    // Yellow - 0.25 LEDs per frame (slowest)
        ];

        const frames: string[] = [];

        for (let frameNum = 0; frameNum < TOTAL_FRAMES; frameNum++) {
            // Track which lights are at each LED position
            const ledLights: string[][] = Array(NUM_LEDS).fill(null).map(() => []);

            // Calculate position for each light
            for (const light of lights) {
                // Calculate current position (wrapping around the ring)
                const position = (frameNum * light.speed) % NUM_LEDS;
                const ledIndex = Math.floor(position);

                // Add this light's color to the LED at this position
                ledLights[ledIndex].push(light.color);
            }

            // Generate colors for each LED, averaging if multiple lights overlap
            const colors: string[] = [];
            for (let ledIndex = 0; ledIndex < NUM_LEDS; ledIndex++) {
                if (ledLights[ledIndex].length > 0) {
                    colors.push(averageColors(ledLights[ledIndex]));
                } else {
                    colors.push("#000000"); // Black if no light
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
    multiRingExample,
];

