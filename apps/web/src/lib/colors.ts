/**
 * Per-team/domain/company colors, rendered from Confluence hue numbers.
 * Same helpers as the prototype: solid(h) and tint(h, alpha[, lightness]).
 */
export const solid = (hue: number): string => `oklch(55% 0.17 ${hue})`;

export const tint = (hue: number, alpha: number, lightness = '60%'): string =>
  `oklch(${lightness} 0.14 ${hue} / ${alpha})`;
