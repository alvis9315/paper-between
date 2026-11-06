import { cpSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
// PDF.js uses these local resources for CJK fonts and JPEG2000/JBIG2 images.
for (const directory of ["cmaps", "standard_fonts", "wasm"]) {
  const target = resolve("public/pdfjs", directory);
  mkdirSync(target, { recursive: true });
  cpSync(resolve("node_modules/pdfjs-dist", directory), target, {
    recursive: true,
  });
}
