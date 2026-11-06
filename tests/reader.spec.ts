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
          getComputedStyle(document.querySelector(".site-header")!).paddingLeft,
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
  await page.mouse.wheel(0, 900);
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
  await page.getByLabel("閱讀縮放").selectOption("3");
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
  await page.getByRole("button", { name: "我的書架", exact: true }).click();
  const padding = await page
    .locator("main.bookshelf-page")
    .evaluate((el) => ({
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
  await page
    .locator("#pdf-file")
    .setInputFiles({
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
  await page.getByLabel("閱讀縮放").selectOption("2");
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
    const touch = (x: number) =>
      new Touch({ identifier: 1, target: el, clientX: x, clientY: 300 });
    el.dispatchEvent(
      new TouchEvent("touchstart", { bubbles: true, touches: [touch(300)] }),
    );
    el.dispatchEvent(
      new TouchEvent("touchend", {
        bubbles: true,
        changedTouches: [touch(100)],
      }),
    );
  });
  await expect(page.locator(".book-pages > .paper")).toHaveAttribute(
    "data-page",
    "2",
  );
  const before = await page.locator(".book-workspace").boundingBox();
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
