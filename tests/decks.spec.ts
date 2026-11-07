import { test, expect, type Page } from "@playwright/test";
import { zipSync, strToU8 } from "fflate";
async function home(page: Page) {
  await page.goto("/");
  await expect(page.locator("main.bookshelf-page")).toBeVisible();
  await page.getByRole("button", { name: /^考前小卡/ }).click();
  await expect(page.getByRole("main", { name: "小卡組管理" })).toBeVisible();
}
async function create(page: Page, name: string) {
  await page
    .getByRole("button", { name: "新增卡組", exact: true })
    .first()
    .click();
  await page.getByRole("textbox", { name: "卡組名稱", exact: true }).fill(name);
  await page.getByRole("button", { name: "建立卡組", exact: true }).click();
  await expect(page.locator(".study-deck-heading h1")).toHaveText(name);
}
async function action(page: Page, name: string) {
  const btn = page.getByRole("button", { name, exact: true });
  if (!(await btn.isVisible()))
    await page
      .getByRole("button", { name: "小卡操作選單", exact: true })
      .click();
  await btn.click();
}
async function add(page: Page, name: string, tag: string) {
  await action(page, "新增小卡");
  await page.getByRole("textbox", { name: "小卡標題", exact: true }).fill(name);
  await page.getByRole("textbox", { name: "小卡標籤", exact: true }).fill(tag);
  await page
    .getByRole("textbox", { name: "小卡內容", exact: true })
    .fill(name + "的完整內容");
  await page.getByRole("button", { name: "儲存小卡", exact: true }).click();
  await expect(page.locator(".review-card h2")).toHaveText(name);
}
async function stored(page: Page) {
  return await page.evaluate(
    async () =>
      await (await import(String("/src/core/storage.ts"))).loadLibrary(),
  );
}

test("deck home creates, renames, isolates topics, moves filtered cards and confirms deletion", async ({
  page,
}) => {
  await home(page);
  await expect(page.locator(".study-page")).toHaveCount(0);
  await create(page, "企業網路");
  await add(page, "網路卡", "共同標籤");
  await page.getByRole("button", { name: "收藏這張小卡", exact: true }).click();
  await page.getByRole("button", { name: "返回小卡組", exact: true }).click();
  await create(page, "資料庫");
  await add(page, "資料庫卡", "共同標籤");
  await page.getByRole("button", { name: "# 共同標籤", exact: true }).click();
  await expect(page.locator(".study-result-list strong")).toHaveCount(1);
  await expect(page.locator(".review-card")).not.toContainText("網路卡");
  await page.getByRole("button", { name: "返回小卡組", exact: true }).click();
  const tile = page.locator(".deck-tile").filter({
    has: page.getByRole("button", {
      name: "開啟卡組：企業網路",
      exact: true,
    }),
  });
  await tile.getByRole("button", { name: "重新命名卡組", exact: true }).click();
  await page
    .getByRole("textbox", { name: "卡組名稱", exact: true })
    .fill("企業網路期中");
  await page.getByRole("button", { name: "儲存名稱", exact: true }).click();
  await page
    .getByRole("searchbox", { name: "搜尋卡組", exact: true })
    .fill("期中");
  await expect(page.locator(".deck-tile")).toHaveCount(1);
  await page.getByRole("searchbox", { name: "搜尋卡組", exact: true }).clear();
  await page
    .getByRole("button", { name: "開啟卡組：企業網路期中", exact: true })
    .click();
  await action(page, "移動小卡至其他卡組");
  await expect(
    page.getByRole("dialog", { name: "移動小卡", exact: true }),
  ).toContainText("1 張");
  await page
    .getByRole("button", { name: "移動 1 張小卡", exact: true })
    .click();
  await expect(page.locator(".study-empty")).toBeVisible();
  await expect
    .poll(async () => {
      const s = await stored(page);
      return s.reviewCards?.every(
        (c: any) =>
          c.deckId === s.reviewDecks?.find((d: any) => d.title === "資料庫").id,
      );
    })
    .toBe(true);
  await page.getByRole("button", { name: "返回小卡組", exact: true }).click();
  await page
    .getByRole("button", { name: "開啟卡組：資料庫", exact: true })
    .click();
  await expect(page.locator(".study-result-list strong")).toHaveCount(2);
  await page.getByRole("button", { name: "# 共同標籤", exact: true }).click();
  await expect(page.locator(".study-result-list strong")).toHaveCount(2);
  await page.getByRole("button", { name: "返回小卡組", exact: true }).click();
  const full = page.locator(".deck-tile").filter({
    has: page.getByRole("button", { name: "開啟卡組：資料庫", exact: true }),
  });
  await full.getByRole("button", { name: "刪除卡組", exact: true }).click();
  await page.getByRole("button", { name: "取消", exact: true }).click();
  await expect(page.locator(".deck-tile")).toHaveCount(2);
  await full.getByRole("button", { name: "刪除卡組", exact: true }).click();
  await page
    .getByRole("button", { name: "刪除卡組與小卡", exact: true })
    .click();
  await expect(page.locator(".deck-tile")).toHaveCount(1);
  await expect
    .poll(async () => (await stored(page)).reviewCards?.length)
    .toBe(0);
  await page.reload();
  await page.getByRole("button", { name: /^考前小卡/ }).click();
  await expect(
    page.getByRole("button", { name: "開啟卡組：企業網路期中", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".study-page")).toHaveCount(0);
});

test("mobile deck navigation, empty groups and single-card membership persist without horizontal overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await home(page);
  await create(page, "第一組");
  await add(page, "第一張", "標籤不變");
  await page.getByRole("button", { name: "返回小卡組", exact: true }).click();
  await create(page, "第二組");
  await add(page, "第二張", "標籤不變");
  await action(page, "編輯小卡");
  await page
    .getByRole("combobox", { name: "小卡所屬卡組", exact: true })
    .click();
  await page.getByRole("option", { name: "第一組", exact: true }).click();
  await page.getByRole("button", { name: "儲存小卡", exact: true }).click();
  await expect(page.locator(".study-empty")).toBeVisible();
  await action(page, "新增小卡");
  await page
    .getByRole("textbox", { name: "小卡標題", exact: true })
    .fill("指定卡組的新卡");
  await page
    .getByRole("textbox", { name: "小卡標籤", exact: true })
    .fill("標籤不變");
  await page
    .getByRole("textbox", { name: "小卡內容", exact: true })
    .fill("直接新增至另一組。");
  await page
    .getByRole("combobox", { name: "小卡所屬卡組", exact: true })
    .click();
  await page.getByRole("option", { name: "第一組", exact: true }).click();
  await page.getByRole("button", { name: "儲存小卡", exact: true }).click();
  await expect(page.locator(".study-empty")).toBeVisible();
  await page.getByRole("button", { name: "返回小卡組", exact: true }).click();
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 844 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
    await expect(
      page.getByRole("button", { name: "開啟卡組：第二組", exact: true }),
    ).toBeVisible();
    const brand = await page.locator(".brand").boundingBox(),
      search = await page.locator(".deck-search").boundingBox();
    expect(Math.abs(brand!.x - search!.x)).toBeLessThan(1);
  }
  await expect
    .poll(async () => {
      const s = await stored(page);
      return s.reviewCards?.filter(
        (c: any) =>
          c.deckId === s.reviewDecks?.find((d: any) => d.title === "第一組").id,
      ).length;
    })
    .toBe(3);
  await page.getByRole("button", { name: "切換夜間模式", exact: true }).click();
  await expect(page.locator(".deck-open").first()).toHaveCSS(
    "color",
    "rgb(232, 224, 219)",
  );
  const result = await page.evaluate(async () => {
    const s = await (
      await import(String("/src/core/storage.ts"))
    ).loadLibrary();
    const { createBundle, readBundle } = await import(
      String("/src/core/backupBundle.ts")
    );
    const restored = await readBundle(
      new File(
        [await createBundle(s.books, s.reviewCards, s.reviewDecks)],
        "decks.zip",
      ),
    );
    return {
      decks: restored.reviewDecks,
      cards: restored.reviewCards,
      original: s.reviewDecks,
    };
  });
  expect(result.decks?.map((d: any) => d.title)).toEqual(["第一組", "第二組"]);
  expect(
    result.decks?.every(
      (d: any, i: number) => d.id !== result.original?.[i].id,
    ),
  ).toBe(true);
  expect(
    result.cards?.every(
      (c: any) => c.deckId === result.decks?.[0].id && c.tags[0] === "標籤不變",
    ),
  ).toBe(true);
});

test("legacy flat data migrates once without splitting tags, and ZIP validates all memberships including empty decks", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator("main.bookshelf-page")).toBeVisible();
  const result = await page.evaluate(async () => {
    const { database } = await import(String("/src/core/database.ts"));
    const db = await database();
    const cards = [
      {
        id: "legacy",
        title: "原小卡",
        body: "原內容",
        tags: ["甲", "乙"],
        favorite: true,
        sourceTitle: "來源",
        createdAt: 1,
        updatedAt: 1,
      },
    ];
    await new Promise<void>((resolve, reject) => {
      const t = db.transaction("notebook", "readwrite");
      t.objectStore("notebook").put(
        { version: 1, ids: [], reviewCards: cards },
        "library-index",
      );
      t.oncomplete = () => resolve();
      t.onerror = () => reject(t.error);
    });
    db.close();
    const { loadLibrary } = await import(String("/src/core/storage.ts"));
    const first = await loadLibrary(),
      second = await loadLibrary();
    const { createBundle, readBundle } = await import(
      String("/src/core/backupBundle.ts")
    );
    const empty = { id: "empty", title: "空卡組", createdAt: 1, updatedAt: 1 };
    const zip = await createBundle([], [], [empty]);
    const restored = await readBundle(new File([zip], "empty.zip"));
    return { first, second, empty: restored.reviewDecks };
  });
  expect(result.first.reviewDecks).toHaveLength(1);
  expect(result.first.reviewDecks?.[0].title).toBe("我的小卡");
  expect(result.first.reviewCards?.[0]).toMatchObject({
    id: "legacy",
    body: "原內容",
    tags: ["甲", "乙"],
    favorite: true,
  });
  expect(result.second.reviewCards?.[0].deckId).toBe(
    result.first.reviewCards?.[0].deckId,
  );
  expect(result.empty?.[0].title).toBe("空卡組");
  const invalid = Buffer.from(
    zipSync({
      "manifest.json": strToU8(
        JSON.stringify({
          format: "paper-between-bundle",
          version: 2,
          books: [],
          assets: [],
          reviewDecks: [
            { id: "valid", title: "合法卡組", createdAt: 1, updatedAt: 1 },
          ],
          reviewCards: [
            {
              id: "card",
              deckId: "missing",
              title: "錯誤參照",
              body: "內容",
              tags: [],
              sourceTitle: "來源",
              createdAt: 1,
              updatedAt: 1,
            },
          ],
        }),
      ),
    }),
  );
  const error = await page.evaluate(
    async (bytes) => {
      try {
        await (
          await import(String("/src/core/backupBundle.ts"))
        ).readBundle(new File([new Uint8Array(bytes)], "invalid.zip"));
        return "";
      } catch (e) {
        return (e as Error).message;
      }
    },
    [...invalid],
  );
  expect(error).toContain("卡組參照不正確");
  expect((await stored(page)).reviewCards?.[0].id).toBe("legacy");
});

test("imports target their selected deck and deduplicate within that deck while backups preserve empty deck names", async ({
  page,
}) => {
  await home(page);
  await create(page, "甲科目");
  const file = {
    name: "subject.json",
    mimeType: "application/json",
    buffer: Buffer.from(
      JSON.stringify({
        cards: [
          {
            id: "shared-question",
            title: "共同題目",
            tags: ["共同標籤"],
            source: "exam",
            answerHtml: "<p>相同原文可以在不同卡組複習。</p>",
          },
        ],
      }),
    ),
  };
  await page.locator("#card-deck-file").setInputFiles(file);
  await expect(page.locator(".review-card h2")).toHaveText("共同題目");
  await page.locator("#card-deck-file").setInputFiles(file);
  await expect
    .poll(async () => (await stored(page)).reviewCards?.length)
    .toBe(1);
  await page.getByRole("button", { name: "返回小卡組", exact: true }).click();
  await create(page, "乙科目");
  await page.locator("#card-deck-file").setInputFiles(file);
  await expect(page.locator(".review-card h2")).toHaveText("共同題目");
  await expect
    .poll(async () => (await stored(page)).reviewCards?.length)
    .toBe(2);
  const s = await stored(page);
  expect(new Set(s.reviewCards?.map((c: any) => c.deckId)).size).toBe(2);
  expect(new Set(s.reviewCards?.map((c: any) => c.sourceKey)).size).toBe(1);
  await page.getByRole("button", { name: "返回小卡組", exact: true }).click();
  await create(page, "空組");
  await expect
    .poll(async () => (await stored(page)).reviewDecks?.length)
    .toBe(3);
  await page.evaluate(() => {
    const read = File.prototype.text;
    File.prototype.text = async function () {
      if (this.name === "late.json")
        await new Promise<void>((resolve) => {
          (window as any).releaseDeckImport = resolve;
        });
      return read.call(this);
    };
  });
  await page
    .locator("#card-deck-file")
    .setInputFiles({ ...file, name: "late.json" });
  await page.waitForFunction(
    () => typeof (window as any).releaseDeckImport === "function",
  );
  await expect(
    page.getByRole("button", { name: "返回小卡組", exact: true }),
  ).toBeDisabled();
  await expect(page.getByRole("button", { name: /^考前小卡/ })).toBeDisabled();
  await page.evaluate(() => (window as any).releaseDeckImport());
  await expect
    .poll(async () => (await stored(page)).reviewCards?.length)
    .toBe(3);
  const after = await stored(page);
  expect(
    after.reviewCards?.filter(
      (c: any) =>
        c.deckId === after.reviewDecks?.find((d: any) => d.title === "空組").id,
    ),
  ).toHaveLength(1);
  await expect(page.locator(".study-result-list strong")).toHaveCount(1);
  await page.getByRole("button", { name: "返回小卡組", exact: true }).click();
  await create(page, "保留空組");
  await expect
    .poll(async () => (await stored(page)).reviewDecks?.length)
    .toBe(4);
  const restored = await page.evaluate(async () => {
    const state = await (
        await import(String("/src/core/storage.ts"))
      ).loadLibrary(),
      { createBundle, readBundle } = await import(
        String("/src/core/backupBundle.ts")
      );
    const r = await readBundle(
      new File(
        [await createBundle(state.books, state.reviewCards, state.reviewDecks)],
        "groups.zip",
      ),
    );
    return { cards: r.reviewCards, decks: r.reviewDecks };
  });
  expect(restored.decks?.map((d: any) => d.title)).toEqual([
    "甲科目",
    "乙科目",
    "空組",
    "保留空組",
  ]);
  expect(restored.cards?.map((c: any) => c.deckId)).toEqual(
    restored.decks?.slice(0, 3).map((d: any) => d.id),
  );
});
