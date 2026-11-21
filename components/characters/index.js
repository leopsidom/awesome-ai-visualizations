import {
  CHARACTER_PRESETS,
  OPTIONS,
  PALETTES,
  STATES,
  GESTURES,
  HUMAN_EXPRESSIONS,
  BOT_EXPRESSIONS,
} from "./presets.js";
import { createHuman } from "./human.js";
import { createBot } from "./bot.js";

export {
  CHARACTER_PRESETS,
  OPTIONS,
  PALETTES,
  STATES,
  GESTURES,
  HUMAN_EXPRESSIONS,
  BOT_EXPRESSIONS,
  createHuman,
  createBot,
};

/**
 * Primary factory for reusable 3D vinyl-toy cartoon characters.
 *
 * Usage:
 *   const ada = createCharacter("ada");
 *   const kai = createCharacter("kai", { prop: "laptop", height: 1.7 });
 *   const pip = createCharacter("pip", { accentColor: "#76b900" });
 *   const custom = createCharacter({
 *     type: "human",
 *     hairStyle: "beanie",
 *     outfit: "hoodie",
 *     glasses: "square",
 *     primaryColor: "#232933",
 *     accentColor: "#38e8d4",
 *   });
 */
export function createCharacter(presetOrConfig = "ada", overrides = {}) {
  let merged;
  if (typeof presetOrConfig === "string") {
    const preset = CHARACTER_PRESETS[presetOrConfig];
    if (!preset) {
      throw new Error(
        `Unknown character preset "${presetOrConfig}". Available: ${Object.keys(CHARACTER_PRESETS).join(", ")}`,
      );
    }
    merged = { ...preset, ...overrides };
  } else {
    const base =
      presetOrConfig?.type === "bot"
        ? CHARACTER_PRESETS.pip
        : CHARACTER_PRESETS.ada;
    merged = { ...base, ...presetOrConfig, ...overrides };
  }

  if (merged.type === "bot") {
    return createBot(merged);
  }
  return createHuman(merged);
}
