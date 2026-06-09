import type { CSSProperties } from "react";

// Inline icon set (no dependency). Stroke icons on a 24x24 grid.
export type IconName =
  | "check" | "alert" | "clock" | "circle" | "calendar" | "grid" | "flag"
  | "search" | "users" | "list" | "download" | "arrow" | "chevron" | "bell";

export function Icon({
  name,
  size = 16,
  stroke = 1.7,
  style,
}: {
  name: IconName;
  size?: number;
  stroke?: number;
  style?: CSSProperties;
}) {
  const p = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: stroke,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    style,
  };
  switch (name) {
    case "check":    return <svg {...p}><path d="M20 6L9 17l-5-5" /></svg>;
    case "alert":    return <svg {...p}><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" /><path d="M12 9v4" /><path d="M12 17h.01" /></svg>;
    case "clock":    return <svg {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>;
    case "circle":   return <svg {...p}><circle cx="12" cy="12" r="9" /></svg>;
    case "calendar": return <svg {...p}><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>;
    case "grid":     return <svg {...p}><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></svg>;
    case "flag":     return <svg {...p}><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V4s-1 1-4 1-5-2-8-2-4 1-4 1z" /><path d="M4 22V4" /></svg>;
    case "search":   return <svg {...p}><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>;
    case "users":    return <svg {...p}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.9" /><path d="M16 3.1a4 4 0 0 1 0 7.8" /></svg>;
    case "list":     return <svg {...p}><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" /></svg>;
    case "download": return <svg {...p}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="M7 10l5 5 5-5" /><path d="M12 15V3" /></svg>;
    case "arrow":    return <svg {...p}><path d="M5 12h14M13 6l6 6-6 6" /></svg>;
    case "chevron":  return <svg {...p}><path d="m9 18 6-6-6-6" /></svg>;
    case "bell":     return <svg {...p}><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></svg>;
    default:         return null;
  }
}
