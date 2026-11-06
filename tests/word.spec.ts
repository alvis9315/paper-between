import { test, expect } from "@playwright/test";
import { zipSync, strToU8 } from "fflate";

const W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const namespaces = `xmlns:w="${W}" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"`;
function textbox(text: string, x: number, y: number, size = 12) {
  return `<w:r><w:pict><v:rect style="position:absolute;margin-left:${x}pt;margin-top:${y}pt;width:400pt;height:24pt;z-index:100;mso-position-horizontal-relative:page;mso-position-vertical-relative:page" filled="f" stroked="f"><v:textbox inset="0,0,0,0"><w:txbxContent><w:p><w:pPr><w:spacing w:line="480" w:lineRule="exact"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Arial"/><w:sz w:val="${size * 2}"/><w:color w:val="4A3428"/></w:rPr><w:t>${text}</w:t></w:r></w:p></w:txbxContent></v:textbox></v:rect></w:pict></w:r>`;
}
function fixedDocx(unsupported = false) {
  const image = `<w:r><w:drawing><wp:anchor behindDoc="1"><wp:positionH relativeFrom="page"><wp:posOffset>0</wp:posOffset></wp:positionH><wp:positionV relativeFrom="page"><wp:posOffset>0</wp:posOffset></wp:positionV><wp:extent cx="7620000" cy="10160000"/><a:graphic><a:graphicData><pic:pic><pic:blipFill><a:blip r:embed="image1"/></pic:blipFill></pic:pic></a:graphicData></a:graphic></wp:anchor></w:drawing></w:r>`;
  const paragraph = (n: number) =>
    `<w:p><w:pPr>${n > 1 ? "<w:pageBreakBefore/>" : ""}</w:pPr>${image}${textbox(`Exam page ${n}`, 40, 40, 20)}${textbox("1.a", 40, 380)}${textbox("Sender", 70, 380)}${textbox("frame needs T2?", 120, 380)}${textbox("Answer stays beside its diagram.", 40, 410)}${unsupported ? "<w:r><w:t>Unsupported mixed flow</w:t></w:r>" : ""}</w:p>`;
  return Buffer.from(
    zipSync({
      "[Content_Types].xml": strToU8(
        `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`,
      ),
      "_rels/.rels": strToU8(
        `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="main" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`,
      ),
      "word/document.xml": strToU8(
        `<w:document ${namespaces}><w:body>${paragraph(1)}${paragraph(2)}<w:sectPr><w:pgSz w:w="12000" w:h="16000"/></w:sectPr></w:body></w:document>`,
      ),
      "word/_rels/document.xml.rels": strToU8(
        `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="image1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/background.png"/><Relationship Id="ignored" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/customXml" Target="../customXml/item.xml"/></Relationships>`,
      ),
      "word/media/background.png": Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jG/8AAAAASUVORK5CYII=",
        "base64",
      ),
    }),
  );
}

test("positioned Word keeps pages and same-line text, remains searchable, and survives ZIP", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator("main.bookshelf-page")).toBeVisible();
  await page.locator("#word-file").setInputFiles({
    name: "positioned.docx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    buffer: fixedDocx(),
  });
  await expect(page.locator(".reader-title")).toHaveText("positioned");
  await expect(page.locator(".book-workspace")).toHaveAttribute(
    "aria-busy",
    "false",
  );
  await expect(page.locator(".pdf-error")).toHaveCount(0);
  await expect(
    page.locator(".book-pages > .paper .textLayer").first(),
  ).toContainText("Sender");
  const result = await page.evaluate(async () => {
    const storage = "/src/core/storage.ts",
      pdfModule = "/src/core/pdf.ts",
      backup = "/src/core/backupBundle.ts";
    const { loadLibrary } = await import(storage),
      { acquirePdf } = await import(pdfModule),
      { createBundle, readBundle } = await import(backup);
    const state = await loadLibrary(),
      doc = state.books[0].document;
    const handle = await acquirePdf(doc.pdfAssetId);
    const source = await handle.document.getPage(1),
      content = await source.getTextContent();
    const runs = content.items
      .filter((i: any) => "str" in i && i.str.trim())
      .map((i: any) => ({ text: i.str, x: i.transform[4], y: i.transform[5] }));
    handle.release();
    const restored = await readBundle(
      new File([await createBundle(state.books)], "word.zip"),
    );
    return {
      pages: doc.blocks.length,
      runs,
      restoredPages: restored[0].document.blocks.length,
      restoredText: restored[0].document.blocks[0].text,
    };
  });
  expect(result.pages).toBe(2);
  expect(result.restoredPages).toBe(2);
  const sender = result.runs.find((r: any) => r.text === "Sender")!;
  const question = result.runs.find((r: any) => r.text === "frame needs T2?")!;
  expect(sender.x).toBe(70);
  expect(question.x).toBe(120);
  expect(sender.y).toBeCloseTo(question.y, 4);
  expect(result.restoredText).toContain("Answer stays beside its diagram.");
  await page
    .getByRole("button", { name: "搜尋筆記（⌘K / Ctrl K / /）", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "搜尋整本筆記", exact: true })
    .fill("Sender");
  await expect(page.locator(".search-result")).toHaveCount(2);
  await page.keyboard.press("Escape");
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    page.locator(".book-pages > .paper .textLayer").first(),
  ).toContainText("Sender");
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
  await page.reload();
  await expect(
    page.locator(".book-pages > .paper .textLayer").first(),
  ).toContainText("Sender");
});

test("unsupported positioned Word leaves the library intact instead of flattening text", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator("main.bookshelf-page")).toBeVisible();
  await page.locator("#word-file").setInputFiles({
    name: "unsupported.docx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    buffer: fixedDocx(true),
  });
  await expect(page.locator(".toast-message")).toContainText(
    "請從 Word 匯出 PDF",
  );
  await expect(page.locator("main.bookshelf-page")).toBeVisible();
  const count = await page.evaluate(async () => {
    const path = "/src/core/storage.ts";
    return (await (await import(path)).loadLibrary()).books.length;
  });
  expect(count).toBe(0);
});

test("ordinary Word still imports as editable flowing paragraphs", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator("main.bookshelf-page")).toBeVisible();
  const files = {
    "[Content_Types].xml": strToU8(
      `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`,
    ),
    "_rels/.rels": strToU8(
      `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="main" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`,
    ),
    "word/document.xml": strToU8(
      `<w:document xmlns:w="${W}"><w:body><w:p><w:r><w:t>Ordinary text stays editable.</w:t></w:r></w:p><w:p><w:r><w:t>Second paragraph follows normally.</w:t></w:r></w:p></w:body></w:document>`,
    ),
  };
  await page.locator("#word-file").setInputFiles({
    name: "ordinary.docx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    buffer: Buffer.from(zipSync(files)),
  });
  await expect(
    page.locator(".book-pages > .paper .page-content").first(),
  ).toContainText("Ordinary text stays editable.");
  await expect(
    page.getByRole("button", { name: "編輯這本筆記", exact: true }),
  ).toBeEnabled();
});
