import { Extension, Node, mergeAttributes } from "@tiptap/core";
import { VueNodeViewRenderer } from "@tiptap/vue-3";
import { Plugin } from "@tiptap/pm/state";
import FigureNodeView from "../components/FigureNodeView.vue";
export const StableIds = Extension.create({
  name: "stableIds",
  addGlobalAttributes() {
    return [
      {
        types: ["paragraph", "heading", "listItem", "tableRow", "figureNote"],
        attributes: {
          blockId: {
            default: null,
            parseHTML: (el) => el.getAttribute("data-block-id"),
            renderHTML: (attrs) =>
              attrs.blockId ? { "data-block-id": attrs.blockId } : {},
          },
        },
      },
    ];
  },
  addProseMirrorPlugins() {
    return [
      new Plugin({
        appendTransaction: (_transactions, _old, state) => {
          const tr = state.tr;
          const used = new Set<string>();
          state.doc.descendants((node, pos) => {
            if (
              ![
                "paragraph",
                "heading",
                "listItem",
                "tableRow",
                "figureNote",
              ].includes(node.type.name)
            )
              return;
            if (!node.attrs.blockId || used.has(node.attrs.blockId)) {
              const id = crypto.randomUUID();
              tr.setNodeMarkup(pos, undefined, { ...node.attrs, blockId: id });
              used.add(id);
            } else used.add(node.attrs.blockId);
          });
          return tr.docChanged ? tr : null;
        },
      }),
    ];
  },
});
export const FigureNote = Node.create({
  name: "figureNote",
  group: "block",
  content: "block+",
  defining: true,
  isolating: true,
  addAttributes() {
    return {
      mediaId: { default: "", parseHTML: (el) => el.dataset.mediaId },
      width: { default: 1, parseHTML: (el) => Number(el.dataset.width) },
      height: { default: 1, parseHTML: (el) => Number(el.dataset.height) },
      alt: {
        default: "筆記圖片",
        parseHTML: (el) => el.dataset.alt || "筆記圖片",
      },
      layout: {
        default: "side",
        parseHTML: (el) => el.dataset.layout || "side",
      },
      caption: {
        default: "",
        parseHTML: (el) => el.querySelector("figcaption")?.textContent || "",
      },
    };
  },
  parseHTML() {
    return [
      { tag: "figure[data-media-id]", contentElement: "[data-figure-body]" },
    ];
  },
  renderHTML({ node, HTMLAttributes }) {
    const a = node.attrs;
    return [
      "figure",
      mergeAttributes({
        "data-block-id": a.blockId,
        "data-media-id": a.mediaId,
        "data-width": a.width,
        "data-height": a.height,
        "data-alt": a.alt,
        "data-layout": a.layout,
      }),
      ["figcaption", {}, a.caption],
      ["div", { "data-figure-body": "true" }, 0],
    ];
  },
  addNodeView() {
    return VueNodeViewRenderer(FigureNodeView);
  },
});
