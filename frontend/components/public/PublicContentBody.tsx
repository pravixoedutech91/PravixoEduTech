import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { normalizePublicContent, remarkPublicContentNavigation } from "@/lib/publicContentMarkdown";
import type { PublicContentLanguage } from "@/lib/publicContentPresentation";
import PublicLearningQuiz from "@/components/public/PublicLearningQuiz";
import { parsePublicLearningQuiz, PUBLIC_QUIZ_FENCE } from "@/lib/publicLearningQuiz";

type PublicContentBodyProps = {
  content: string;
  language?: PublicContentLanguage;
};

const safeUrlTransform = (url: string) => {
  const trimmedUrl = url.trim();

  if (
    (trimmedUrl.startsWith("/") && !trimmedUrl.startsWith("//")) ||
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

const markdownComponents = (isHindi: boolean): Components => ({
  h1: ({ children, id }) => (
    <h2 id={id} className="mt-8 scroll-mt-52 rounded-r-2xl border-l-4 border-blue-600 bg-blue-50 px-4 py-3 text-[1.375rem] font-black leading-9 tracking-tight text-slate-950">
      {children}
    </h2>
  ),

  h2: ({ children, id }) => (
    <h2 id={id} className="mt-8 scroll-mt-52 rounded-r-2xl border-l-4 border-blue-600 bg-blue-50 px-4 py-3 text-[1.375rem] font-black leading-9 tracking-tight text-slate-950">
      {children}
    </h2>
  ),

  h3: ({ children, id }) => (
    <h3 id={id} className="mt-8 scroll-mt-52 text-xl font-black leading-8 tracking-tight text-slate-950">
      {children}
    </h3>
  ),

  h4: ({ children, id }) => (
    <h4 id={id} className="mt-7 scroll-mt-52 text-lg font-black leading-8 text-slate-900">
      {children}
    </h4>
  ),

  p: ({ children }) => (
    <p className={`my-5 text-slate-700 ${isHindi ? "text-lg leading-9" : "text-base leading-8"}`}>
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
    <ul className={`my-5 list-disc space-y-2 pl-7 text-slate-700 marker:text-blue-600 ${isHindi ? "text-lg leading-9" : "text-base leading-8"}`}>
      {children}
    </ul>
  ),

  ol: ({ children }) => (
    <ol className={`my-5 list-decimal space-y-2 pl-7 text-slate-700 marker:font-black marker:text-blue-700 ${isHindi ? "text-lg leading-9" : "text-base leading-8"}`}>
      {children}
    </ol>
  ),

  li: ({ children }) => (
    <li className="pl-1">
      {children}
    </li>
  ),

  blockquote: ({ children }) => (
    <blockquote className="my-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-slate-800 [&>p]:my-0 [&>p]:leading-8">
      {children}
    </blockquote>
  ),

  nav: ({ children, "aria-label": label }) => (
    <nav aria-label={label} className="my-7 rounded-2xl border border-blue-200 bg-blue-50/60 px-5 py-4 text-slate-800 [&_ul]:mb-0 [&_ul]:mt-3 [&_ul]:list-none [&_ul]:space-y-3 [&_ul]:pl-0 [&_li]:pl-0 [&_a]:text-base [&_a]:leading-7 [&_a]:no-underline [&_a:hover]:underline">
      <details className="group/contents">
        <summary className="cursor-pointer rounded font-bold leading-7 text-blue-900 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-600">
          {label}{" "}
          <span aria-hidden="true" className="mx-2">—</span>{" "}
          <span className="group-open/contents:hidden">{isHindi ? "देखें" : "View"}</span>
          <span className="hidden group-open/contents:inline">{isHindi ? "छिपाएँ" : "Hide"}</span>
        </summary>
        {children}
      </details>
    </nav>
  ),

  a: ({ href = "", children, title }) => {
    const isExternal = /^https?:\/\//i.test(href);
    const isButton = title === "button" && !isExternal;

    if (isButton) {
      return (
        <a
          href={href}
          className="inline-flex w-full items-center justify-between gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-black leading-6 text-blue-800 no-underline shadow-sm transition hover:border-blue-300 hover:bg-blue-100 hover:text-blue-950 focus:outline-none focus:ring-4 focus:ring-blue-100 sm:w-auto"
        >
          <span className="min-w-0">{children}</span>
          <span aria-hidden="true" className="shrink-0 text-base">
            &rarr;
          </span>
        </a>
      );
    }

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
            &#8599;
          </span>
        ) : null}
      </a>
    );
  },
  table: ({ children }) => (
    <div role="region" aria-label={isHindi ? "दाएँ-बाएँ खिसकाकर पढ़ने योग्य तालिका" : "Scrollable data table"} tabIndex={0} className="my-5 overflow-x-auto rounded-2xl border border-slate-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">
      <table className={`w-full min-w-full border-collapse text-left [&:has(th:nth-child(3))]:min-w-[36rem] ${isHindi ? "text-base" : "text-sm"}`}>
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
    <tbody className="divide-y divide-slate-200 bg-white [&>tr:nth-child(even)]:bg-slate-50/70">
      {children}
    </tbody>
  ),

  tr: ({ children }) => (
    <tr className="align-top">
      {children}
    </tr>
  ),

  th: ({ children }) => (
    <th scope="col" className="px-3 py-3 font-bold leading-7">
      {children}
    </th>
  ),

  td: ({ children }) => (
    <td className={`px-3 py-3 text-slate-700 ${isHindi ? "leading-8" : "leading-6"}`}>
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

  pre: ({ children, node }) => {
    const code = node?.children[0];
    if (code?.type === "element" && code.tagName === "code" &&
      Array.isArray(code.properties.className) &&
      code.properties.className.includes(`language-${PUBLIC_QUIZ_FENCE}`)) {
      const raw = code.children.map((child) => child.type === "text" ? child.value : "").join("");
      const result = parsePublicLearningQuiz(raw);
      if (result.ok) {
        // Key on the full payload so editing a question in CMS preview resets
        // its attempt. Two identical quizzes still have independent state.
        return <PublicLearningQuiz key={raw} quiz={result.quiz} />;
      }
      return <p role="status" className="my-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-base leading-8 text-slate-800">{isHindi ? "क्विज़ अभी उपलब्ध नहीं है। लेख के नोट्स से पुनरावृत्ति करें।" : "This quiz is currently unavailable. You can still revise using the article notes."}</p>;
    }
    return <pre className="my-7 overflow-x-auto rounded-2xl bg-slate-950 p-5 text-sm leading-7 text-slate-100">{children}</pre>;
  },
});

export default function PublicContentBody({
  content,
  language = "en-IN",
}: PublicContentBodyProps) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm, [remarkPublicContentNavigation, { label: language === "hi-IN" ? "विषयसूची" : "Table of contents" }]]}
      components={markdownComponents(language === "hi-IN")}
      skipHtml
      disallowedElements={["img"]}
      urlTransform={safeUrlTransform}
    >
      {normalizePublicContent(content)}
    </ReactMarkdown>
  );
}
