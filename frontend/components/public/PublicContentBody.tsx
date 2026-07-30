import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

type PublicContentBodyProps = {
  content: string;
};

const normalizeContent = (content: string) => {
  return content
    .replace(/\\r\\n/g, "\n")
    .replace(/\\n/g, "\n")
    .replace(/\r\n/g, "\n");
};

const safeUrlTransform = (url: string) => {
  const trimmedUrl = url.trim();

  if (
    trimmedUrl.startsWith("/") ||
    trimmedUrl.startsWith("#")
  ) {
    return trimmedUrl;
  }

  try {
    const parsedUrl = new URL(trimmedUrl);

    if (
      parsedUrl.protocol === "http:" ||
      parsedUrl.protocol === "https:"
    ) {
      return trimmedUrl;
    }
  } catch {
    return "";
  }

  return "";
};

const markdownComponents: Components = {
  h1: ({ children }) => (
    <h2 className="mt-10 rounded-r-2xl border-l-4 border-blue-600 bg-blue-50 px-5 py-4 text-2xl font-black tracking-tight text-slate-950">
      {children}
    </h2>
  ),

  h2: ({ children }) => (
    <h2 className="mt-10 rounded-r-2xl border-l-4 border-blue-600 bg-blue-50 px-5 py-4 text-2xl font-black tracking-tight text-slate-950">
      {children}
    </h2>
  ),

  h3: ({ children }) => (
    <h3 className="mt-8 text-xl font-black tracking-tight text-slate-950">
      {children}
    </h3>
  ),

  h4: ({ children }) => (
    <h4 className="mt-7 text-lg font-black text-slate-900">
      {children}
    </h4>
  ),

  p: ({ children }) => (
    <p className="my-5 text-base leading-8 text-slate-700">
      {children}
    </p>
  ),

  strong: ({ children }) => (
    <strong className="font-black text-slate-950">
      {children}
    </strong>
  ),

  em: ({ children }) => (
    <em className="italic text-slate-800">
      {children}
    </em>
  ),

  ul: ({ children }) => (
    <ul className="my-5 list-disc space-y-2 pl-7 text-base leading-8 text-slate-700 marker:text-blue-600">
      {children}
    </ul>
  ),

  ol: ({ children }) => (
    <ol className="my-5 list-decimal space-y-2 pl-7 text-base leading-8 text-slate-700 marker:font-black marker:text-blue-700">
      {children}
    </ol>
  ),

  li: ({ children }) => (
    <li className="pl-1">
      {children}
    </li>
  ),

  blockquote: ({ children }) => (
    <blockquote className="my-7 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-slate-800">
      {children}
    </blockquote>
  ),

  a: ({ href = "", children, title }) => {
    const isExternal = /^https?:\/\//i.test(href);

    return (
      <a
        href={href}
        title={title}
        target={isExternal ? "_blank" : undefined}
        rel={isExternal ? "noopener noreferrer" : undefined}
        className="font-bold text-blue-700 underline decoration-blue-300 decoration-2 underline-offset-4 hover:text-blue-900"
      >
        {children}
        {isExternal ? (
          <span aria-hidden="true" className="ml-1 text-xs">
            ↗
          </span>
        ) : null}
      </a>
    );
  },

  table: ({ children }) => (
    <div className="my-7 overflow-x-auto rounded-2xl border border-slate-200">
      <table className="min-w-full border-collapse text-left text-sm">
        {children}
      </table>
    </div>
  ),

  thead: ({ children }) => (
    <thead className="bg-blue-700 text-white">
      {children}
    </thead>
  ),

  tbody: ({ children }) => (
    <tbody className="divide-y divide-slate-200 bg-white">
      {children}
    </tbody>
  ),

  tr: ({ children }) => (
    <tr className="align-top">
      {children}
    </tr>
  ),

  th: ({ children }) => (
    <th className="px-4 py-3 font-black">
      {children}
    </th>
  ),

  td: ({ children }) => (
    <td className="px-4 py-3 leading-6 text-slate-700">
      {children}
    </td>
  ),

  hr: () => (
    <hr className="my-9 border-0 border-t border-slate-200" />
  ),

  code: ({ children }) => (
    <code className="rounded bg-slate-100 px-1.5 py-1 font-mono text-sm text-slate-900">
      {children}
    </code>
  ),

  pre: ({ children }) => (
    <pre className="my-7 overflow-x-auto rounded-2xl bg-slate-950 p-5 text-sm leading-7 text-slate-100">
      {children}
    </pre>
  ),
};

export default function PublicContentBody({
  content,
}: PublicContentBodyProps) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={markdownComponents}
      skipHtml
      disallowedElements={["img"]}
      urlTransform={safeUrlTransform}
    >
      {normalizeContent(content)}
    </ReactMarkdown>
  );
}
