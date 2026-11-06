export interface Block {
  id: string;
  kind: "heading" | "paragraph" | "list" | "row";
  html: string;
  text: string;
  level?: number;
  tableId?: string;
  header?: string;
  headerOnly?: boolean;
}
export interface Notebook {
  id: string;
  title: string;
  blocks: Block[];
  warnings: string[];
}
export interface Anchor {
  blockId: string;
  offset: number;
}
export interface Fragment {
  blockId: string;
  start: number;
  end: number;
  html: string;
  repeatedHeader: boolean;
}
export interface PaperPage {
  index: number;
  fragments: Fragment[];
}
export interface PageSize {
  width: number;
  height: number;
  mobile: boolean;
}
export interface SearchHit extends Anchor {
  end: number;
  excerpt: string;
  page: number;
}
export interface SavedState {
  document: Notebook;
  anchor: Anchor;
}
export interface BookRecord extends SavedState {
  createdAt: number;
  updatedAt: number;
  deletedAt?: number;
  progress: number;
}
export interface LibraryState {
  books: BookRecord[];
  activeId?: string;
}
