// Human-friendly names for ZIP entries.

// R2 keys are stored as `<folder>/<uuid>-<original filename>`. Recover the
// original filename by dropping the 36-char uuid and its separator.
export function cleanFileName(r2Key: string): string {
  const base = r2Key.split("/").pop() ?? r2Key;
  return base.length > 37 ? base.slice(37) : base;
}

// Make a string safe to use as a folder name.
export function sanitizeFolder(s: string): string {
  return (
    s
      .replace(/[\\/:*?"<>|]+/g, "_")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 80) || "untitled"
  );
}

// Ensure a path is unique within the set of files already added (appends " (2)").
export function uniquePath(files: Record<string, unknown>, path: string): string {
  if (!(path in files)) return path;
  const slash = path.lastIndexOf("/");
  const dot = path.lastIndexOf(".");
  const hasExt = dot > slash;
  const stem = hasExt ? path.slice(0, dot) : path;
  const ext = hasExt ? path.slice(dot) : "";
  let i = 2;
  while (`${stem} (${i})${ext}` in files) i++;
  return `${stem} (${i})${ext}`;
}
