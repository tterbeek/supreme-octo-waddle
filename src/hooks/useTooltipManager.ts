import { useState } from "react";

export type TooltipKey =
  | "home_log_button"
  | "after_first_log"
  | "tiny_tweak_prompt"
  | "stats_trends_info"
  | "presets_info";

export function useTooltipManager() {
  const [visible, setVisible] = useState<TooltipKey | null>(null);

  const hasSeen = (key: TooltipKey) =>
    typeof window !== "undefined" &&
    localStorage.getItem(`tooltip_${key}`) === "true";

  const markSeen = (key: TooltipKey) => {
    if (typeof window === "undefined") return;
    localStorage.setItem(`tooltip_${key}`, "true");
  };

  const showTooltip = (key: TooltipKey) => {
    if (!hasSeen(key)) setVisible(key);
  };

  const hideTooltip = () => {
    if (visible) markSeen(visible);
    setVisible(null);
  };

  return {
    visible,
    showTooltip,
    hideTooltip,
    hasSeen,
  };
}
