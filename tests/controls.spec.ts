import { test, expect, type Page } from "@playwright/test";
async function reading(page: Page) {
  await page.goto("/");
  await expect(page.locator("main.bookshelf-page")).toBeVisible();
  await page.evaluate(async () => {
    const textPath = "/src/core/fromText.ts",
      storagePath = "/src/core/storage.ts";
    const { notebookFromText } = await import(textPath);
    const { saveNotebook } = await import(storagePath);
    const document = notebookFromText(
      Array.from(
        { length: 45 },
        (_, i) =>
          `## 段落 ${i + 1}\n\n閱讀時，翻頁按鈕不應蓋住原文。選單應該有一致的日夜色票與鍵盤操作。`,
      ).join("\n\n"),
      "元件與閱讀測試",
    );
    document.warnings = ["這是測試用的文件提醒。"];
    const block = document.blocks[1];
    document.annotations = [
      {
        id: "sample-highlight",
        targets: [
          {
            blockId: block.id,
            start: 0,
            end: 4,
            exact: block.text.slice(0, 4),
            prefix: "",
            suffix: block.text.slice(4, 24),
          },
        ],
        category: "important",
        tags: [],
        comment: "",
        createdAt: Date.now(),
        updatedAt: Date.now(),
        status: "linked",
      },
    ];
    await saveNotebook({
      document,
      anchor: { blockId: document.blocks[0].id, offset: 0 },
    });
  });
  await page.reload();
  await expect(page.locator(".book-workspace")).toHaveAttribute(
    "aria-busy",
    "false",
  );
}

test("reading controls stay clear of content, tooltips appear, and enlarged toolbar stays centered", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await reading(page);
  const next = page.getByRole("button", { name: "下一頁", exact: true });
  const before = await next.evaluate((el) => ({
    background: getComputedStyle(el).backgroundColor,
    button: el.getBoundingClientRect().left,
    content: el
      .parentElement!.querySelector(".right-paper .page-content")!
      .getBoundingClientRect().right,
  }));
  expect(before.background).toBe("rgba(0, 0, 0, 0)");
  expect(before.button).toBeGreaterThanOrEqual(before.content);
  for (const width of [2868, 1440, 1024, 820, 819, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await expect
      .poll(() =>
        page
          .locator(".book-shell")
          .evaluate((el) => Math.round(el.getBoundingClientRect().width)),
      )
      .toBeGreaterThan(width * 0.8);
    await page.waitForTimeout(400);
    await expect(page.locator(".book-workspace")).toHaveAttribute(
      "aria-busy",
      "false",
    );
    const geometry = await page.locator(".book-shell").evaluate((el) => {
      const cover = el.querySelector(".book-cover")!.getBoundingClientRect();
      const buttons = [...el.querySelectorAll(".page-edge")].map((button) =>
        button.getBoundingClientRect(),
      );
      const protectedAreas = [
        ...el.querySelectorAll(
          ".book-pages > .paper .page-content, .paper-page-number, .page-enlarge-action",
        ),
      ].map((area) => area.getBoundingClientRect());
      const intersects = (a: DOMRect, b: DOMRect) =>
        a.left < b.right &&
        a.right > b.left &&
        a.top < b.bottom &&
        a.bottom > b.top;
      return {
        cover: { left: cover.left, right: cover.right },
        buttons: buttons.map((b) => ({
          left: b.left,
          right: b.right,
          bottom: b.bottom,
          overlap: protectedAreas.some((area) => intersects(b, area)),
        })),
        padding: getComputedStyle(el.querySelector(".paper")!).paddingLeft,
      };
    });
    expect(geometry.padding).toBe(width < 820 ? "12px" : "16px");
    for (const button of geometry.buttons) {
      expect(button.left).toBeGreaterThanOrEqual(0);
      expect(button.right).toBeLessThanOrEqual(width);
      expect(button.bottom).toBeLessThanOrEqual(900);
      expect(button.overlap).toBe(false);
    }
    if (width >= 820) {
      expect(geometry.buttons[0].right).toBeLessThan(geometry.cover.left);
      expect(geometry.buttons[1].left).toBeGreaterThan(geometry.cover.right);
    }
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.waitForTimeout(400);
  await next.hover();
  await expect
    .poll(() => next.evaluate((el) => getComputedStyle(el).backgroundColor))
    .not.toBe(before.background);
  await page.mouse.move(0, 0);
  const zoom = page
    .getByRole("button", { name: "放大閱讀", exact: true })
    .first();
  await zoom.hover();
  await expect(
    page.getByRole("tooltip", { name: "放大閱讀", exact: true }),
  ).toBeVisible();
  await expect(zoom).not.toHaveAttribute("title");
  await page.screenshot({ path: "test-results/controls-reader-tooltip.png" });
  await page.locator(".paper-page-number").first().click();
  for (const name of ["第一頁", "最後一頁"]) {
    const center = await page
      .getByRole("button", { name, exact: true })
      .locator("svg")
      .evaluate((el) => {
        const bounds = (el as SVGGraphicsElement).getBBox();
        return bounds.y + bounds.height / 2;
      });
    expect(center).toBeCloseTo(12, 1);
  }
  await page.screenshot({ path: "test-results/controls-jump.png" });
  await page.keyboard.press("Escape");
  await zoom.click();
  const detail = page.getByRole("dialog", { name: "放大閱讀", exact: true });
  const scale = page.getByRole("combobox", { name: "閱讀縮放" });
  await expect(scale).toContainText("適中");
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    const position = await page.locator(".detail-toolbar").evaluate((el) => {
      const toolbar = el.getBoundingClientRect(),
        nav = el.querySelector(".detail-navigation")!.getBoundingClientRect(),
        zoom = el.querySelector(".detail-zoom")!.getBoundingClientRect(),
        close = el.querySelector(":scope > button")!.getBoundingClientRect();
      return {
        center: toolbar.x + toolbar.width / 2,
        nav: nav.x + nav.width / 2,
        left: zoom.right,
        navLeft: nav.left,
        navRight: nav.right,
        close: close.left,
      };
    });
    expect(Math.abs(position.nav - position.center)).toBeLessThan(1);
    expect(position.left).toBeLessThanOrEqual(position.navLeft);
    expect(position.navRight).toBeLessThanOrEqual(position.close);
    if (width === 1440)
      await page.screenshot({
        path: "test-results/controls-enlarged-desktop.png",
      });
  }
  await scale.click();
  await expect(
    page.getByRole("listbox", { name: "閱讀縮放選項" }),
  ).toBeVisible();
  await page.screenshot({ path: "test-results/controls-zoom-menu-mobile.png" });
  await page.keyboard.press("End");
  await page.keyboard.press("Enter");
  await expect(scale).toContainText("300%");
  await expect(detail).toBeVisible();
  await expect
    .poll(() =>
      page
        .locator(".detail-scroll")
        .evaluate((el) => el.scrollHeight > el.clientHeight),
    )
    .toBe(true);
  await scale.click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("listbox")).not.toBeVisible();
  await expect(detail).toBeVisible();
  await page.keyboard.press("Tab");
  await page.screenshot({ path: "test-results/controls-enlarged-mobile.png" });
  await page.keyboard.press("Escape");
  await expect(detail).not.toBeVisible();
  expect(errors).toEqual([]);
});

test("custom controls cover highlights, editor layout, disclosure and check/radio inputs", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await reading(page);
  await page.getByRole("button", { name: "切換夜間模式", exact: true }).click();
  await page
    .getByRole("button", { name: "文件資訊與提醒（1）", exact: true })
    .click();
  const reminder = page.getByRole("button", {
    name: "文件提醒（1）",
    exact: true,
  });
  await expect(reminder).toHaveAttribute("aria-expanded", "true");
  await reminder.click();
  await expect(reminder).toHaveAttribute("aria-expanded", "false");
  await page.getByRole("button", { name: "關閉文件資訊", exact: true }).click();
  await page
    .getByRole("button", { name: "重點筆記（1）", exact: true })
    .click();
  await page.getByRole("combobox", { name: "重點範圍", exact: true }).click();
  await page.screenshot({ path: "test-results/controls-select-dark.png" });
  await page.getByRole("option", { name: "全部筆記", exact: true }).click();
  await page.getByRole("combobox", { name: "摘錄分類", exact: true }).click();
  await page.getByRole("option", { name: "定義", exact: true }).click();
  await expect(
    page.getByRole("combobox", { name: "摘錄分類", exact: true }),
  ).toContainText("定義");
  await page.getByRole("combobox", { name: "重點分類", exact: true }).click();
  await page.getByRole("option", { name: "疑問", exact: true }).click();
  await expect(page.locator(".highlight-card")).toHaveCount(0);
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "貼上文字", exact: true }).click();
  for (const type of ["checkbox", "radio"]) {
    const input = page.locator(`input[type=${type}]`).first();
    await expect(input).toBeVisible();
    expect(await input.evaluate((el) => getComputedStyle(el).appearance)).toBe(
      "none",
    );
  }
  await page.getByLabel("辨識基本格式").uncheck();
  await expect(page.getByLabel("辨識基本格式")).not.toBeChecked();
  await page.getByLabel("追加到目前筆記").check();
  await expect(page.getByLabel("追加到目前筆記")).toBeChecked();
  await page.getByRole("button", { name: "關閉文字輸入", exact: true }).click();
  await page.getByRole("button", { name: "新增圖文筆記", exact: true }).click();
  const png = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 8;
    canvas.height = 8;
    canvas.getContext("2d")!.fillRect(0, 0, 8, 8);
    return canvas.toDataURL("image/png").split(",")[1]!;
  });
  await page.locator("#image-files").setInputFiles({
    name: "synthetic.png",
    mimeType: "image/png",
    buffer: Buffer.from(png, "base64"),
  });
  const layout = page.getByRole("combobox", { name: "圖文版型", exact: true });
  await expect(layout).toBeVisible();
  await layout.click();
  await page.getByRole("option", { name: "上圖下文", exact: true }).click();
  await expect(page.locator(".editor-figure")).toHaveClass(/stacked/);
  await page
    .getByRole("button", { name: "刪除此圖文區塊", exact: true })
    .hover();
  await expect(
    page.getByRole("tooltip", { name: "刪除此圖文區塊", exact: true }),
  ).toBeVisible();
  await expect(
    page.locator("select,details,summary,button[title]"),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "關閉編輯", exact: true }).click();
  expect(errors).toEqual([]);
});

test("reading guide stays above the header, fits short windows and shows scrollbar only during scrolling", async ({
  page,
}) => {
  await reading(page);
  for (const viewport of [
    { width: 1440, height: 480 },
    { width: 320, height: 568 },
  ]) {
    await page.setViewportSize(viewport);
    await expect(page.locator(".book-workspace")).toHaveAttribute(
      "aria-busy",
      "false",
    );
    await page.getByRole("button", { name: "閱讀指南", exact: true }).click();
    const guide = page.getByRole("dialog", { name: "閱讀指南", exact: true });
    await expect(guide).toBeVisible();
    const box = await guide.boundingBox();
    expect(box!.y).toBeGreaterThanOrEqual(19);
    expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height - 19);
    await expect(
      guide.getByRole("button", { name: "關閉閱讀指南" }),
    ).toBeInViewport();
    const content = guide.locator(".bounded-modal-body");
    expect(
      await content.evaluate((el) => el.scrollHeight > el.clientHeight),
    ).toBe(true);
    await expect(content).not.toHaveClass(/is-scrolling/);
    expect(
      await content.evaluate((el) => getComputedStyle(el).scrollbarColor),
    ).toBe("rgba(0, 0, 0, 0) rgba(0, 0, 0, 0)");
    await content.hover();
    await page.mouse.wheel(0, 230);
    await expect(content).toHaveClass(/is-scrolling/);
    expect(
      await content.evaluate((el) => getComputedStyle(el).scrollbarColor),
    ).not.toBe("rgba(0, 0, 0, 0) rgba(0, 0, 0, 0)");
    await expect(content).not.toHaveClass(/is-scrolling/);
    await page.screenshot({ path: `test-results/guide-${viewport.width}.png` });
    await page.keyboard.press("Escape");
    await expect(guide).toHaveCount(0);
  }
});
