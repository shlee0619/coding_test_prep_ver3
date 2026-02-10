/**
 * Unified type exports
 * Import shared types from this single entry point.
 */

export type * from "../drizzle/schema";
export * from "./_core/errors";

// Tier utilities
export const TIER_NAMES = [
  "Unrated",
  "Bronze V", "Bronze IV", "Bronze III", "Bronze II", "Bronze I",
  "Silver V", "Silver IV", "Silver III", "Silver II", "Silver I",
  "Gold V", "Gold IV", "Gold III", "Gold II", "Gold I",
  "Platinum V", "Platinum IV", "Platinum III", "Platinum II", "Platinum I",
  "Diamond V", "Diamond IV", "Diamond III", "Diamond II", "Diamond I",
  "Ruby V", "Ruby IV", "Ruby III", "Ruby II", "Ruby I",
  "Master"
];

export function getTierName(tier: number): string {
  if (tier < 0 || tier > 31) return "Unknown";
  return TIER_NAMES[tier] || "Unknown";
}

export function getTierColor(tier: number): string {
  if (tier === 0) return "#2D2D2D";
  if (tier <= 5) return "#AD5600";
  if (tier <= 10) return "#435F7A";
  if (tier <= 15) return "#EC9A00";
  if (tier <= 20) return "#27E2A4";
  if (tier <= 25) return "#00B4FC";
  if (tier <= 30) return "#FF0062";
  return "#B491FF";
}

export function getTierColorName(tier: number): "bronze" | "silver" | "gold" | "platinum" | "diamond" | "ruby" | "muted" {
  if (tier === 0) return "muted";
  if (tier <= 5) return "bronze";
  if (tier <= 10) return "silver";
  if (tier <= 15) return "gold";
  if (tier <= 20) return "platinum";
  if (tier <= 25) return "diamond";
  return "ruby";
}
