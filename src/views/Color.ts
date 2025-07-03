// Colors from Catpuccin
// https://github.com/catppuccin/catppuccin

import type { HexColorString } from "discord.js";

export const HexColor = {
  Pink: 0xf5c2e7,
  Blue: 0x89b4fa,
  Green: 0xa6e3a1,
  Purple: 0xb4befe, // Lavender
  Gray: 0x585b70,
} as const;

export type ColorKey = keyof typeof HexColor;
export type HexColorValue = (typeof HexColor)[ColorKey];

// Convert numerical hex values to string format with "#" prefix
export const Color: Record<ColorKey, HexColorString> = Object.fromEntries(
  Object.entries(HexColor).map(([key, value]) => [
    key,
    `#${value.toString(16).padStart(6, "0")}`,
  ])
) as Record<ColorKey, HexColorString>;

export type ColorValue = (typeof Color)[ColorKey];
