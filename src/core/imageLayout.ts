/** CSS applies min(1, columnWidth/originalWidth, heightLimit/originalHeight).
 * The frame's aspect ratio reserves exact space before the lazy image loads. */
export function imageLayoutStyle(
  width: number,
  height: number,
): Record<string, string> {
  return {
    "--image-natural-width": `${Math.max(1, width)}px`,
    "--image-aspect": String(Math.max(1, width) / Math.max(1, height)),
  };
}
