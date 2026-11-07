import type { LibraryState, ReviewCard, ReviewDeck } from "./model";
export const MAX_REVIEW_DECKS = 200;
export function newReviewDeck(title: string): ReviewDeck {
  return {
    id: crypto.randomUUID(),
    title: title.trim().slice(0, 120),
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}
/** One conservative home for all legacy cards; sources and subject tags stay intact. */
export function withReviewDecks(state: LibraryState): LibraryState {
  const cards = state.reviewCards || [],
    decks = state.reviewDecks || [];
  const ids = new Set(decks.map((d) => d.id));
  if (!cards.some((c) => !c.deckId || !ids.has(c.deckId))) return state;
  const legacy = newReviewDeck("我的小卡");
  return {
    ...state,
    reviewDecks: [...decks, legacy],
    reviewCards: cards.map((c) =>
      c.deckId && ids.has(c.deckId) ? c : { ...c, deckId: legacy.id },
    ),
  };
}
/** Validate every deck/reference before returning a fresh, independently restorable collection. */
export function restoreReviewDecks(
  value: unknown,
  cards: ReviewCard[],
): { reviewDecks: ReviewDeck[]; reviewCards: ReviewCard[] } {
  if (value === undefined) {
    const state = withReviewDecks({
      books: [],
      reviewCards: cards.map((c) => ({ ...c, deckId: undefined })),
    });
    return {
      reviewDecks: state.reviewDecks || [],
      reviewCards: state.reviewCards || [],
    };
  }
  if (!Array.isArray(value) || value.length > MAX_REVIEW_DECKS)
    throw new Error("備份卡組數量或格式不正確。");
  const ids = new Map<string, string>();
  const decks = value.map((d) => {
    if (
      !d ||
      typeof d.id !== "string" ||
      !/^[A-Za-z0-9_-]{1,180}$/.test(d.id) ||
      ids.has(d.id) ||
      typeof d.title !== "string" ||
      !d.title.trim() ||
      d.title.length > 120 ||
      !Number.isFinite(d.createdAt) ||
      !Number.isFinite(d.updatedAt)
    )
      throw new Error("備份卡組資料不完整，尚未加入任何內容。");
    const id = crypto.randomUUID();
    ids.set(d.id, id);
    return {
      id,
      title: d.title.trim(),
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
    };
  });
  if (cards.some((c) => !c.deckId || !ids.has(c.deckId)))
    throw new Error("備份小卡的卡組參照不正確，尚未加入任何內容。");
  return {
    reviewDecks: decks,
    reviewCards: cards.map((c) => ({ ...c, deckId: ids.get(c.deckId!) })),
  };
}
