# Reusable 3D Cartoon Characters (`components/characters`)

Zero-asset, 100% procedural Three.js (`0.185.1`) vinyl-toy / Pixar-lite chibi characters designed for reuse across scenes in `awesome-ai-visualizations`.

## Quick Start

From any scene under `scenes/<your-scene>/src/`:

```js
import { createCharacter, CHARACTER_PRESETS } from "../../../components/characters/index.js";

// Spawn named presets (feet at y = 0, facing +Z, real-world meter heights)
const ada = createCharacter("ada", { prop: "tablet" });
const kai = createCharacter("kai");
const maya = createCharacter("maya");
const leo = createCharacter("leo", { prop: "pointer" });
const pip = createCharacter("pip", { accentColor: "#76b900" });

scene.add(ada.root, pip.root);

// Drive animation loops, one-shot gestures, expressions, and eye/head gaze
ada.setState("talk");          // "idle" | "walk" | "run" | "talk" | "think" | "sit"
ada.setExpression("happy");    // "neutral" | "happy" | "thinking" | "surprised" | "excited" | "speaking"
ada.play("point", { target: targetVec3 }); // "wave" | "point" | "celebrate" | "nod" | "shake"
ada.lookAt(camera.position);   // pass null to reset gaze

// Inside your render loop & teardown
ada.update(dt);
ada.dispose();
```

## Named Presets

| Preset | Role | Height | Signature Look |
| :--- | :--- | :---: | :--- |
| `ada` | Data Analyst | `1.60m` | Layered bob, round gold glasses, teal sweater, conference lanyard |
| `kai` | AI / Hardware Engineer | `1.66m` | Spiky hair, charcoal zip hoodie w/ lime trim, neck headphones |
| `maya` | Explorer & Student | `1.56m` | Twin curly puffs, amber varsity jacket, explorer backpack |
| `leo` | Presenter & Host | `1.68m` | Side-part wave, square glasses, slate blazer over turtleneck |
| `pip` | AI Companion Bot | `0.95m` | Glossy floating vinyl bot, emissive Canvas2D LED visor, spring antenna |

## Modular Human Customization Options

Pass any subset to `createCharacter("ada", { ... })` or `createCharacter({ type: "human", ... })`:

- `height`: world height in meters (default `1.6`)
- `skinTone`, `hairColor`, `primaryColor`, `secondaryColor`, `accentColor`, `shoeColor`, `sleeveColor`
- `hairStyle`: `"bob" | "spiky" | "puffs" | "sidepart" | "beanie"`
- `outfit`: `"sweater" | "hoodie" | "jacket" | "blazer"`
- `glasses`: `"none" | "round" | "square"`
- `accessory`: `"none" | "lanyard" | "headphones" | "backpack"`
- `prop`: `"none" | "tablet" | "pointer" | "coffee" | "laptop"` (also hot-swappable via `char.setProp(name)`)
- `contactShadow`: `true` (default) or `false`

## Interactive Studio

Inspect all 5 characters, test every motion/expression, mix-and-match custom outfits, and copy ready-to-paste JS configs in `scenes/character-studio/`.
