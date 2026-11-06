import type { BookRecord, LibraryState, SavedState } from "./model";
import { createRecord } from "./library";
async function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("paper-between", 1);
    request.onupgradeneeded = () =>
      request.result.createObjectStore("notebook");
    request.onsuccess = () => {
      request.result.onversionchange = () => request.result.close();
      resolve(request.result);
    };
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error("本機儲存被其他分頁占用"));
  });
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
    if (state) return state;
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
    try {
      await saveLibrary(migrated);
    } catch {
      /* 仍先提供舊筆記；閱讀端會顯示儲存失敗。 */
    }
    return migrated;
  } finally {
    db.close();
  }
}
export async function saveLibrary(
  state: LibraryState,
  changedIds?: string[],
): Promise<void> {
  const db = await database();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("notebook", "readwrite");
      const store = tx.objectStore("notebook");
      try {
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
      tx.oncomplete = () => resolve();
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
