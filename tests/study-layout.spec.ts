import { test, expect, type Page } from "@playwright/test";

async function openCards(page: Page) {
  await page.goto("/");
  await expect(page.locator("main.bookshelf-page")).toBeVisible();
  await page.getByRole("button", { name: /^考前小卡/ }).click();
  await expect(page.locator(".study-page")).toBeVisible();
}
async function sampleDeck(page: Page) {
  const image = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 640;
    canvas.height = 240;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, 640, 240);
    ctx.fillStyle = "#88634f";
    ctx.fillRect(30, 50, 180, 100);
    ctx.fillRect(350, 50, 180, 100);
    ctx.fillStyle = "#d8c4ae";
    ctx.fillRect(210, 90, 140, 8);
    return canvas.toDataURL("image/png");
  });
  const cards = [
    {
      id: "one",
      source: "review",
      kind: "review",
      section: "拓樸與線路",
      title: "Mesh 與 Star 怎麼連？",
      tags: ["拓樸"],
      pages: [1],
      summary: "網狀兩兩連接；星狀接中央節點。",
      keywords: ["topology"],
      context: "",
      answerHtml:
        "<table><thead><tr><th>拓樸</th><th>連接方式與特徵</th></tr></thead><tbody><tr><td>Mesh 網狀</td><td>每兩台之間有專屬線路，四台需要六條線。</td></tr><tr><td>Star 星狀</td><td>所有節點接到中央集線器。</td></tr></tbody></table><p>圖表與文字一起保留。</p>",
    },
    {
      id: "two",
      source: "exam",
      kind: "past",
      section: "封包傳遞",
      title: "Sender 的 frame 為何需要 T2？",
      tags: ["封包", "拓樸"],
      pages: [1],
      summary: "T2 是錯誤檢查碼。",
      keywords: ["CRC", "trailer"],
      context: "請依原題圖回答，保留題幹。",
      answerHtml:
        "<p>接收端會重算 <strong>CRC</strong> 並比對 T2。</p><ul><li>不一致就丟棄。</li><li>錯誤時要求重送。</li></ul>",
      imageKey: "diagram",
    },
    {
      id: "three",
      source: "exam",
      kind: "practice",
      section: "無線存取",
      title: "CSMA/CA 如何避免碰撞？",
      tags: ["無線"],
      pages: [1],
      summary: "先監聽，再依規則等待。",
      keywords: ["collision avoidance"],
      context: "",
      answerHtml:
        "<p>先監聽通道，並採用隨機退避。</p><p>這張用來搜尋縮寫與相關名詞。</p>",
    },
  ];
  const encode = (data: unknown) =>
    JSON.stringify(data).replace(/</g, "\\u003c");
  const html = `<html><body><script>window.deckCodeRan = true;</script><script type="application/json" id="cards-data">${encode(cards)}</script><script type="application/json" id="sources-data">${encode({ review: ["原講義第一頁：拓樸與線路。"], exam: ["原考題第一頁：封包與存取。"] })}</script><script type="application/json" id="images-data">${encode({ diagram: image })}</script></body></html>`;
  return {
    name: "cards.html",
    mimeType: "text/html",
    buffer: Buffer.from(html),
  };
}
async function importSample(page: Page) {
  const file = await sampleDeck(page);
  await page.locator("#card-deck-file").setInputFiles(file);
  await expect(page.locator(".review-card h2")).toHaveText(
    "Mesh 與 Star 怎麼連？",
  );
  await expect
    .poll(async () => (await stored(page)).reviewCards?.length)
    .toBe(3);
  return file;
}
async function stored(page: Page) {
  return page.evaluate(async () => {
    const path = "/src/core/storage.ts";
    return await (await import(path)).loadLibrary();
  });
}

test("desktop cards align with the header and connect rich answers, sources, favorites and ZIP", async ({
  page,
}) => {
  await openCards(page);
  await expect(page.locator(".study-page")).not.toContainText(
    "搜尋重點，一次專心看一張",
  );
  const file = await importSample(page);
  const gutter = await page.locator(".brand").boundingBox(),
    search = await page.locator(".study-search").boundingBox();
  expect(Math.abs(gutter!.x - search!.x)).toBeLessThan(1);
  await expect(page.locator(".study-results")).toBeVisible();
  await expect(page.locator(".study-reader")).toBeVisible();
  expect(
    (await page.locator(".study-reader").boundingBox())!.x,
  ).toBeGreaterThan(
    (await page.locator(".study-results").boundingBox())!.x + 250,
  );
  await expect(page.locator(".study-quick-answer")).toContainText("兩兩連接");
  await expect(page.locator(".review-answer table")).toHaveCount(1);
  expect(
    await page.evaluate(() => (window as any).deckCodeRan),
  ).toBeUndefined();
  await page.getByRole("button", { name: "來源：考題", exact: true }).click();
  await expect(page.locator(".study-result-list strong")).toHaveCount(2);
  await page.getByRole("button", { name: "# 無線", exact: true }).click();
  await expect(page.locator(".study-result-list strong")).toHaveCount(1);
  await expect(page.locator(".review-card h2")).toContainText("CSMA/CA");
  await page.getByRole("button", { name: "重設", exact: true }).click();
  await page.getByRole("textbox", { name: "搜尋小卡" }).fill("ＣＳＭＡ ＣＡ");
  await expect(page.locator(".study-result-list strong")).toHaveCount(1);
  await page.getByRole("textbox", { name: "搜尋小卡" }).fill("avoidance");
  await expect(page.locator(".review-card h2")).toContainText("CSMA/CA");
  await page.getByRole("button", { name: "收藏這張小卡", exact: true }).click();
  await expect
    .poll(
      async () =>
        (await stored(page)).reviewCards?.filter((c: any) => c.favorite).length,
    )
    .toBe(1);
  await page.getByRole("button", { name: "查看小卡來源", exact: true }).click();
  const source = page.getByRole("dialog", { name: "原文對照", exact: true });
  await expect(source).toContainText("原考題第一頁");
  await source
    .getByRole("button", { name: "關閉原文對照", exact: true })
    .click();
  await page.getByRole("button", { name: /^調整閱讀字級/ }).click();
  await expect(page.locator(".review-answer")).toHaveCSS("font-size", "19px");
  await page.getByRole("button", { name: "只看收藏小卡", exact: true }).click();
  await expect(page.locator(".study-result-list strong")).toHaveCount(1);
  const restored = await page.evaluate(async () => {
    const storage = "/src/core/storage.ts",
      backup = "/src/core/backupBundle.ts";
    const s = await (await import(storage)).loadLibrary();
    const { createBundle, readBundle } = await import(backup);
    const result = await readBundle(
      new File([await createBundle(s.books, s.reviewCards)], "rich.zip"),
    );
    return result.reviewCards;
  });
  expect(restored).toHaveLength(3);
  expect(restored.filter((c: any) => c.favorite)).toHaveLength(1);
  expect(
    restored.find((c: any) => c.title.startsWith("Sender"))?.image,
  ).toBeTruthy();
  expect(restored[0]?.answerHtml).toContain("<table>");
  expect(restored[0]?.sourcePages?.[0].text).toContain("原講義第一頁");
  await page.locator("#card-deck-file").setInputFiles(file);
  await expect
    .poll(async () => (await stored(page)).reviewCards?.length)
    .toBe(3);
  await page.reload();
  await page.getByRole("button", { name: /^考前小卡/ }).click();
  await expect(page.locator(".review-answer")).toHaveCSS("font-size", "19px");
  await expect(
    page.getByRole("button", { name: "取消收藏這張小卡", exact: true }),
  ).toBeVisible();
});

test("mobile uses a menu and list-to-card navigation, supports source, image and tag panels without overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openCards(page);
  await importSample(page);
  await expect(page.locator(".study-tools")).not.toBeVisible();
  await expect(page.locator(".study-results")).not.toBeVisible();
  await expect(page.locator(".review-card")).toBeVisible();
  await expect(page.getByRole("textbox", { name: "搜尋小卡" })).toHaveCSS(
    "font-size",
    "16px",
  );
  await page.getByRole("button", { name: "小卡操作選單", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "新增小卡", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: /^調整閱讀字級/ }).click();
  await page.keyboard.press("Escape");
  await page.getByRole("textbox", { name: "搜尋小卡" }).fill("frame");
  await expect(page.locator(".study-results")).toBeVisible();
  await expect(page.locator(".study-reader")).not.toBeVisible();
  await page.evaluate(() =>
    document.documentElement.style.setProperty("--visual-height", "420px"),
  );
  expect(
    (await page.locator(".study-mode").boundingBox())!.height,
  ).toBeLessThanOrEqual(420);
  expect(
    (await page.locator(".study-result-list").boundingBox())!.height,
  ).toBeGreaterThan(80);
  await page.evaluate(() =>
    document.documentElement.style.removeProperty("--visual-height"),
  );
  await page
    .locator(".study-result-list > button")
    .filter({ hasText: "Sender" })
    .click();
  await expect(page.locator(".review-card h2")).toContainText("Sender");
  await expect(
    page.getByRole("textbox", { name: "搜尋小卡" }),
  ).not.toBeFocused();
  await page.getByRole("button", { name: "放大小卡題圖", exact: true }).click();
  const image = page.getByRole("dialog", { name: "原題圖", exact: true });
  await expect(image.locator("img")).toBeVisible();
  await image.getByRole("combobox", { name: "題圖縮放" }).click();
  await page.getByRole("option", { name: "150%", exact: true }).click();
  await image.getByRole("button", { name: "關閉原題圖", exact: true }).click();
  await page.getByRole("button", { name: "全部小卡標籤", exact: true }).click();
  const tags = page.getByRole("dialog", { name: "全部小卡標籤", exact: true });
  await tags.getByRole("button", { name: "封包傳遞", exact: true }).click();
  await expect(tags).toHaveCount(0);
  await expect(page.locator(".study-result-list strong")).toHaveCount(1);
  await page.locator(".study-result-list > button").first().click();
  for (const width of [320, 390, 820, 900, 901, 1440, 2560]) {
    await page.setViewportSize({ width, height: 844 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
    await expect(page.locator(".study-navigation")).toBeInViewport();
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "清除小卡搜尋", exact: true }).click();
  await page.getByRole("button", { name: "重設", exact: true }).click();
  await page.locator(".study-result-list > button").first().click();
  const table = page.locator(".card-table-scroll");
  expect(await table.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(
    true,
  );
  const swipe = async (selector: string) =>
    page.locator(selector).evaluate((el) => {
      const start = new Event("touchstart", { bubbles: true }),
        end = new Event("touchend", { bubbles: true });
      Object.defineProperty(start, "touches", {
        value: [{ clientX: 300, clientY: 300 }],
      });
      Object.defineProperty(end, "changedTouches", {
        value: [{ clientX: 60, clientY: 302 }],
      });
      el.dispatchEvent(start);
      el.dispatchEvent(end);
    });
  const first = await page.locator(".review-card").getAttribute("data-card-id");
  await swipe(".card-table-scroll");
  await expect(page.locator(".review-card")).toHaveAttribute(
    "data-card-id",
    first!,
  );
  await swipe(".review-card");
  await expect(page.locator(".review-card")).not.toHaveAttribute(
    "data-card-id",
    first!,
  );
  await expect(page.locator("select")).toHaveCount(0);
});

test("invalid decks preserve existing cards and imported answer markup cannot execute scripts", async ({
  page,
}) => {
  await openCards(page);
  await importSample(page);
  await page.locator("#card-deck-file").setInputFiles({
    name: "wrong.html",
    mimeType: "text/html",
    buffer: Buffer.from("<p>not a card deck</p>"),
  });
  const error = page.getByRole("dialog", { name: "無法匯入小卡", exact: true });
  await expect(error).toContainText("沒有可讀取的小卡資料");
  expect((await stored(page)).reviewCards).toHaveLength(3);
  await error
    .getByRole("button", { name: "關閉無法匯入小卡", exact: true })
    .click();
  const malicious = {
    cards: [
      {
        id: "safe",
        title: "安全呈現",
        source: "自建",
        tags: [],
        answerHtml:
          '<p onclick="window.cardRan=1">保留內容</p><script>window.cardRan=1</script><img src="x" onerror="window.cardRan=1">',
      },
    ],
  };
  await page.locator("#card-deck-file").setInputFiles({
    name: "markup.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(malicious)),
  });
  await expect(page.locator(".review-card h2")).toHaveText("安全呈現");
  await expect(page.locator(".review-answer")).toHaveText("保留內容");
  await expect(
    page.locator(
      ".review-answer script,.review-answer img,.review-answer [onclick]",
    ),
  ).toHaveCount(0);
  expect(await page.evaluate(() => (window as any).cardRan)).toBeUndefined();
});
