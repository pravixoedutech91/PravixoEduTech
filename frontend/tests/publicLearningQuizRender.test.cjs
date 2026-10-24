/* eslint-disable @typescript-eslint/no-require-imports -- Node CJS test harness loads the actual TSX renderer. */
const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync, existsSync } = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");

// Transpile the actual TSX renderer using the existing TypeScript dependency.
// Keep React external so hooks and the server renderer use the same instance.
const root = path.resolve(__dirname, "..");
const cache = new Map();
function load(file) {
  if (cache.has(file)) return cache.get(file).exports;
  const local = new Module(file, module);
  cache.set(file, local);
  local.filename = file;
  local.paths = Module._nodeModulePaths(path.dirname(file));
  const originalRequire = local.require.bind(local);
  local.require = (specifier) => {
    const base = specifier.startsWith("@/") ? path.join(root, specifier.slice(2))
      : specifier.startsWith(".") ? path.resolve(path.dirname(file), specifier) : null;
    if (base) {
      const target = [base, `${base}.ts`, `${base}.tsx`].find((entry) => existsSync(entry));
      if (target) return load(target);
    }
    return originalRequire(specifier);
  };
  const compiled = ts.transpileModule(readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    fileName: file,
  });
  local._compile(compiled.outputText, file);
  return local.exports;
}

const PublicContentBody = load(path.join(root, "components/public/PublicContentBody.tsx")).default;
const fixture = require("./fixtures/publicLearningQuiz.json");
const fence = (value) => "```pravixo-quiz\n" + JSON.stringify(value, null, 2) + "\n```";
const render = (content, language = "en-IN") => renderToStaticMarkup(React.createElement(PublicContentBody, { content, language }));

test("actual Markdown renderer emits a semantic quiz with a no-JavaScript self-check", () => {
  const html = render("## Company rule\n\n## Crown rule\n\n## Quiz\n\n" + fence(fixture));
  assert.match(html, /<section lang="en-IN" aria-labelledby=/);
  assert.match(html, /<fieldset/);
  assert.match(html, /type="radio"/);
  assert.match(html, /disabled=""[^>]*>Check answer/);
  assert.match(html, /<progress/);
  assert.match(html, /<noscript>/);
  assert.match(html, /Show answer and explanation/);
  assert.doesNotMatch(html, /language-pravixo-quiz|&quot;answerIndex&quot;/);
  assert.match(html, /href="#section-company-rule"/);
  assert.match(html, /<nav aria-label="Table of contents"/);
  assert.match(html, />View<\/span>/);
  assert.match(html, />Hide<\/span>/);
});

test("Hindi quiz controls use the payload language in both the article and CMS preview", () => {
  const hindi = { ...fixture, language: "hi-IN", title: "अधिनियम: पुनरावृत्ति" };
  for (const articleLanguage of ["en-IN", "hi-IN"]) {
    const html = render("## पहला भाग\n\n## दूसरा भाग\n\n## तीसरा भाग\n\n" + fence(hindi), articleLanguage);
    assert.match(html, /<section lang="hi-IN"/);
    assert.match(html, /उत्तर जाँचें/);
    assert.match(html, /उत्तर और व्याख्या देखें/);
    assert.doesNotMatch(html, />Check answer</);
    assert.match(html, articleLanguage === "hi-IN" ? /<nav aria-label="विषयसूची"/ : /<nav aria-label="Table of contents"/);
    if (articleLanguage === "hi-IN") {
      assert.match(html, />देखें<\/span>/);
      assert.match(html, />छिपाएँ<\/span>/);
    }
  }
});

test("malformed quiz blocks have a readable fallback without exposing raw JSON", () => {
  for (const language of ["en-IN", "hi-IN"]) {
    const html = render("Before\n\n```pravixo-quiz\n{broken secret field}\n```\n\nAfter", language);
    assert.match(html, /Before/);
    assert.match(html, /After/);
    assert.match(html, language === "hi-IN" ? /क्विज़ अभी उपलब्ध नहीं है/ : /This quiz is currently unavailable/);
    assert.doesNotMatch(html, /broken secret field|type="radio"/);
  }
});

test("ordinary code, text and unsafe HTML keep the existing renderer safety", () => {
  const data = { ...fixture, title: '<script>alert("bad")</script>' };
  const html = render(fence(data) + '\n\n```js\nconst answer = 42;\n```\n\n<script>alert("bad")</script>\n\n[Unsafe](javascript:alert)');
  assert.match(html, /&lt;script&gt;/);
  assert.doesNotMatch(html, /<script|href="javascript:/);
  assert.match(html, /<pre/);
  assert.match(html, /const answer = 42;/);
});
