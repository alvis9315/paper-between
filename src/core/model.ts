export interface Block {
  id: string;
  kind: "heading" | "paragraph" | "list" | "row" | "figure" | "pdfPage";
  html: string;
  text: string;
  level?: number;
  tableId?: string;
  header?: string;
  headerOnly?: boolean;
  image?: ImageReference;
  pdf?: PdfReference;
}
export interface Notebook {
  id: string;
  title: string;
  blocks: Block[];
  warnings: string[];
  pdfAssetId?: string;
  annotations?: Annotation[];
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
  pdf?: PdfReference;
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
export interface ImageReference {
  mediaId: string;
  width: number;
  height: number;
  alt: string;
  layout: "side" | "stacked";
}
export interface PdfReference {
  assetId: string;
  page: number;
  width: number;
  height: number;
}
export interface MediaAsset {
  id: string;
  blob: Blob;
  width: number;
  height: number;
  bytes: number;
  mime: string;
  name: string;
  kind: "image" | "pdf";
}
export interface AnnotationTarget {
  blockId: string;
  start: number;
  end: number;
  exact: string;
  prefix: string;
  suffix: string;
}
export interface Annotation {
  id: string;
  targets: AnnotationTarget[];
  category: "important" | "definition" | "question" | "todo";
  tags: string[];
  comment: string;
  createdAt: number;
  updatedAt: number;
  status: "linked" | "unlinked";
}
