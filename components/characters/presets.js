/**
 * Named character presets, modular customization options, and shared animation vocabulary.
 * v1 Cast: Ada, Kai, Maya, Leo (modular vinyl-toy humans) + Pip (AI Companion Bot).
 */

export const STATES = ["idle", "walk", "run", "talk", "think", "sit"];
export const GESTURES = ["wave", "point", "celebrate", "nod", "shake"];

export const HUMAN_EXPRESSIONS = [
  "neutral",
  "happy",
  "thinking",
  "surprised",
  "excited",
  "speaking",
];

export const BOT_EXPRESSIONS = [
  "neutral",
  "happy",
  "curious",
  "loading",
  "heart",
  "alert",
  "speaking",
];

export const OPTIONS = {
  hairStyle: ["bob", "spiky", "puffs", "sidepart", "beanie"],
  outfit: ["sweater", "hoodie", "jacket", "blazer"],
  glasses: ["none", "round", "square"],
  accessory: ["none", "lanyard", "headphones", "backpack"],
  prop: ["none", "tablet", "pointer", "coffee", "laptop"],
};

export const PALETTES = {
  skinTone: ["#f6d7c3", "#e8b896", "#d2966d", "#a66c49", "#744731"],
  hairColor: ["#262332", "#4a3326", "#8c5630", "#d4a44c", "#b8453a", "#cbd5e1"],
  primaryColor: ["#1f8a8c", "#232933", "#e08a3c", "#2b3a55", "#6d4c9f", "#2e7d5b", "#c94c5b"],
  accentColor: ["#f2c15a", "#76b900", "#ff6b6b", "#38bdf8", "#38e8d4", "#f472b6", "#f8fafc"],
};

export const CHARACTER_PRESETS = {
  ada: {
    id: "ada",
    name: "Ada",
    role: "Data Analyst",
    type: "human",
    height: 1.6,
    skinTone: "#e8b896",
    cheekTone: "#e98a82",
    hairStyle: "bob",
    hairColor: "#262332",
    outfit: "sweater",
    primaryColor: "#1f8a8c",
    secondaryColor: "#263142",
    accentColor: "#f2c15a",
    shoeColor: "#eef2f7",
    glasses: "round",
    accessory: "lanyard",
    prop: "none",
    expression: "neutral",
  },
  kai: {
    id: "kai",
    name: "Kai",
    role: "AI / Hardware Engineer",
    type: "human",
    height: 1.66,
    skinTone: "#d2966d",
    cheekTone: "#d97a6c",
    hairStyle: "spiky",
    hairColor: "#1b1f2a",
    outfit: "hoodie",
    primaryColor: "#232933",
    secondaryColor: "#1a202c",
    accentColor: "#76b900",
    shoeColor: "#2c3442",
    glasses: "none",
    accessory: "headphones",
    prop: "none",
    expression: "neutral",
  },
  maya: {
    id: "maya",
    name: "Maya",
    role: "Explorer & Student",
    type: "human",
    height: 1.56,
    skinTone: "#8f593c",
    cheekTone: "#c96a62",
    hairStyle: "puffs",
    hairColor: "#1f181c",
    outfit: "jacket",
    primaryColor: "#e08a3c",
    sleeveColor: "#f3eee4",
    secondaryColor: "#2d3b52",
    accentColor: "#ff6b6b",
    shoeColor: "#f7f4ee",
    glasses: "none",
    accessory: "backpack",
    prop: "none",
    expression: "happy",
  },
  leo: {
    id: "leo",
    name: "Leo",
    role: "Presenter & Host",
    type: "human",
    height: 1.68,
    skinTone: "#f6d7c3",
    cheekTone: "#eb948c",
    hairStyle: "sidepart",
    hairColor: "#5a3d2b",
    outfit: "blazer",
    primaryColor: "#2b3a55",
    secondaryColor: "#1f2736",
    accentColor: "#38bdf8",
    shoeColor: "#3a2e2a",
    glasses: "square",
    accessory: "none",
    prop: "none",
    expression: "neutral",
  },
  pip: {
    id: "pip",
    name: "Pip",
    role: "AI Companion Bot",
    type: "bot",
    height: 0.95,
    bodyColor: "#eef2f8",
    trimColor: "#232a38",
    accentColor: "#38e8d4",
    expression: "neutral",
  },
};

/** Maps generic/human expression names cleanly to Pip's LED visor moods. */
export const EXPRESSION_TO_BOT_MOOD = {
  neutral: "neutral",
  happy: "happy",
  thinking: "curious",
  surprised: "alert",
  excited: "heart",
  speaking: "speaking",
  curious: "curious",
  loading: "loading",
  heart: "heart",
  alert: "alert",
};
