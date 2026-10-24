import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { remarkPublicContentNavigation } from "../lib/publicContentMarkdown.ts";
import { formatPublicContentDate, getPublicContentCopy } from "../lib/publicContentPresentation.ts";

const render = (content, label = "Table of contents") => renderToStaticMarkup(
  React.createElement(ReactMarkdown, {
    remarkPlugins: [remarkGfm, [remarkPublicContentNavigation, { label }]],
    skipHtml: true,
    disallowedElements: ["img"],
  }, content)
);

const decodeHtml = (s) => s.replaceAll("&amp;", "&");

test("contents links resolve to unique real headings, including duplicates and collisions", () => {
  const html = render("## Reform\n\n### Reform\n\n## Reform\n\n## Reform-2\n\n## Reform");
  const ids = [...html.matchAll(/<h[1-6] id="([^"]+)"/g)].map(m => m[1]);
  const links = [...html.matchAll(/href="#([^"]+)"/g)].map(m => decodeHtml(m[1]));
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(links.length, 4);
  for (const id of links) assert.ok(ids.includes(id));
  assert.match(html, /<nav aria-label="Table of contents">/);
});

test("Hindi heading links preserve Devanagari vowel signs and use a Hindi navigation label", () => {
  const html = render("## भारत के वायसराय\n\n## परीक्षा के लिए अंतर\n\n## उत्तर और व्याख्या", "विषयसूची");
  assert.match(html, /aria-label="विषयसूची"/);
  assert.match(html, /id="section-भारत-के-वायसराय"/);
  const fragments = [...html.matchAll(/href="#([^"]+)"/g)].map(m => decodeURIComponent(m[1]));
  assert.ok(fragments.includes("section-भारत-के-वायसराय"));
});

test("fenced code and nested headings do not create misleading contents entries", () => {
  const html = render("```md\n## Fake heading\n```\n\n> ## Quoted heading\n\n## One\n\n## Two\n\n## Three");
  const nav = html.match(/<nav[\s\S]*?<\/nav>/)?.[0];
  assert.ok(nav);
  assert.doesNotMatch(nav, /Fake heading|Quoted heading/);
  assert.equal([...nav.matchAll(/href="#/g)].length, 3);
});

test("setext headings and formatted heading text produce readable navigation", () => {
  const html = render("**First** reform\n---\n\n## A [linked](https://example.com) heading\n\n## `Third` reform");
  assert.match(html, /id="section-first-reform"/);
  assert.match(html, />A linked heading<\/a>/);
  assert.match(html, />Third reform<\/a>/);
});

test("short notes remain compact and raw HTML stays disabled", () => {
  const html = render('<script>alert(1)</script>\n\n## One\n\n## Two\n\n[Bad](javascript:alert)');
  assert.doesNotMatch(html, /<nav|<script|href="javascript:/);
  assert.match(html, /id="section-one"/);
});

test("the local date respects India's date boundary and invalid values have a readable fallback", () => {
  assert.equal(formatPublicContentDate("2026-10-22T23:00:00Z", "en-IN"), "23 Oct 2026");
  assert.equal(formatPublicContentDate("invalid", "hi-IN"), "हाल में अपडेट किया गया");
  assert.match(formatPublicContentDate("2026-10-22T23:00:00Z", "hi-IN"), /23.*2026/);
});

test("every public content type has localised labels and study copy avoids recruitment instructions", () => {
  for (const language of ["en-IN", "hi-IN"]) {
    const copy = getPublicContentCopy(language);
    assert.equal(Object.keys(copy.types).length, 9);
    assert.equal(Object.keys(copy.lists).length, 9);
    assert.doesNotMatch(copy.studyBody, /eligibility|application dates|पात्रता|आवेदन/);
  }
  assert.equal(getPublicContentCopy("hi-IN").quickAnswer, "एक नज़र में");
});
