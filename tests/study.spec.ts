import { test, expect, type Page } from "@playwright/test";
import { zipSync, strToU8 } from "fflate";
async function enterDeck(page: Page) {
  await expect(page.getByRole("main", { name: "小卡組管理" })).toBeVisible();
  const open = page.getByRole("button", { name: /^開啟卡組：/ });
  if (await open.count()) await open.first().click();
  else {
    await page
      .getByRole("button", { name: "新增卡組", exact: true })
      .first()
      .click();
    await page
      .getByRole("textbox", { name: "卡組名稱", exact: true })
      .fill("我的小卡");
    await page.getByRole("button", { name: "建立卡組", exact: true }).click();
  }
  await expect(page.locator(".study-page")).toBeVisible();
}
async function seed(page: Page) {
  await page.goto("/");
  await expect(page.locator("main.bookshelf-page")).toBeVisible();
  await page.evaluate(async () => {
    const a = "/src/core/fromText.ts",
      b = "/src/core/storage.ts";
    const { notebookFromText } = await import(a),
      { saveLibrary } = await import(b);
    const document = notebookFromText(
      "## 無線網路\n\n### 藍牙\n\n藍牙使用 2.4 GHz，複習無線網路的連線方式。\n\n### Wi-Fi\n\nWi-Fi 可使用多種頻段，使用 CSMA/CA。\n\n## 有線網路\n\n### CSMA/CD\n\n偵測碰撞之後等待，再重新傳送。",
      "網路複習",
    );
    await saveLibrary({
      books: [
        {
          document,
          anchor: { blockId: document.blocks[0].id, offset: 0 },
          createdAt: Date.now(),
          updatedAt: Date.now(),
          progress: 0,
        },
      ],
      reviewCards: [],
    });
  });
  await page.reload();
  await expect(page.locator(".book-workspace")).toHaveAttribute(
    "aria-busy",
    "false",
  );
  await page.getByRole("link", { name: "頁白首頁" }).click();
  await page.getByRole("button", { name: /^考前小卡/ }).click();
  await enterDeck(page);
}
async function stored(page: Page) {
  return page.evaluate(async () => {
    const path = "/src/core/storage.ts";
    const { loadLibrary } = await import(path);
    return await loadLibrary();
  });
}
test("study cards use headings, filter a related deck, edit, persist, and restore through ZIP", async ({
  page,
}) => {
  await seed(page);
  await page.getByRole("button", { name: "從筆記建立", exact: true }).click();
  const generate = page.getByRole("dialog", {
    name: "從筆記建立小卡",
    exact: true,
  });
  await expect(generate).toContainText("可新增 3 張");
  await generate.getByRole("button", { name: "建立小卡", exact: true }).click();
  await expect(page.locator(".review-card")).toHaveCount(1);
  await expect(page.locator(".review-card")).toContainText("藍牙");
  await page.getByRole("textbox", { name: "搜尋小卡" }).fill("無線");
  await expect(page.locator(".study-filter-status")).toContainText(
    "2 張相關小卡",
  );
  await page.getByRole("button", { name: "下一張小卡", exact: true }).click();
  await expect(page.locator(".review-card h2")).toHaveText("Wi-Fi");
  await page
    .getByRole("complementary", { name: "小卡搜尋結果" })
    .getByRole("button")
    .filter({ hasText: "藍牙" })
    .click();
  await expect(page.locator(".review-card h2")).toHaveText("藍牙");
  await page.getByRole("button", { name: "編輯小卡", exact: true }).click();
  await page
    .getByRole("textbox", { name: "小卡標籤" })
    .fill("無線網路，藍牙專章");
  await page
    .getByRole("textbox", { name: "小卡內容" })
    .fill("藍牙重點已人工確認，使用 2.4 GHz。");
  await page.getByRole("button", { name: "儲存小卡", exact: true }).click();
  await page.getByRole("textbox", { name: "搜尋小卡" }).clear();
  await page.getByRole("button", { name: "# 藍牙專章", exact: true }).click();
  await expect(page.locator(".study-navigation")).toContainText("1 / 1");
  await expect
    .poll(
      async () =>
        (await stored(page)).reviewCards?.find((c: any) => c.title === "藍牙")
          ?.body,
    )
    .toContain("人工確認");
  await page.reload();
  await expect(page.locator(".book-workspace")).toHaveAttribute(
    "aria-busy",
    "false",
  );
  await page.getByRole("link", { name: "頁白首頁" }).click();
  await page.getByRole("button", { name: /^考前小卡/ }).click();
  await enterDeck(page);
  await page.getByRole("button", { name: "從筆記建立", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "從筆記建立小卡" }),
  ).toContainText("可新增 0 張");
  await page
    .getByRole("button", { name: "關閉從筆記建立小卡", exact: true })
    .click();
  const zip = await page.evaluate(async () => {
    const a = "/src/core/storage.ts",
      b = "/src/core/backupBundle.ts";
    const { loadLibrary } = await import(a),
      { createBundle } = await import(b);
    const data = await loadLibrary();
    return Array.from(
      new Uint8Array(
        await (await createBundle(data.books, data.reviewCards)).arrayBuffer(),
      ),
    );
  });
  await page.getByRole("button", { name: "我的書架", exact: true }).click();
  await page.getByRole("button", { name: "匯入備份", exact: true }).click();
  await page.locator("#backup-file").setInputFiles({
    name: "study.zip",
    mimeType: "application/zip",
    buffer: Buffer.from(zip),
  });
  await expect(
    page.getByRole("dialog", { name: "匯入書架備份", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: /^考前小卡/ }).click();
  await enterDeck(page);
  await expect(
    page.getByRole("button", { name: "全部小卡 3", exact: true }),
  ).toBeVisible();
  await expect
    .poll(async () => (await stored(page)).reviewCards?.length)
    .toBe(6);
  expect((await stored(page)).reviewDecks).toHaveLength(2);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("textbox", { name: "搜尋小卡" }).fill("無線");
  await page.locator(".study-result-list > button").first().click();
  await expect(page.locator(".review-card")).toHaveCount(1);
  const before = await page
    .locator(".review-card")
    .getAttribute("data-card-id");
  await page.locator(".review-card").evaluate((el) => {
    const start = new Event("touchstart", { bubbles: true }),
      end = new Event("touchend", { bubbles: true });
    Object.defineProperty(start, "touches", {
      value: [{ clientX: 300, clientY: 300 }],
    });
    Object.defineProperty(end, "changedTouches", {
      value: [{ clientX: 80, clientY: 302 }],
    });
    el.dispatchEvent(start);
    el.dispatchEvent(end);
  });
  await expect(page.locator(".review-card")).not.toHaveAttribute(
    "data-card-id",
    before!,
  );
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
  await expect(page.locator(".study-navigation")).toBeInViewport();
  await expect(
    page.getByRole("button", { name: "編輯小卡", exact: true }),
  ).toBeInViewport();
  await page.screenshot({ path: "test-results/study-mobile.png" });
});

test("manual card-only libraries persist and round-trip without books", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator("main.bookshelf-page")).toBeVisible();
  await page.getByRole("button", { name: /^考前小卡/ }).click();
  await enterDeck(page);
  await page.getByRole("button", { name: "新增小卡", exact: true }).click();
  await page.getByRole("textbox", { name: "小卡標題" }).fill("考前定義");
  await page.getByRole("textbox", { name: "小卡標籤" }).fill("定義");
  await page
    .getByRole("textbox", { name: "小卡內容" })
    .fill("可以獨立建立，不必先有筆記。");
  await page.getByRole("button", { name: "儲存小卡", exact: true }).click();
  await expect
    .poll(async () => (await stored(page)).reviewCards?.length)
    .toBe(1);
  const restored = await page.evaluate(async () => {
    const a = "/src/core/storage.ts",
      b = "/src/core/backupBundle.ts";
    const { loadLibrary } = await import(a),
      { createBundle, readBundle } = await import(b);
    const data = await loadLibrary();
    const zip = await createBundle(data.books, data.reviewCards);
    const books = await readBundle(new File([zip], "cards.zip"));
    return { books: books.length, cards: books.reviewCards };
  });
  expect(restored.books).toBe(0);
  expect(restored.cards).toHaveLength(1);
  await page.reload();
  await page.getByRole("button", { name: /^考前小卡/ }).click();
  await enterDeck(page);
  await expect(page.locator(".review-card")).toContainText("可以獨立建立");
  await page.getByRole("button", { name: "刪除小卡", exact: true }).click();
  await page.getByRole("button", { name: "確認刪除小卡", exact: true }).click();
  await expect(page.locator(".study-empty")).toBeVisible();
});
function layoutPdf() {
  const stream =
    "0.95 0.88 0.8 rg 20 160 270 600 re f\nBT /F1 22 Tf 40 700 Td (Diagram title) Tj ET\nBT /F1 14 Tf 330 700 Td (Right column explanation.) Tj 0 -24 Td (Readable text is reflowed.) Tj 0 -24 Td (Original diagram stays intact.) Tj ET";
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Count 1 /Kids [3 0 R] >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 600 800] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
  ];
  let text = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((o, i) => {
    offsets.push(text.length);
    text += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = text.length;
  text +=
    `xref\n0 6\n0000000000 65535 f \n` +
    offsets
      .slice(1)
      .map((n) => `${String(n).padStart(10, "0")} 00000 n \n`)
      .join("") +
    `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(text);
}
test("PDF reflow keeps the diagram, editable text, original source and image-backed study cards", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator("main.bookshelf-page")).toBeVisible();
  await page.locator("#pdf-file").setInputFiles({
    name: "layout.pdf",
    mimeType: "application/pdf",
    buffer: layoutPdf(),
  });
  await expect(page.locator(".book-workspace")).toHaveAttribute(
    "aria-busy",
    "false",
  );
  await page.getByRole("button", { name: "圖文重排", exact: true }).click();
  const modal = page.getByRole("dialog", { name: "圖文重排", exact: true });
  await expect(
    modal.getByRole("button", { name: "加入這一頁", exact: true }),
  ).toBeEnabled();
  await modal.getByRole("combobox", { name: "重排模板", exact: true }).click();
  await page
    .getByRole("option", { name: "左側圖解，右側說明", exact: true })
    .click();
  await modal.getByRole("slider", { name: "圖解區域佔比" }).fill("50");
  await expect(
    modal.getByRole("textbox", { name: "重排說明文字" }),
  ).toHaveValue(/Right column explanation/);
  await expect(
    modal.getByRole("textbox", { name: "重排說明文字" }),
  ).not.toHaveValue(/Diagram title/);
  await modal.getByRole("textbox", { name: "重排主題標題" }).fill("無線網路");
  await modal
    .getByRole("textbox", { name: "重排說明文字" })
    .fill("這是經過確認的右欄說明。圖解保留，文字可以重新分頁。");
  await modal.getByRole("button", { name: "加入這一頁", exact: true }).click();
  await modal.getByRole("button", { name: "2 確認 1 頁", exact: true }).click();
  await modal.getByRole("textbox", { name: "重排筆記名稱" }).fill("重排複習");
  await modal
    .getByRole("button", { name: "建立重排筆記", exact: true })
    .click();
  await expect(modal).toHaveCount(0);
  await expect(page.locator(".book-workspace")).toHaveAttribute(
    "aria-busy",
    "false",
  );
  await expect(page.locator(".reader-title")).toHaveText("重排複習");
  await expect(
    page.locator(".book-pages > .paper .page-content"),
  ).toContainText(["經過確認"]);
  await expect(
    page.locator(".book-pages > .paper img").first(),
  ).toHaveAttribute("src", /^blob:/);
  await expect.poll(async () => (await stored(page)).books.length).toBe(2);
  const data = await stored(page);
  expect(data.books.filter((b: any) => b.document.pdfAssetId)).toHaveLength(1);
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    await page.waitForTimeout(350);
    await expect(page.locator(".book-workspace")).toHaveAttribute(
      "aria-busy",
      "false",
    );
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
    for (const content of await page
      .locator(".book-pages > .paper .page-content")
      .all())
      expect(
        await content.evaluate((el) => el.scrollHeight <= el.clientHeight + 2),
      ).toBe(true);
  }
  await page.getByRole("link", { name: "頁白首頁" }).click();
  await page.getByRole("button", { name: /^考前小卡/ }).click();
  await enterDeck(page);
  await page.getByRole("button", { name: "從筆記建立", exact: true }).click();
  await page
    .getByRole("combobox", { name: "小卡來源筆記", exact: true })
    .click();
  await page.getByRole("option", { name: "重排複習", exact: true }).click();
  await page.getByRole("button", { name: "建立小卡", exact: true }).click();
  await expect(page.locator(".review-card")).toContainText("經過確認");
  await expect(page.locator(".review-card img")).toHaveAttribute(
    "src",
    /^blob:/,
  );
  await expect
    .poll(async () => (await stored(page)).reviewCards?.length)
    .toBe(1);
  await page.getByRole("button", { name: "編輯小卡", exact: true }).click();
  await page
    .getByRole("textbox", { name: "小卡內容" })
    .fill("圖片與人工確認文字一起保存。");
  await page.getByRole("button", { name: "儲存小卡", exact: true }).click();
  await expect
    .poll(async () => (await stored(page)).reviewCards?.[0]?.body)
    .toBe("圖片與人工確認文字一起保存。");
  const roundtrip = await page.evaluate(async () => {
    const a = "/src/core/storage.ts",
      b = "/src/core/backupBundle.ts";
    const { loadLibrary } = await import(a),
      { createBundle, readBundle } = await import(b);
    const state = await loadLibrary();
    const blob = await createBundle(state.books, state.reviewCards);
    const restored = await readBundle(new File([blob], "complete.zip"));
    return { books: restored.length, cards: restored.reviewCards };
  });
  expect(roundtrip.books).toBe(2);
  expect(roundtrip.cards?.[0].image).toBeTruthy();
  await page.reload();
  await expect(page.locator(".book-workspace")).toHaveAttribute(
    "aria-busy",
    "false",
  );
  await page.getByRole("link", { name: "頁白首頁" }).click();
  await page.getByRole("button", { name: /^考前小卡/ }).click();
  await enterDeck(page);
  await expect(page.locator(".review-card")).toContainText(
    "圖片與人工確認文字一起保存。",
  );
  await expect
    .poll(() =>
      page
        .locator(".review-card img")
        .evaluate((el: HTMLImageElement) => el.naturalWidth),
    )
    .toBeGreaterThan(0);
});

test("PDF can be imported directly into study cards and malformed card backups leave data intact", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator("main.bookshelf-page")).toBeVisible();
  await page.getByRole("button", { name: /^考前小卡/ }).click();
  await enterDeck(page);
  await page.getByRole("button", { name: "從筆記建立", exact: true }).click();
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "匯入 PDF", exact: true }).click();
  await (
    await chooser
  ).setFiles({
    name: "direct-review.pdf",
    mimeType: "application/pdf",
    buffer: layoutPdf(),
  });
  await expect(page.locator(".study-page")).toBeVisible();
  await expect(page.locator(".review-card")).toContainText(
    "Right column explanation",
  );
  await expect
    .poll(async () => (await stored(page)).reviewCards?.length)
    .toBe(1);
  await page.getByRole("button", { name: "我的書架", exact: true }).click();
  await page.getByRole("button", { name: "匯入備份", exact: true }).click();
  const invalid = zipSync({
    "manifest.json": strToU8(
      JSON.stringify({
        format: "paper-between-bundle",
        version: 2,
        books: [],
        assets: [],
        reviewCards: [{ title: "invalid", body: 123, tags: [] }],
      }),
    ),
  });
  await page.locator("#backup-file").setInputFiles({
    name: "invalid-cards.zip",
    mimeType: "application/zip",
    buffer: Buffer.from(invalid),
  });
  await expect(
    page.getByRole("dialog", { name: "匯入書架備份" }).getByRole("alert"),
  ).toContainText("尚未加入任何內容");
  const state = await stored(page);
  expect(state.books).toHaveLength(1);
  expect(state.reviewCards).toHaveLength(1);
});

test("large related card sets can reveal more results and jump directly to the last card", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator("main.bookshelf-page")).toBeVisible();
  await page.evaluate(async () => {
    const path = "/src/core/storage.ts";
    const { saveLibrary } = await import(path);
    await saveLibrary({
      books: [],
      reviewCards: Array.from({ length: 73 }, (_, i) => ({
        id: crypto.randomUUID(),
        title: `考前重點 ${i + 1}`,
        body: "同一主題的相關內容。",
        tags: ["共同主題"],
        sourceTitle: "自建小卡",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      })),
    });
  });
  await page.reload();
  await page.getByRole("button", { name: /^考前小卡/ }).click();
  await enterDeck(page);
  await page.getByRole("textbox", { name: "搜尋小卡" }).fill("共同主題");
  const results = page.getByRole("complementary", { name: "小卡搜尋結果" });
  await expect(results.locator("strong")).toHaveCount(60);
  await results
    .getByRole("button", { name: "顯示更多小卡（還有 13 張）", exact: true })
    .click();
  await expect(results.locator("strong")).toHaveCount(73);
  await results.getByRole("button").filter({ hasText: "考前重點 73" }).click();
  await expect(page.locator(".study-navigation")).toContainText("73 / 73");
  await expect(page.locator(".review-card h2")).toHaveText("考前重點 73");
});
