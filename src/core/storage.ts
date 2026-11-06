import type { BookRecord, LibraryState, SavedState } from "./model";
import { createRecord } from "./library";
import { database } from "./database";
import { mediaIds, pendingMedia } from "./media";
import { withoutBundledDemo } from "./startup";

async function retireDemo(state: LibraryState): Promise<LibraryState> {
  const cleaned = await withoutBundledDemo(state);
  if (!cleaned.removedIds.length) return state;
  try {
    await saveLibrary(cleaned.state, undefined, cleaned.removedIds);
  } catch {
    return {
      ...cleaned.state,
      storageWarning:
        "示範已從畫面移除，但瀏覽器無法保存這次清理；重新整理時會再嘗試。",
    };
  }
  return cleaned.state;
}
export async function loadLibrary(): Promise<LibraryState> {
  const db = await database();
  try {
    const state = await new Promise<LibraryState | undefined>(
      (resolve, reject) => {
        const store = db.transaction("notebook").objectStore("notebook");
        const req = store.get("library-index");
        req.onerror = () => reject(req.error);
        req.onsuccess = () => {
          const index = req.result as
            | { ids: string[]; activeId?: string }
            | undefined;
          if (!index) {
            resolve(undefined);
            return;
          }
          const books: BookRecord[] = [];
          if (!index.ids.length) {
            resolve({ books, activeId: index.activeId });
            return;
          }
          let remaining = index.ids.length;
          for (const id of index.ids) {
            const request = store.get(`book:${id}`);
            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
              if (request.result) books.push(request.result);
              if (--remaining === 0)
                resolve({ books, activeId: index.activeId });
            };
          }
        };
      },
    );
    if (state) return await retireDemo(state);
    const legacy = await new Promise<SavedState | undefined>(
      (resolve, reject) => {
        const req = db
          .transaction("notebook")
          .objectStore("notebook")
          .get("last");
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      },
    );
    if (!legacy?.document?.blocks?.length) return { books: [] };
    const book = createRecord(legacy.document, legacy.anchor);
    const migrated = { books: [book], activeId: book.document.id };
    const cleaned = await withoutBundledDemo(migrated);
    try {
      await saveLibrary(cleaned.state, undefined, cleaned.removedIds);
    } catch {
      if (cleaned.removedIds.length)
        return {
          ...cleaned.state,
          storageWarning:
            "示範已從畫面移除，但瀏覽器無法保存這次清理；重新整理時會再嘗試。",
        };
      /* 仍先提供舊筆記；閱讀端會顯示儲存失敗。 */
    }
    return cleaned.state;
  } finally {
    db.close();
  }
}
export async function saveLibrary(
  state: LibraryState,
  changedIds?: string[],
  removedIds: string[] = [],
): Promise<void> {
  const db = await database();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("notebook", "readwrite");
      const store = tx.objectStore("notebook");
      const writtenMedia: string[] = [];
      try {
        removedIds.forEach((id) => store.delete(`book:${id}`));
        const ids = new Set(state.books.flatMap((b) => mediaIds(b.document)));
        // Atomic with the snapshot; copies and trash retain their shared assets.
        const cursor = store.openCursor(
          IDBKeyRange.bound("media:", "media:\uffff"),
        );
        cursor.onsuccess = () => {
          const item = cursor.result;
          if (!item) return;
          if (!ids.has(String(item.key).slice(6))) item.delete();
          item.continue();
        };
        for (const [id, asset] of pendingMedia)
          if (ids.has(id)) {
            store.put(asset, `media:${id}`);
            writtenMedia.push(id);
          }
        for (const book of state.books)
          if (!changedIds || changedIds.includes(book.document.id))
            store.put(structuredClone(book), `book:${book.document.id}`);
        store.put(
          {
            version: 1,
            ids: state.books.map((b) => b.document.id),
            activeId: state.activeId,
          },
          "library-index",
        );
        const active = state.books.find(
          (b) => b.document.id === state.activeId && !b.deletedAt,
        );
        store.put(
          active
            ? structuredClone({
                document: active.document,
                anchor: active.anchor,
              })
            : undefined,
          "last",
        );
      } catch (e) {
        tx.abort();
        reject(e);
      }
      tx.oncomplete = () => {
        writtenMedia.forEach((id) => pendingMedia.delete(id));
        resolve();
      };
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}
export async function loadNotebook(): Promise<SavedState | undefined> {
  const lib = await loadLibrary();
  return lib.books.find((b) => b.document.id === lib.activeId && !b.deletedAt);
}
export async function saveNotebook(state: SavedState): Promise<void> {
  const lib = await loadLibrary();
  const existing = lib.books.find((b) => b.document.id === state.document.id);
  const record = {
    ...(existing || createRecord(state.document, state.anchor)),
    ...state,
  };
  lib.books = [
    ...lib.books.filter((b) => b.document.id !== state.document.id),
    record,
  ];
  lib.activeId = state.document.id;
  await saveLibrary(lib, [record.document.id]);
}
