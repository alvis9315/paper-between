/** Page-positioned Word exports need their geometry, not a paragraph flattener.
 * This deliberately supports a checked subset: explicit pages, page-relative
 * DrawingML pictures and unrotated VML text boxes. Other layouts fail intact.
 */
import type { PDFFont, PDFImage, PDFName } from "pdf-lib";

type Parts = Record<string, Uint8Array>;
const W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const V = "urn:schemas-microsoft-com:vml";
const WP =
  "http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing";
const A = "http://schemas.openxmlformats.org/drawingml/2006/main";
const R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const REL = "http://schemas.openxmlformats.org/package/2006/relationships";
const unsupported = () =>
  new Error(
    "這份 Word 的浮動圖文版面目前無法完整保留。請從 Word 匯出 PDF，再使用「匯入 PDF」保留原貌；原有筆記未變動。",
  );
function elements(el: Element | Document, ns: string, tag: string) {
  return Array.from(el.getElementsByTagNameNS(ns, tag));
}
function first(el: Element | Document, ns: string, tag: string) {
  return elements(el, ns, tag)[0];
}
function value(el: Element | undefined, name: string, ns = W) {
  return el?.getAttributeNS(ns, name) || "";
}
function xml(parts: Parts, path: string) {
  const bytes = parts[path];
  if (!bytes) throw unsupported();
  const text = new TextDecoder().decode(bytes);
  if (/<!DOCTYPE|<!ENTITY/i.test(text)) throw unsupported();
  const doc = new DOMParser().parseFromString(text, "application/xml");
  if (doc.getElementsByTagName("parsererror").length) throw unsupported();
  return doc;
}
function partPath(base: string, target: string) {
  if (!target || /[?#\\]|^[a-z]+:/i.test(target)) throw unsupported();
  const segments = (
    target.startsWith("/") ? target.slice(1) : base + target
  ).split("/");
  const result: string[] = [];
  for (const segment of segments) {
    if (segment === "..") result.pop();
    else if (segment && segment !== ".") result.push(segment);
  }
  const path = result.join("/");
  if (!path.startsWith("word/")) throw unsupported();
  return path;
}
function relationships(parts: Parts, path: string) {
  const result = new Map<string, string>();
  if (!parts[path]) return result;
  for (const rel of elements(xml(parts, path), REL, "Relationship")) {
    if (rel.getAttribute("TargetMode") === "External") continue;
    if (!/\/(image|font)$/.test(rel.getAttribute("Type") || "")) continue;
    result.set(
      rel.getAttribute("Id") || "",
      partPath("word/", rel.getAttribute("Target") || ""),
    );
  }
  return result;
}
function styles(el: Element) {
  return new Map(
    (el.getAttribute("style") || "")
      .split(";")
      .filter(Boolean)
      .map((item) => {
        const split = item.indexOf(":");
        return [item.slice(0, split).trim(), item.slice(split + 1).trim()];
      }),
  );
}
function points(raw: string | undefined, fallback?: number) {
  if (!raw && fallback !== undefined) return fallback;
  const match = /^(-?\d+(?:\.\d+)?)(pt|in|cm|mm|px)?$/.exec(raw || "");
  if (!match) throw unsupported();
  const factor = { pt: 1, in: 72, cm: 72 / 2.54, mm: 72 / 25.4, px: 0.75 }[
    match[2] || "pt"
  ]!;
  return Number(match[1]) * factor;
}
function on(el: Element | undefined) {
  return !!el && !["0", "false", "off"].includes(value(el, "val"));
}
function positive(n: number, max = 20000) {
  if (!Number.isFinite(n) || n <= 0 || n > max) throw unsupported();
  return n;
}
interface Run {
  text: string;
  font: string;
  bold: boolean;
  italic: boolean;
  size: number;
  color: string;
  scale: number;
}
interface TextBox {
  x: number;
  y: number;
  width: number;
  height: number;
  z: number;
  runs: Run[];
  lineHeight: number;
}
interface Picture {
  path: string;
  x: number;
  y: number;
  width: number;
  height: number;
  z: number;
}
interface FixedPage {
  width: number;
  height: number;
  boxes: TextBox[];
  pictures: Picture[];
}

function readPages(parts: Parts): FixedPage[] {
  const doc = xml(parts, "word/document.xml"),
    body = first(doc, W, "body");
  if (
    !body ||
    elements(body, W, "tbl").length ||
    elements(body, W, "sectPr").length !== 1
  )
    throw unsupported();
  const size = first(body, W, "pgSz");
  const width = positive(Number(value(size, "w")) / 20),
    height = positive(Number(value(size, "h")) / 20);
  const rels = relationships(parts, "word/_rels/document.xml.rels");
  const pages: FixedPage[] = [];
  let page: FixedPage | undefined;
  let totalText = 0;
  for (const paragraph of Array.from(body.children)) {
    if (paragraph.localName === "sectPr" && paragraph.namespaceURI === W)
      continue;
    if (paragraph.localName !== "p" || paragraph.namespaceURI !== W)
      throw unsupported();
    const ppr = Array.from(paragraph.children).find(
      (e) => e.localName === "pPr",
    );
    if (!page || (ppr && on(first(ppr, W, "pageBreakBefore")))) {
      page = { width, height, boxes: [], pictures: [] };
      pages.push(page);
      if (pages.length > 200)
        throw new Error("固定版面 Word 最多 200 頁，請拆分文件。");
    }
    // Mixing flow content and absolute shapes needs a full Word layout engine.
    for (const text of elements(paragraph, W, "t")) {
      let ancestor = text.parentElement;
      while (
        ancestor &&
        ancestor !== paragraph &&
        ancestor.localName !== "txbxContent"
      )
        ancestor = ancestor.parentElement;
      if (ancestor === paragraph && text.textContent?.trim())
        throw unsupported();
    }
    if (
      elements(paragraph, WP, "inline").length ||
      elements(paragraph, W, "br").length ||
      elements(paragraph, W, "object").length
    )
      throw unsupported();
    for (const picture of elements(paragraph, WP, "anchor")) {
      const h = first(picture, WP, "positionH"),
        v = first(picture, WP, "positionV"),
        extent = first(picture, WP, "extent");
      if (
        h?.getAttribute("relativeFrom") !== "page" ||
        v?.getAttribute("relativeFrom") !== "page" ||
        elements(picture, A, "srcRect").length ||
        elements(picture, A, "xfrm").some(
          (e) =>
            e.hasAttribute("rot") ||
            e.hasAttribute("flipH") ||
            e.hasAttribute("flipV"),
        )
      )
        throw unsupported();
      const x = Number(first(h, WP, "posOffset")?.textContent) / 12700;
      const y = Number(first(v, WP, "posOffset")?.textContent) / 12700;
      const imagePath = rels.get(value(first(picture, A, "blip"), "embed", R));
      const imageWidth = positive(Number(extent?.getAttribute("cx")) / 12700);
      const imageHeight = positive(Number(extent?.getAttribute("cy")) / 12700);
      if (
        !imagePath ||
        !parts[imagePath] ||
        !/\.(png|jpe?g)$/i.test(imagePath) ||
        !Number.isFinite(x + y)
      )
        throw unsupported();
      page.pictures.push({
        path: imagePath,
        x,
        y,
        width: imageWidth,
        height: imageHeight,
        z:
          picture.getAttribute("behindDoc") === "1"
            ? -1
            : Number(picture.getAttribute("relativeHeight") || 0),
      });
    }
    for (const shape of elements(paragraph, V, "rect")) {
      const s = styles(shape),
        content = first(shape, W, "txbxContent");
      if (
        !content ||
        s.get("position") !== "absolute" ||
        s.get("mso-position-horizontal-relative") !== "page" ||
        s.get("mso-position-vertical-relative") !== "page" ||
        (s.has("rotation") && s.get("rotation") !== "0") ||
        !["f", "false"].includes(shape.getAttribute("filled") || "") ||
        !["f", "false"].includes(shape.getAttribute("stroked") || "")
      )
        throw unsupported();
      const textbox = first(shape, V, "textbox");
      if (
        textbox
          ?.getAttribute("inset")
          ?.split(",")
          .some((n) => points(n.trim()) !== 0)
      )
        throw unsupported();
      const paragraphs = elements(content, W, "p");
      if (paragraphs.length !== 1) throw unsupported();
      const p = paragraphs[0]!,
        properties = first(p, W, "pPr"),
        runs: Run[] = [];
      if (
        properties &&
        !["", "left", "start"].includes(
          value(first(properties, W, "jc"), "val"),
        )
      )
        throw unsupported();
      for (const r of elements(p, W, "r")) {
        if (
          Array.from(r.children).some(
            (e) => e.namespaceURI !== W || !["rPr", "t"].includes(e.localName),
          )
        )
          throw unsupported();
        const text = elements(r, W, "t")
          .map((e) => e.textContent || "")
          .join("");
        if (!text) continue;
        totalText += text.length;
        if (totalText > 4_000_000)
          throw new Error("Word 文字量過大，請拆分文件。");
        const pr = first(r, W, "rPr"),
          fonts = pr && first(pr, W, "rFonts");
        const color = value(pr && first(pr, W, "color"), "val");
        runs.push({
          text,
          font: value(fonts, "ascii") || value(fonts, "eastAsia"),
          bold: !!pr && on(first(pr, W, "b")),
          italic: !!pr && on(first(pr, W, "i")),
          size: positive(
            Number(value(pr && first(pr, W, "sz"), "val") || 22) / 2,
            400,
          ),
          color: /^[a-f\d]{6}$/i.test(color) ? color : "000000",
          scale: positive(
            Number(value(pr && first(pr, W, "w"), "val") || 100) / 100,
            10,
          ),
        });
      }
      const spacing = properties && first(properties, W, "spacing");
      const maxSize = Math.max(...runs.map((r) => r.size), 1);
      const lineHeight =
        spacing && value(spacing, "lineRule") === "exact"
          ? positive(Number(value(spacing, "line")) / 20)
          : maxSize * 1.2;
      page.boxes.push({
        x: points(s.get("margin-left"), 0),
        y: points(s.get("margin-top"), 0),
        width: positive(points(s.get("width"))),
        height: positive(points(s.get("height"))),
        z: Number(s.get("z-index") || 0),
        runs,
        lineHeight,
      });
    }
    // Never silently ignore a shape that the paragraph flattener also cannot retain.
    if (
      elements(paragraph, V, "textbox").length !==
        elements(paragraph, V, "rect").length ||
      elements(paragraph, W, "txbxContent").length !==
        elements(paragraph, V, "rect").length ||
      Array.from(paragraph.getElementsByTagNameNS(V, "*")).some(
        (e) => !["rect", "textbox"].includes(e.localName),
      )
    )
      throw unsupported();
  }
  if (
    !pages.length ||
    !totalText ||
    pages.some((p) => !p.boxes.length || !p.pictures.length)
  )
    throw unsupported();
  return pages;
}

/** ECMA-376: reverse GUID bytes, XOR first 32 bytes (key repeats twice). */
function fontBytes(bytes: Uint8Array, key: string) {
  const hex = key.replace(/[{}-]/g, "");
  if (!/^[a-f\d]{32}$/i.test(hex) || bytes.length < 32) throw unsupported();
  const secret = hex
    .match(/../g)!
    .map((n) => parseInt(n, 16))
    .reverse();
  const result = bytes.slice();
  for (let i = 0; i < 32; i++) result[i] = result[i]! ^ secret[i % 16]!;
  return result;
}

export async function fixedWordPdf(
  parts: Parts,
  progress: (message: string) => void,
): Promise<Uint8Array<ArrayBuffer>> {
  const pages = readPages(parts);
  const [
    {
      PDFDocument,
      StandardFonts,
      rgb,
      pushGraphicsState,
      popGraphicsState,
      setTextMatrix,
      beginText,
      endText,
      setFontAndSize,
      showText,
      setFillingColor,
    },
    { default: fontkit },
  ] = await Promise.all([import("pdf-lib"), import("@pdf-lib/fontkit")]);
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const metrics = new Map<PDFFont, { ascent: number; height: number }>();
  const fonts = new Map<
    string,
    {
      regular?: PDFFont;
      bold?: PDFFont;
      italic?: PDFFont;
      boldItalic?: PDFFont;
    }
  >();
  if (parts["word/fontTable.xml"]) {
    const rels = relationships(parts, "word/_rels/fontTable.xml.rels");
    for (const font of elements(xml(parts, "word/fontTable.xml"), W, "font")) {
      const variants: {
        regular?: PDFFont;
        bold?: PDFFont;
        italic?: PDFFont;
        boldItalic?: PDFFont;
      } = {};
      for (const [tag, variant] of [
        ["embedRegular", "regular"],
        ["embedBold", "bold"],
        ["embedItalic", "italic"],
        ["embedBoldItalic", "boldItalic"],
      ] as const) {
        const embed = first(font, W, tag);
        if (!embed) continue;
        const path = rels.get(value(embed, "id", R));
        if (!path || !parts[path]) throw unsupported();
        const raw = path.endsWith(".odttf")
          ? fontBytes(parts[path]!, value(embed, "fontKey"))
          : parts[path]!;
        const embedded = await pdf.embedFont(raw, { subset: true });
        const face = fontkit.create(raw);
        metrics.set(embedded, {
          ascent: face.ascent / face.unitsPerEm,
          height: (face.ascent - face.descent) / face.unitsPerEm,
        });
        variants[variant] = embedded;
      }
      if (Object.keys(variants).length)
        fonts.set(value(font, "name"), variants);
    }
  }
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const italic = await pdf.embedFont(StandardFonts.HelveticaOblique);
  const boldItalic = await pdf.embedFont(StandardFonts.HelveticaBoldOblique);
  const symbol = await pdf.embedFont(StandardFonts.Symbol);
  const allFonts = [...fonts.values()].flatMap((variants) =>
    Object.values(variants),
  );
  const charsets = new Map<PDFFont, Set<number>>();
  function supports(font: PDFFont, char: string) {
    if (!charsets.has(font))
      charsets.set(font, new Set(font.getCharacterSet()));
    return charsets.get(font)!.has(char.codePointAt(0)!);
  }
  const images = new Map<string, PDFImage>();
  for (const [n, source] of pages.entries()) {
    progress(`正在保留 Word 第 ${n + 1}／${pages.length} 頁的圖文版面…`);
    const page = pdf.addPage([source.width, source.height]);
    const fontKeys = new Map<PDFFont, PDFName>();
    for (const item of [
      ...source.pictures.map((p) => ({ ...p, type: "image" as const })),
      ...source.boxes.map((b) => ({ ...b, type: "text" as const })),
    ].sort((a, b) => a.z - b.z)) {
      if (item.type === "image") {
        if (!images.has(item.path))
          images.set(
            item.path,
            /\.png$/i.test(item.path)
              ? await pdf.embedPng(parts[item.path]!)
              : await pdf.embedJpg(parts[item.path]!),
          );
        page.drawImage(images.get(item.path)!, {
          x: item.x,
          y: source.height - item.y - item.height,
          width: item.width,
          height: item.height,
        });
        continue;
      }
      let x = item.x;
      for (const run of item.runs) {
        const variants = fonts.get(run.font);
        const preferred =
          (run.bold && run.italic
            ? variants?.boldItalic
            : run.bold
              ? variants?.bold
              : run.italic
                ? variants?.italic
                : variants?.regular) ||
          variants?.regular ||
          (run.bold
            ? run.italic
              ? boldItalic
              : bold
            : run.italic
              ? italic
              : regular);
        const chunks: { text: string; font: PDFFont }[] = [];
        for (const char of run.text) {
          const font = supports(preferred, char)
            ? preferred
            : [...allFonts, regular, symbol].find((f) => supports(f, char));
          if (!font)
            throw new Error(
              "Word 缺少可顯示部分文字的字型。請在 Word 嵌入字型或匯出 PDF 後再匯入；原有筆記未變動。",
            );
          const previous = chunks[chunks.length - 1];
          if (previous?.font === font) previous.text += char;
          else chunks.push({ text: char, font });
        }
        // Word line boxes include the font ascender plus half of the extra leading.
        for (const chunk of chunks) {
          const metric = metrics.get(chunk.font);
          const ascent = metric
            ? metric.ascent * run.size
            : chunk.font.heightAtSize(run.size, { descender: false });
          const fullHeight = metric
            ? metric.height * run.size
            : chunk.font.heightAtSize(run.size);
          const baseline =
            source.height -
            item.y -
            ascent -
            Math.max(0, (item.lineHeight - fullHeight) / 2);
          const color = rgb(
            parseInt(run.color.slice(0, 2), 16) / 255,
            parseInt(run.color.slice(2, 4), 16) / 255,
            parseInt(run.color.slice(4, 6), 16) / 255,
          );
          // A text matrix retains Word's run stretch; reuse the font per page.
          if (!fontKeys.has(chunk.font))
            fontKeys.set(
              chunk.font,
              page.node.newFontDictionary(chunk.font.name, chunk.font.ref),
            );
          const fontKey = fontKeys.get(chunk.font)!;
          page.pushOperators(
            pushGraphicsState(),
            beginText(),
            setFillingColor(color),
            setFontAndSize(fontKey, run.size),
            setTextMatrix(run.scale, 0, 0, 1, x, baseline),
            showText(chunk.font.encodeText(chunk.text)),
            endText(),
            popGraphicsState(),
          );
          x += chunk.font.widthOfTextAtSize(chunk.text, run.size) * run.scale;
        }
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  pdf.setProducer("頁白 · Word 原頁閱讀");
  const result = await pdf.save();
  if (result.byteLength > 10 * 1024 * 1024)
    throw new Error("Word 原頁閱讀版本超過 10MB，請拆分文件或匯出較小的 PDF。");
  return result as Uint8Array<ArrayBuffer>;
}
