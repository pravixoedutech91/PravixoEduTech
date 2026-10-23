type MarkdownNode = {
  type: string;
  depth?: number;
  value?: string;
  url?: string;
  children?: MarkdownNode[];
  data?: {
    hName?: string;
    hProperties?: Record<string, unknown>;
  };
};

type NavigationOptions = {
  label?: string;
};

const headingText = (node: MarkdownNode): string => {
  if (node.type === "html" || node.type === "image") return "";
  return node.value ?? node.children?.map(headingText).join("") ?? "";
};

// Parse through react-markdown's AST: code fences and table cells must never
// become false headings. Prefix IDs and de-duplicate across all heading levels.
export const remarkPublicContentNavigation = ({
  label = "On this page",
}: NavigationOptions = {}) => (tree: MarkdownNode) => {
  if (!tree.children) return;
  const usedIds = new Set<string>();

  const visit = (node: MarkdownNode) => {
    if (node.type === "heading") {
      const text = headingText(node).trim();
      const slug = text.normalize("NFKC").toLowerCase()
        .replace(/[^\p{L}\p{M}\p{N}]+/gu, "-")
        .replace(/^-|-$/g, "") || "heading";
      const base = `section-${slug}`;
      let id = base;
      let suffix = 2;
      while (usedIds.has(id)) id = `${base}-${suffix++}`;
      usedIds.add(id);
      node.data = { ...node.data, hProperties: { ...node.data?.hProperties, id } };
    }
    node.children?.forEach(visit);
  };
  tree.children.forEach(visit);

  const headings = tree.children.filter((node) =>
    node.type === "heading" && (node.depth === 1 || node.depth === 2) && headingText(node).trim()
  );
  if (headings.length < 3) return;

  const navigation: MarkdownNode = {
    type: "blockquote",
    data: { hName: "nav", hProperties: { "aria-label": label } },
    children: [{
      type: "list",
      children: headings.map((heading) => ({
        type: "listItem",
        children: [{
          type: "paragraph",
          children: [{
            type: "link",
            // Internal fragment URLs are kept as plain text, never raw HTML.
            url: `#${heading.data?.hProperties?.id}`,
            children: [{ type: "text", value: headingText(heading).trim() }],
          }],
        }],
      })),
    }],
  };
  tree.children.splice(tree.children.indexOf(headings[0]), 0, navigation);
};
