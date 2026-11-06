import { test, expect, type Page } from "@playwright/test";

async function shelf(page: Page) {
  await page.goto("/");
  await expect(page.locator("main.bookshelf-page")).toBeVisible();
  await page.evaluate(async () => {
    const textPath = "/src/core/fromText.ts";
    const storagePath = "/src/core/storage.ts";
    const { notebookFromText } = await import(textPath);
    const { saveLibrary } = await import(storagePath);
    const books = [
      "散步時收集的想法",
      "網路原理與圖解",
      "一本名稱特別長的筆記：記錄讀書時想到的問題與值得回頭重讀的段落",
      "文字與留白",
    ].map((title, i) => {
      const document = notebookFromText(
        "## 閱讀筆記\n\n把今天的想法記下來。\n\n每一本書都有不同的節奏。",
        title,
      );
      return {
        document,
        anchor: { blockId: document.blocks[0].id, offset: 0 },
        createdAt: Date.now(),
        updatedAt: Date.now() - i * 1000,
        progress: i * 0.2,
      };
    });
    await saveLibrary({ books, activeId: books[0]!.document.id });
  });
  await page.reload();
  await expect(page.locator(".book-workspace")).toHaveAttribute(
    "aria-busy",
    "false",
  );
  await page.getByRole("link", { name: "頁白首頁", exact: true }).click();
  await expect(page.locator("main.bookshelf-page")).toBeVisible();
  await expect(page.locator(".book-card")).toHaveCount(4);
}

test("shelf navigation stays on shelf; views persist and all list actions work", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await shelf(page);
  await expect(
    page.locator('.site-header [aria-label="我的書架"]'),
  ).toHaveCount(0);
  await expect(page.locator(".shelf-indicator")).toHaveCount(0);
  await page.getByRole("link", { name: "頁白首頁" }).click();
  await expect(page.locator("main.bookshelf-page")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "卡片式", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "條列式", exact: true }).click();
  await expect(page.locator(".shelf-list")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "條列式", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("textbox", { name: "搜尋筆記名稱" }).fill("網路");
  await expect(page.locator(".book-card")).toHaveCount(1);
  await page.getByRole("button", { name: "重新命名", exact: true }).click();
  await page
    .getByRole("textbox", { name: "新的筆記名稱" })
    .fill("網路原理複習");
  await page.getByRole("button", { name: "儲存", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "網路原理複習", exact: true }).last(),
  ).toBeVisible();
  await page.getByRole("button", { name: "複製", exact: true }).click();
  await expect(page.locator(".book-card")).toHaveCount(2);
  await page
    .locator(".book-card")
    .first()
    .getByRole("button", { name: "移到回收桶", exact: true })
    .click();
  await expect(page.locator(".book-card")).toHaveCount(1);
  await page.getByRole("textbox", { name: "搜尋筆記名稱" }).clear();
  await page.getByRole("button", { name: /^回收桶/ }).click();
  await expect(page.locator(".book-card")).toHaveCount(1);
  await page.getByRole("button", { name: "還原筆記", exact: true }).click();
  await expect(page.locator(".shelf-empty")).toBeVisible();
  await page.getByRole("button", { name: /^我的筆記/ }).click();
  await expect(page.locator(".book-card")).toHaveCount(5);
  await page.locator(".book-open").first().click();
  await expect(page.locator(".book-workspace")).toHaveAttribute(
    "aria-busy",
    "false",
  );
  await page.getByRole("link", { name: "頁白首頁", exact: true }).click();
  await expect(page.locator(".shelf-list")).toBeVisible();
  await page.reload();
  await expect(page.locator(".book-workspace")).toHaveAttribute(
    "aria-busy",
    "false",
  );
  await page.getByRole("link", { name: "頁白首頁", exact: true }).click();
  await expect(page.locator(".shelf-list")).toBeVisible();
  await page.getByRole("button", { name: "卡片式", exact: true }).click();
  await expect(page.locator(".shelf-grid")).not.toHaveClass(/shelf-list/);
  expect(errors).toEqual([]);
});

test("cocoa stays consistent across themes; lift respects reduced motion and views fit mobile", async ({
  page,
}) => {
  await shelf(page);
  const cover = page.locator(".mini-book").first();
  const light = await cover.evaluate((el) => ({
    cover: getComputedStyle(el).backgroundColor,
    accent: getComputedStyle(document.documentElement)
      .getPropertyValue("--accent")
      .trim(),
  }));
  await page.getByRole("button", { name: "切換夜間模式", exact: true }).click();
  const dark = await cover.evaluate((el) => ({
    cover: getComputedStyle(el).backgroundColor,
    accent: getComputedStyle(document.documentElement)
      .getPropertyValue("--accent")
      .trim(),
    ink: getComputedStyle(el).color,
  }));
  expect(dark.cover).toBe(light.cover);
  expect(dark.accent).toBe(light.accent);
  expect(dark.ink).toBe("rgb(89, 69, 53)");
  await page.locator(".book-open").first().hover();
  await expect
    .poll(() => cover.evaluate((el) => getComputedStyle(el).transform))
    .not.toBe("none");
  await page.screenshot({ path: "test-results/shelf-dark-cards.png" });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect
    .poll(() => cover.evaluate((el) => getComputedStyle(el).transform))
    .toBe("none");
  await page.getByRole("button", { name: "條列式", exact: true }).click();
  await page.mouse.move(0, 0);
  await expect
    .poll(() =>
      page
        .locator(".shelf-list .mini-book h2")
        .first()
        .evaluate((el) => getComputedStyle(el).fontSize),
    )
    .toBe("10px");
  await expect
    .poll(() =>
      page
        .locator(".shelf-list .book-card")
        .first()
        .evaluate((el) => el.getBoundingClientRect().height),
    )
    .toBeLessThan(190);
  await page.screenshot({ path: "test-results/shelf-dark-list.png" });
  for (const width of [390, 320, 768]) {
    await page.setViewportSize({ width, height: 844 });
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
      .toBeLessThanOrEqual(width);
    await expect(
      page.getByRole("button", { name: "卡片式", exact: true }),
    ).toBeInViewport();
    await expect(
      page.getByRole("button", { name: "條列式", exact: true }),
    ).toBeInViewport();
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: "test-results/shelf-dark-mobile.png" });
  await page.getByRole("button", { name: "切換白天模式", exact: true }).click();
  await page.getByRole("button", { name: "卡片式", exact: true }).click();
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
    .toBeLessThanOrEqual(390);
});

async function manyBooks(page: Page) {
  await page.goto("/");
  await expect(page.locator("main.bookshelf-page")).toBeVisible();
  await page.evaluate(async () => {
    const textPath = "/src/core/fromText.ts",
      storagePath = "/src/core/storage.ts";
    const { notebookFromText } = await import(textPath);
    const { saveLibrary } = await import(storagePath);
    const books = Array.from({ length: 27 }, (_, i) => {
      const document = notebookFromText(
        "書架分頁與收藏的測試內容。",
        `收藏筆記 ${String(i + 1).padStart(2, "0")}`,
      );
      return {
        document,
        anchor: { blockId: document.blocks[0].id, offset: 0 },
        createdAt: Date.now(),
        updatedAt: Date.now() - i * 1000,
        progress: 0,
        favorite: i === 0,
      };
    });
    await saveLibrary({ books, activeId: books[0].document.id });
  });
  await page.reload();
  await expect(page.locator(".book-workspace")).toHaveAttribute(
    "aria-busy",
    "false",
  );
  await page.getByRole("link", { name: "頁白首頁" }).click();
}

test("shelf paginates 6/12/24 books, resets filters, persists favorites and evenly spaces actions", async ({
  page,
}) => {
  await manyBooks(page);
  await expect(page.locator(".book-card")).toHaveCount(12);
  const pages = page.getByRole("navigation", { name: "書架分頁" });
  await expect(pages).toContainText("第 1–12 本，共 27 本");
  await page
    .getByRole("button", { name: "書架：最後一頁", exact: true })
    .click();
  await expect(page.locator(".book-card")).toHaveCount(3);
  await expect(pages).toContainText("第 25–27 本");
  await page.getByRole("textbox", { name: "書架頁碼" }).fill("0");
  await pages.getByRole("button", { name: "前往" }).click();
  await expect(pages.getByRole("alert")).toBeVisible();
  await page.getByRole("textbox", { name: "書架頁碼" }).fill("2");
  await pages.getByRole("button", { name: "前往" }).click();
  await expect(pages).toContainText("第 13–24 本");
  await page
    .getByRole("combobox", { name: "每頁顯示筆記數", exact: true })
    .click();
  await page.getByRole("option", { name: "每頁 6 本", exact: true }).click();
  await expect(page.locator(".book-card")).toHaveCount(6);
  await expect(pages).toContainText("第 1–6 本");
  await page.getByRole("button", { name: "書架：下一頁", exact: true }).click();
  await page.getByRole("textbox", { name: "搜尋筆記名稱" }).fill("27");
  await expect(page.locator(".book-card")).toHaveCount(1);
  await expect(pages).toHaveCount(0);
  await page.getByRole("textbox", { name: "搜尋筆記名稱" }).clear();
  await page.getByRole("button", { name: /^我的最愛/ }).click();
  await expect(page.locator(".book-card")).toHaveCount(1);
  await page.getByRole("button", { name: "移除我的最愛", exact: true }).click();
  await expect(page.locator(".shelf-empty")).toContainText("點筆記下方的星星");
  await page.getByRole("button", { name: /^我的筆記/ }).click();
  await page
    .locator(".book-card")
    .first()
    .getByRole("button", { name: "加入我的最愛", exact: true })
    .click();
  await page.getByRole("button", { name: /^我的最愛/ }).click();
  await expect(page.locator(".book-card")).toHaveCount(1);
  const gaps = await page
    .locator(".book-card-actions")
    .first()
    .evaluate((el) => {
      const box = el.getBoundingClientRect();
      const buttons = [...el.querySelectorAll("button")].map((b) =>
        b.getBoundingClientRect(),
      );
      return [
        buttons[0].left - box.left,
        ...buttons.slice(1).map((b, i) => b.left - buttons[i].right),
        box.right - buttons.at(-1)!.right,
      ];
    });
  expect(Math.max(...gaps) - Math.min(...gaps)).toBeLessThan(2);
  await page.getByRole("button", { name: "移到回收桶", exact: true }).click();
  await expect(page.locator(".shelf-empty")).toBeVisible();
  await page.getByRole("button", { name: /^回收桶/ }).click();
  await page.getByRole("button", { name: "還原筆記", exact: true }).click();
  await page.getByRole("button", { name: /^我的最愛/ }).click();
  await expect(page.locator(".book-card")).toHaveCount(1);
  await expect
    .poll(() =>
      page.evaluate(async () => {
        const path = "/src/core/storage.ts";
        const { loadLibrary } = await import(path);
        return (await loadLibrary()).books.filter((b: any) => b.favorite)
          .length;
      }),
    )
    .toBe(1);
  await page.reload();
  await expect(page.locator(".book-workspace")).toHaveAttribute(
    "aria-busy",
    "false",
  );
  await page.getByRole("link", { name: "頁白首頁" }).click();
  await expect(page.locator(".book-card")).toHaveCount(6);
  await page
    .getByRole("combobox", { name: "每頁顯示筆記數", exact: true })
    .click();
  await page.getByRole("option", { name: "每頁 24 本", exact: true }).click();
  await expect(page.locator(".book-card")).toHaveCount(24);
  await page.getByRole("button", { name: /^我的最愛/ }).click();
  await expect(page.locator(".book-card")).toHaveCount(1);
  await page.screenshot({ path: "test-results/shelf-favorites.png" });
});

test("backup guide handles wrong formats, corrupt files, ZIP favorites and legacy JSON", async ({
  page,
}) => {
  await shelf(page);
  await page.getByRole("button", { name: "匯入備份", exact: true }).click();
  const dialog = page.getByRole("dialog", {
    name: "匯入書架備份",
    exact: true,
  });
  await expect(dialog).toContainText("不需要解壓縮");
  for (const file of [
    {
      name: "document.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF"),
    },
    {
      name: "broken.zip",
      mimeType: "application/zip",
      buffer: Buffer.from("not a zip"),
    },
    {
      name: "broken.json",
      mimeType: "application/json",
      buffer: Buffer.from("{"),
    },
  ]) {
    await page.locator("#backup-file").setInputFiles(file);
    await expect(dialog.getByRole("alert")).toContainText("原有書架完整保留");
    await expect(page.locator(".book-card")).toHaveCount(4);
    await expect(
      dialog.getByRole("button", { name: /重新選擇備份/ }),
    ).toBeEnabled();
  }
  await page.screenshot({ path: "test-results/backup-format-guide.png" });
  const backups = await page.evaluate(async () => {
    const textPath = "/src/core/fromText.ts",
      backupPath = "/src/core/backup.ts",
      bundlePath = "/src/core/backupBundle.ts";
    const { notebookFromText } = await import(textPath);
    const { exportBackup } = await import(backupPath);
    const { createBundle } = await import(bundlePath);
    const document = notebookFromText("完整備份內容", "ZIP 收藏還原");
    const record = {
      document,
      anchor: { blockId: document.blocks[0].id, offset: 0 },
      createdAt: Date.now(),
      updatedAt: Date.now(),
      progress: 0.5,
      favorite: true,
    };
    const zip = await createBundle([record]);
    const json = JSON.parse(exportBackup([record]));
    delete json.books[0].favorite;
    json.books[0].title = "舊版 JSON 還原";
    return {
      zip: Array.from(new Uint8Array(await zip.arrayBuffer())),
      json: JSON.stringify(json),
    };
  });
  await page.locator("#backup-file").setInputFiles({
    name: "books.zip",
    mimeType: "application/zip",
    buffer: Buffer.from(backups.zip),
  });
  await expect(dialog).toHaveCount(0);
  await expect(page.locator(".book-card")).toHaveCount(5);
  await page.getByRole("button", { name: /^我的最愛/ }).click();
  await expect(page.locator(".book-card")).toHaveCount(1);
  await expect(page.locator(".book-card")).toContainText("ZIP 收藏還原");
  await page.getByRole("button", { name: "匯入備份", exact: true }).click();
  await page.locator("#backup-file").setInputFiles({
    name: "legacy.json",
    mimeType: "application/json",
    buffer: Buffer.from(backups.json),
  });
  await expect(dialog).toHaveCount(0);
  await expect(page.locator(".book-card")).toHaveCount(1);
  await page.getByRole("button", { name: /^我的筆記/ }).click();
  await expect(page.locator(".book-card")).toHaveCount(6);
  await expect(
    page.getByRole("button", { name: "閱讀《舊版 JSON 還原》", exact: true }),
  ).toBeVisible();
});

test("touch book actions fit 320px and deleting the last shelf page clamps pagination", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 320, height: 720 },
    hasTouch: true,
    isMobile: true,
    baseURL: "http://127.0.0.1:4112",
  });
  const page = await context.newPage();
  try {
    await manyBooks(page);
    await page
      .getByRole("combobox", { name: "每頁顯示筆記數", exact: true })
      .click();
    await page.getByRole("option", { name: "每頁 6 本", exact: true }).click();
    await page.getByRole("textbox", { name: "書架頁碼" }).fill("3");
    await page
      .getByRole("navigation", { name: "書架分頁" })
      .getByRole("button", { name: "前往" })
      .click();
    await expect(page.locator(".collection-mobile-count")).toHaveText("3 / 5");
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(320);

    await page
      .getByRole("combobox", { name: "每頁顯示筆記數", exact: true })
      .click();
    await page.getByRole("option", { name: "每頁 24 本", exact: true }).click();
    await page
      .getByRole("button", { name: "書架：最後一頁", exact: true })
      .click();
    await expect(page.locator(".book-card")).toHaveCount(3);
    const actions = page.locator(".book-card-actions").first();
    await actions.scrollIntoViewIfNeeded();
    const geometry = await actions.evaluate((el) => {
      const box = el.getBoundingClientRect();
      return [...el.querySelectorAll("button")].map((button) => {
        const rect = button.getBoundingClientRect();
        return {
          left: rect.left - box.left,
          right: box.right - rect.right,
          width: rect.width,
          clipped: button.scrollWidth > button.clientWidth,
        };
      });
    });
    expect(geometry).toHaveLength(5);
    for (const action of geometry) {
      expect(action.left).toBeGreaterThanOrEqual(0);
      expect(action.right).toBeGreaterThanOrEqual(0);
      expect(action.width).toBeGreaterThanOrEqual(44);
      expect(action.clipped).toBe(false);
    }
    await page.screenshot({ path: "test-results/shelf-touch-actions.png" });
    for (let i = 0; i < 3; i++)
      await page
        .getByRole("button", { name: "移到回收桶", exact: true })
        .first()
        .click();
    await expect(page.locator(".book-card")).toHaveCount(24);
    await expect(
      page.getByRole("navigation", { name: "書架分頁" }),
    ).toHaveCount(0);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(320);
  } finally {
    await context.close();
  }
});
