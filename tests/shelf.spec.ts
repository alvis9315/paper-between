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
  await page.getByRole("button", { name: "我的書架", exact: true }).click();
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
    page.getByRole("button", { name: "我的書架", exact: true }),
  ).toHaveCount(0);
  await page.locator(".shelf-indicator").click();
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
  await page.getByRole("button", { name: "我的書架", exact: true }).click();
  await expect(page.locator(".shelf-list")).toBeVisible();
  await page.reload();
  await expect(page.locator(".book-workspace")).toHaveAttribute(
    "aria-busy",
    "false",
  );
  await page.getByRole("button", { name: "我的書架", exact: true }).click();
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
