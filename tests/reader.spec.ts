import { test, expect, type Page } from "@playwright/test";

async function seedText(page: Page) {
  await page.goto("/");
  await expect(page.locator("main.bookshelf-page")).toBeVisible();
  await page.evaluate(async () => {
    const fromTextUrl = "/src/core/fromText.ts";
    const storageUrl = "/src/core/storage.ts";
    const { notebookFromText } = await import(fromTextUrl);
    const { saveNotebook } = await import(storageUrl);
    const notebook = notebookFromText(
      Array.from({ length: 80 }, (_, n) =>
        `## 閱讀段落 ${n + 1}\n\n這是用來驗證閱讀排版的筆記。TCP 與藍牙是不同的網路技術，書本應該保持完整並保留閱讀空間。`.repeat(
          3,
        ),
      ).join("\n\n"),
      "閱讀版面測試",
    );
    await saveNotebook({
      document: notebook,
      anchor: { blockId: notebook.blocks[0].id, offset: 0 },
    });
  });
  await page.reload();
  await expect(page.locator(".book-workspace")).toHaveAttribute(
    "aria-busy",
    "false",
  );
  await expect(page.locator(".book-pages > .paper").first()).toBeVisible();
}
async function assertViewport(page: Page) {
  const metrics = await page.evaluate(() => {
    const book = document.querySelector(".book-shell")!.getBoundingClientRect();
    const header = document
      .querySelector(".site-header")!
      .getBoundingClientRect();
    const workspace = document
      .querySelector(".book-workspace")!
      .getBoundingClientRect();
    const contents = [
      ...document.querySelectorAll(".book-pages > .paper .page-content"),
    ].map((el) => ({
      h: el.clientHeight,
      sh: el.scrollHeight,
      w: el.clientWidth,
      sw: el.scrollWidth,
    }));
    const controls = [
      ...document.querySelectorAll(".reader-actions button"),
    ].map((el) => el.getBoundingClientRect());
    return {
      h: innerHeight,
      w: innerWidth,
      scrollHeight: document.documentElement.scrollHeight,
      scrollWidth: document.documentElement.scrollWidth,
      book: {
        top: book.top,
        bottom: book.bottom,
        width: book.width,
        left: book.left,
      },
      header: {
        left: header.left,
        bottom: header.bottom,
        padding: parseFloat(
          getComputedStyle(document.querySelector(".reader-main")!).paddingLeft,
        ),
      },
      workspace: { width: workspace.width },
      contents,
      controls: controls.map((x) => ({
        left: x.left,
        right: x.right,
        bottom: x.bottom,
      })),
    };
  });
  expect(metrics.scrollHeight).toBeLessThanOrEqual(metrics.h + 1);
  expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.w + 1);
  expect(metrics.book.bottom).toBeLessThanOrEqual(metrics.h - 8);
  expect(metrics.book.top).toBeGreaterThanOrEqual(metrics.header.bottom);
  expect(
    Math.abs(metrics.book.left - metrics.header.padding),
  ).toBeLessThanOrEqual(1);
  expect(metrics.book.width).toBeGreaterThanOrEqual(
    metrics.workspace.width - 2,
  );
  for (const c of metrics.controls) {
    expect(c.left).toBeGreaterThanOrEqual(0);
    expect(c.right).toBeLessThanOrEqual(metrics.w);
    expect(c.bottom).toBeLessThanOrEqual(metrics.header.bottom);
  }
  for (const c of metrics.contents) {
    expect(c.sh).toBeLessThanOrEqual(c.h + 2);
    expect(c.sw).toBeLessThanOrEqual(c.w + 1);
  }
  await page.mouse.move(metrics.w / 2, metrics.h / 2);
  try {
    await page.mouse.wheel(0, 900);
  } catch (error) {
    if (
      !String(error).includes("Mouse wheel is not supported in mobile WebKit")
    )
      throw error;
    await page.evaluate(() => scrollBy(0, 900));
  }
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(0);
}

test("text reading fits desktop, mobile, small height; search, jump and enlarged navigation work", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await seedText(page);
  for (const [width, height] of [
    [1440, 900],
    [1920, 1080],
    [1024, 768],
    [390, 844],
    [320, 568],
    [844, 390],
    [1440, 480],
  ]) {
    await page.setViewportSize({ width, height });
    await page.waitForTimeout(800);
    await expect(page.locator(".book-workspace")).toHaveAttribute(
      "aria-busy",
      "false",
    );
    await assertViewport(page);
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.waitForTimeout(800);
  await page.screenshot({ path: "test-results/reader-desktop.png" });
  await page
    .getByRole("button", { name: "搜尋筆記（⌘K / Ctrl K / /）", exact: true })
    .hover();
  await expect(page.getByRole("tooltip")).toBeVisible();
  await page
    .getByRole("button", { name: "搜尋筆記（⌘K / Ctrl K / /）", exact: true })
    .click();
  await expect(page.getByRole("dialog", { name: "全文搜尋" })).toBeVisible();
  await page.getByRole("textbox", { name: "搜尋整本筆記" }).fill("藍牙");
  await expect(page.locator(".search-result").first()).toBeVisible();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("dialog", { name: "全文搜尋" }),
  ).not.toBeVisible();
  await page.waitForTimeout(250);
  await page.keyboard.press("Control+k");
  await expect(
    page.getByRole("textbox", { name: "搜尋整本筆記" }),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await page.locator(".book-pages > .paper .paper-page-number").first().click();
  await page.getByRole("textbox", { name: "輸入頁碼" }).fill("0");
  await page.getByRole("button", { name: "前往", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("請輸入");
  await page.getByRole("textbox", { name: "輸入頁碼" }).fill("5");
  await page.getByRole("button", { name: "前往", exact: true }).click();
  await expect(page.locator(".book-pages > .paper").first()).toHaveAttribute(
    "data-page",
    "5",
  );
  await page.locator(".book-pages > .paper .paper-page-number").first().click();
  await page.getByRole("button", { name: "最後一頁", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "下一頁", exact: true }),
  ).toBeDisabled();
  await page.locator(".book-pages > .paper .paper-page-number").first().click();
  await page.getByRole("button", { name: "第一頁", exact: true }).click();
  await expect(page.locator(".book-pages > .paper").first()).toHaveAttribute(
    "data-page",
    "1",
  );
  await page
    .getByRole("button", { name: "放大閱讀", exact: true })
    .first()
    .click();
  const detail = page.getByRole("dialog", { name: "放大閱讀", exact: true });
  await expect(detail).toBeVisible();
  await page.getByRole("combobox", { name: "閱讀縮放" }).click();
  await page.getByRole("option", { name: "300%", exact: true }).click();
  await expect
    .poll(() =>
      page
        .locator(".detail-scroll")
        .evaluate((el) => el.scrollHeight > el.clientHeight),
    )
    .toBe(true);
  for (let n = 0; n < 3; n++)
    await page
      .getByRole("button", { name: "放大閱讀：下一頁", exact: true })
      .click();
  await expect(page.locator(".detail-navigation span")).toHaveText(/^4 \/ /);
  await page.waitForTimeout(500);
  await page.keyboard.press("ArrowLeft");
  await expect(page.locator(".detail-navigation span")).toHaveText(/^3 \/ /);
  await page.keyboard.press("Escape");
  await expect(detail).not.toBeVisible();
  await expect(page.locator(".book-pages > .paper").first()).toHaveAttribute(
    "data-page",
    "3",
  );
  await page.getByRole("link", { name: "頁白首頁", exact: true }).click();
  const padding = await page.locator("main.bookshelf-page").evaluate((el) => ({
    main:
      el.getBoundingClientRect().left +
      parseFloat(getComputedStyle(el).paddingLeft),
    header: parseFloat(
      getComputedStyle(document.querySelector(".site-header")!).paddingLeft,
    ),
  }));
  expect(Math.abs(padding.main - padding.header)).toBeLessThan(1);
  expect(errors).toEqual([]);
});

function pdfFixture() {
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R 5 0 R 7 0 R 9 0 R 11 0 R 13 0 R] /Count 6 >>",
  ];
  for (let i = 0; i < 6; i++) {
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 15 0 R >> >> /Contents ${4 + i * 2} 0 R >>`,
    );
    const content = `BT /F1 24 Tf 50 780 Td (PDF reading page ${i + 1}) Tj ET\n`;
    objects.push(
      `<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}endstream`,
    );
  }
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((o, i) => {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets
    .slice(1)
    .forEach((n) => (pdf += `${String(n).padStart(10, "0")} 00000 n \n`));
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(pdf);
}
test("PDF fits pages and enlarged reading scrolls, navigates all pages and restores position", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.locator("#pdf-file").setInputFiles({
    name: "reader-fixture.pdf",
    mimeType: "application/pdf",
    buffer: pdfFixture(),
  });
  await expect(page.locator(".book-workspace")).toHaveAttribute(
    "aria-busy",
    "false",
  );
  await expect(page.locator(".pdf-status")).toHaveCount(0);
  await assertViewport(page);
  const canvas = page.locator(".book-pages > .paper canvas").first();
  await expect
    .poll(() => canvas.evaluate((el) => (el as HTMLCanvasElement).width))
    .toBeGreaterThan(200);
  const bounds = await page
    .locator(".book-pages > .paper .pdf-host")
    .first()
    .evaluate((el) => ({
      host: el.getBoundingClientRect().height,
      surface: el.querySelector(".pdf-surface")!.getBoundingClientRect().height,
    }));
  expect(bounds.surface).toBeLessThanOrEqual(bounds.host + 1);
  await page.screenshot({ path: "test-results/pdf-desktop.png" });
  await page
    .getByRole("button", { name: "放大閱讀", exact: true })
    .first()
    .click();
  await expect(
    page.getByRole("dialog", { name: "放大閱讀", exact: true }),
  ).toBeVisible();
  await page.getByRole("combobox", { name: "閱讀縮放" }).click();
  await page.getByRole("option", { name: "200%", exact: true }).click();
  await expect
    .poll(() =>
      page
        .locator(".detail-scroll")
        .evaluate(
          (el) =>
            el.scrollWidth > el.clientWidth &&
            el.scrollHeight > el.clientHeight,
        ),
    )
    .toBe(true);
  for (let i = 0; i < 5; i++)
    await page
      .getByRole("button", { name: "放大閱讀：下一頁", exact: true })
      .click();
  await expect(page.locator(".detail-navigation span")).toHaveText("6 / 6");
  await expect(
    page.getByRole("button", { name: "放大閱讀：下一頁", exact: true }),
  ).toBeDisabled();
  await expect(page.locator(".reader-detail .pdf-status")).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(page.locator(".book-pages > .paper").first()).toHaveAttribute(
    "data-page",
    "5",
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(800);
  await expect(page.locator(".book-pages > .paper")).toHaveCount(1);
  await expect(page.locator(".pdf-status")).toHaveCount(0);
  await assertViewport(page);
  await page.screenshot({ path: "test-results/pdf-mobile.png" });
  expect(errors).toEqual([]);
});

test("touch toolbar, swipes, highlights and restored reading position", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
    baseURL: "http://127.0.0.1:4112",
  });
  const page = await context.newPage();
  await seedText(page);
  await assertViewport(page);
  await expect(
    page.locator(".reader-actions .touch-action-label").first(),
  ).not.toBeVisible();
  await page.screenshot({ path: "test-results/reader-touch.png" });
  await page.locator(".book-shell").evaluate((el) => {
    const touch = (x: number) => ({
      identifier: 1,
      target: el,
      clientX: x,
      clientY: 300,
    });
    const start = new Event("touchstart", { bubbles: true });
    Object.defineProperty(start, "touches", { value: [touch(300)] });
    el.dispatchEvent(start);
    const end = new Event("touchend", { bubbles: true });
    Object.defineProperty(end, "changedTouches", { value: [touch(100)] });
    el.dispatchEvent(end);
  });
  await expect(page.locator(".book-pages > .paper")).toHaveAttribute(
    "data-page",
    "2",
  );
  const before = await page.locator(".book-workspace").boundingBox();
  await page.getByRole("button", { name: "操作選單", exact: true }).click();
  await page
    .getByRole("button", { name: "重點筆記（0）", exact: true })
    .click();
  await expect(
    page.getByRole("region", { name: "重點筆記", exact: true }),
  ).toBeVisible();
  const after = await page.locator(".book-workspace").boundingBox();
  expect(after).toEqual(before);
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("region", { name: "重點筆記", exact: true }),
  ).not.toBeVisible();
  await page.getByRole("button", { name: "操作選單", exact: true }).click();
  await page.getByRole("button", { name: "切換夜間模式", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.waitForTimeout(700);
  await page.reload();
  await expect(page.locator(".book-workspace")).toHaveAttribute(
    "aria-busy",
    "false",
  );
  await expect(page.locator(".book-pages > .paper")).toHaveAttribute(
    "data-page",
    "2",
  );
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await assertViewport(page);
  await context.close();
});

test("horizontal trackpad wheel flips one spread per gesture and ignores vertical scrolling and pinch", async ({
  page,
}) => {
  await seedText(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  const first = page.locator(".book-pages > .paper").first();
  await page.locator(".book-shell").hover();
  await page.mouse.wheel(0, 300);
  await expect(first).toHaveAttribute("data-page", "1");
  await page
    .locator(".book-shell")
    .dispatchEvent("wheel", { deltaX: 200, deltaY: 0, ctrlKey: true });
  await expect(first).toHaveAttribute("data-page", "1");
  await page.mouse.wheel(120, 4);
  await expect(first).toHaveAttribute("data-page", "3");
  for (let i = 0; i < 8; i++) {
    await page.mouse.wheel(100, 2);
    await page.waitForTimeout(100);
  }
  await expect(first).toHaveAttribute("data-page", "3");
  await page.waitForTimeout(350);
  await page.mouse.wheel(-120, 0);
  await expect(first).toHaveAttribute("data-page", "1");
  await page.waitForTimeout(750);
  await page.mouse.wheel(-120, 0);
  await expect(first).toHaveAttribute("data-page", "1");
  expect(await page.evaluate(() => scrollX)).toBe(0);
});

test("PDF canvas survives selection-layer failure and repeated mobile resizes", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator("main.bookshelf-page")).toBeVisible();
  await page.evaluate(async () => {
    const path = "/src/core/pdf.ts";
    const { pdfjs } = await import(path);
    pdfjs.TextLayer.prototype.render = async () => {
      throw new Error("synthetic selection-layer failure");
    };
  });
  await page.locator("#pdf-file").setInputFiles({
    name: "mobile.pdf",
    mimeType: "application/pdf",
    buffer: pdfFixture(),
  });
  await expect(page.locator(".book-workspace")).toHaveAttribute(
    "aria-busy",
    "false",
  );
  for (const width of [390, 400, 320, 430])
    await page.setViewportSize({ width, height: 844 });
  await expect(page.locator(".book-shell")).toHaveClass(/single/);
  await expect(
    page.locator(".book-pages > .paper .pdf-text-warning").first(),
  ).toBeVisible();
  await expect(page.locator(".pdf-error")).toHaveCount(0);
  const painted = await page
    .locator(".book-pages > .paper canvas")
    .first()
    .evaluate((el: HTMLCanvasElement) => {
      const ctx = el.getContext("2d")!;
      return [...ctx.getImageData(0, 0, el.width, el.height).data].some(
        (n, i) => i % 4 !== 3 && n < 150,
      );
    });
  expect(painted).toBe(true);
  await page.reload();
  await expect(page.locator(".book-workspace")).toHaveAttribute(
    "aria-busy",
    "false",
  );
  await expect(page.locator(".book-pages > .paper .pdf-status")).toHaveCount(0);
  await expect(page.locator(".pdf-text-warning")).toHaveCount(0);
});

test("missing PDF media shows recovery controls and legacy Blob records can be read after retry", async ({
  page,
  browserName,
}) => {
  await page.goto("/");
  await expect(page.locator("main.bookshelf-page")).toBeVisible();
  await page.locator("#pdf-file").setInputFiles({
    name: "recover.pdf",
    mimeType: "application/pdf",
    buffer: pdfFixture(),
  });
  await expect(page.locator(".book-workspace")).toHaveAttribute(
    "aria-busy",
    "false",
  );
  await expect
    .poll(async () =>
      page.evaluate(async () => {
        const path = "/src/core/storage.ts";
        const { loadLibrary } = await import(path);
        return (await loadLibrary()).books.length;
      }),
    )
    .toBe(1);
  const original = await page.evaluate(async () => {
    const a = "/src/core/storage.ts",
      b = "/src/core/media.ts",
      c = "/src/core/database.ts";
    const { loadLibrary } = await import(a),
      { getMedia } = await import(b),
      { database } = await import(c);
    const book = (await loadLibrary()).books[0];
    const asset = await getMedia(book.document.pdfAssetId);
    const { blob, ...metadata } = asset;
    const bytes = Array.from(new Uint8Array(await blob.arrayBuffer()));
    const db = await database();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("notebook", "readwrite");
      tx.objectStore("notebook").delete(`media:${asset.id}`);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
    return { metadata, bytes };
  });
  await page.reload();
  await expect(page.locator(".reader-recovery")).toContainText("暫時無法載入");
  await expect(
    page.getByRole("button", { name: "重試載入筆記", exact: true }),
  ).toBeEnabled();
  await expect(
    page.getByRole("button", { name: "從備份還原", exact: true }),
  ).toBeVisible();
  await page.evaluate(
    async ({ metadata, bytes, legacy }) => {
      const path = "/src/core/database.ts";
      const { database } = await import(path);
      const db = await database();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction("notebook", "readwrite");
        tx.objectStore("notebook").put(
          {
            ...metadata,
            ...(legacy
              ? {
                  blob: new Blob([new Uint8Array(bytes)], {
                    type: metadata.mime,
                  }),
                }
              : { data: new Uint8Array(bytes).buffer }),
          },
          `media:${metadata.id}`,
        );
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      db.close();
    },
    { ...original, legacy: browserName !== "webkit" },
  );
  await page.getByRole("button", { name: "重試載入筆記", exact: true }).click();
  await expect(page.locator(".reader-recovery")).toHaveCount(0);
  await expect(page.locator(".pdf-status")).toHaveCount(0);
  expect(
    await page
      .locator(".book-pages > .paper canvas")
      .first()
      .evaluate((el: HTMLCanvasElement) => el.width),
  ).toBeGreaterThan(100);
});
