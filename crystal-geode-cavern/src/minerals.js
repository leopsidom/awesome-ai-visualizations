/**
 * The four mineral habits the cavity can be lined with.
 *
 * Only the crystals and the water change between them. The daylight coming in
 * through the crack stays daylight — the whole point of the `C` key is to see
 * the *same* light played through a different mineral, so tinting the light
 * source as well would flatten the comparison.
 *
 * `body` is the surface colour, `attenuation` is what a thick piece does to
 * light travelling *through* it (Beer-Lambert absorption, so it reads much
 * deeper than the surface tint), and `spread` is the far end of the per-crystal
 * hue jitter — no two crystals in one druse are quite the same colour.
 */

export const MINERALS = [
  {
    name: "amethyst",
    body: 0x9b6df0,
    attenuation: 0x4a1f8f,
    spread: 0xd2b0ff,
    water: 0x1a1030,
  },
  {
    name: "citrine",
    body: 0xe0a63c,
    attenuation: 0x7d4409,
    spread: 0xffdc9a,
    water: 0x2a1c08,
  },
  {
    name: "aquamarine",
    body: 0x5fc6d8,
    attenuation: 0x0d6273,
    spread: 0xb2eff7,
    water: 0x07202a,
  },
  {
    name: "smoky quartz",
    body: 0xa08a78,
    attenuation: 0x2f2116,
    spread: 0xdcc7b0,
    water: 0x191209,
  },
];
