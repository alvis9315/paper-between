import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const lock = JSON.parse(readFileSync("package-lock.json", "utf8"));
const parts = [
  "紙間使用的第三方套件與授權\nDOMPurify 採 Apache-2.0；雙重授權套件採其寬鬆授權選項。\n",
];
for (const [location, pkg] of Object.entries(lock.packages)) {
  if (!location || pkg.dev) continue;
  if (pkg.optional && !existsSync(join(location, "package.json"))) continue;
  const meta = JSON.parse(readFileSync(join(location, "package.json"), "utf8"));
  const licenses = readdirSync(location).filter((name) =>
    /^(licen[sc]e|copying|notice)([.-]|$)/i.test(name),
  );
  parts.push(
    `\n${"=".repeat(72)}\n${meta.name}@${meta.version}\n授權：${meta.license || pkg.license || "請參照下列授權原文"}\n${typeof meta.repository === "object" ? meta.repository.url : meta.repository || meta.homepage || ""}\n`,
  );
  for (const name of licenses)
    parts.push(
      `\n--- ${name} ---\n${readFileSync(join(location, name), "utf8")}\n`,
    );
}
mkdirSync("public", { recursive: true });
writeFileSync("public/third-party-notices.txt", parts.join(""), "utf8");
