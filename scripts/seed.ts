#!/usr/bin/env bun

/**
 * Seed script to add all example scripts to the database
 * Run with: bun run scripts/seed.ts
 */

import { saveScript } from "../app/lib/storage";
import {
    scriptPresets,
} from "../app/examples";

async function seedScripts() {
    console.log("🌱 Starting seed script...\n");

    let successCount = 0;
    let errorCount = 0;

    // Seed script presets
    console.log("📝 Seeding script presets...");
    for (const preset of scriptPresets) {
        try {
            const frames = await preset.generate();
            await saveScript(
                preset.name,
                preset.description,
                "", // No Python code for examples
                frames,
                "user",
                undefined,
                false,
                preset.framerate
            );
            console.log(`  ✅ Added: ${preset.name} (${frames.length} frames)`);
            successCount++;
        } catch (error) {
            console.error(`  ❌ Failed to add ${preset.name}:`, error);
            errorCount++;
            console.error(`  ❌ Failed to add ${preset.name}:`, error);
            errorCount++;
        }
    }

    console.log("\n✨ Seed script completed!");
    console.log(`   Success: ${successCount}`);
    console.log(`   Errors: ${errorCount}`);

    if (errorCount > 0) {
        process.exit(1);
    }
}

// Run the seed script
seedScripts().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
});

