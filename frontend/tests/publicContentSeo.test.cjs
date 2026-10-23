const test = require("node:test");
const assert = require("node:assert/strict");
const {
  buildPublicContentMetadata,
  getPublicContentUrl,
  getPublicContentDescription,
  getAbsoluteFeaturedImageUrl,
} = require("../lib/publicContentSeo.ts");

const english = {
  _id: "en",
  type: "vacancy",
  slug: "rrb-ntpc-vacancy-2026-5165-posts-approved",
  status: "published",
  title: "RRB NTPC Recruitment 2026",
  seoTitle: "RRB NTPC 2026: 5,236 Posts & Last Dates | PravixoEduTech",
  seoDescription: "Verified vacancies, eligibility and application dates.",
  publishedAt: "2026-09-22T06:00:00.000Z",
  updatedAt: "2026-10-18T09:00:00.000Z",
};

const hindi = {
  ...english,
  _id: "hi",
  slug: `${english.slug}-hindi`,
  title: "RRB NTPC भर्ती 2026",
  seoTitle: "RRB NTPC भर्ती 2026: 5,236 पद | PravixoEduTech",
  seoDescription: "पदों, पात्रता और आवेदन की अंतिम तिथि की जानकारी।",
};

test("one brand suffix is rendered with or without a branded CMS title", () => {
  for (const seoTitle of ["RRB NTPC", "RRB NTPC | PravixoEduTech", "RRB NTPC | PravixoEduTech | PravixoEduTech"]) {
    assert.deepEqual(buildPublicContentMetadata({ ...english, seoTitle }).title, {
      absolute: "RRB NTPC | PravixoEduTech",
    });
  }
});

test("social previews identify the article and retain its own canonical URL", () => {
  const result = buildPublicContentMetadata(english);
  assert.equal(result.openGraph.title, english.seoTitle);
  assert.equal(result.openGraph.description, english.seoDescription);
  assert.equal(result.twitter.title, english.seoTitle);
  assert.equal(result.twitter.description, english.seoDescription);
  assert.equal(result.openGraph.url, getPublicContentUrl(english));
  assert.equal(result.alternates.canonical, getPublicContentUrl(english));
  assert.equal(result.openGraph.type, "article");
  assert.equal(result.openGraph.publishedTime, english.publishedAt);
  assert.equal(result.openGraph.modifiedTime, english.updatedAt);
  assert.equal(result.twitter.card, "summary");
  assert.equal(result.openGraph.images, undefined);
});

test("published translations have reciprocal alternatives and separate canonicals", () => {
  const en = buildPublicContentMetadata(english, hindi);
  const hi = buildPublicContentMetadata(hindi, english);
  const expected = {
    "en-IN": getPublicContentUrl(english),
    "hi-IN": getPublicContentUrl(hindi),
  };
  assert.deepEqual(en.alternates.languages, expected);
  assert.deepEqual(hi.alternates.languages, expected);
  assert.equal(hi.alternates.canonical, getPublicContentUrl(hindi));
  assert.equal(hi.openGraph.locale, "hi_IN");
  assert.deepEqual(hi.openGraph.alternateLocale, ["en_IN"]);
  assert.equal(en.openGraph.locale, "en_IN");
});

test("missing, draft, wrong-type and unrelated content are never advertised as translations", () => {
  for (const candidate of [null, { ...hindi, status: "draft" }, { ...hindi, type: "result" }, { ...hindi, slug: "other-hindi" }]) {
    const result = buildPublicContentMetadata(english, candidate);
    assert.equal(result.alternates.languages, undefined);
    assert.equal(result.openGraph.alternateLocale, undefined);
    assert.equal(result.alternates.canonical, getPublicContentUrl(english));
  }
});

test("only a supplied usable image is included in social previews", () => {
  const image = "https://pravixoedutech.in/images/rrb.png";
  const result = buildPublicContentMetadata({ ...english, featuredImage: image });
  assert.equal(result.twitter.card, "summary_large_image");
  assert.deepEqual(result.twitter.images, [image]);
  assert.equal(getAbsoluteFeaturedImageUrl("/images/rrb.png"), image);
  for (const value of ["", "javascript:alert(1)", "//other.test/image.png", "http://other.test/image.png"]) {
    assert.equal(getAbsoluteFeaturedImageUrl(value), undefined);
  }
});

test("empty fields use the matching language and invalid dates are omitted", () => {
  assert.match(getPublicContentDescription({ ...hindi, seoDescription: "", summary: "" }), /पढ़ें/);
  const result = buildPublicContentMetadata({ ...english, publishedAt: "invalid", createdAt: "invalid", updatedAt: "invalid" });
  assert.equal(result.openGraph.publishedTime, undefined);
  assert.equal(result.openGraph.modifiedTime, undefined);
});

test("all nine public detail types resolve to their existing routes", () => {
  const paths = { article: "articles", study_note: "study-notes", notification: "notifications", current_affairs: "current-affairs", vacancy: "vacancies", admit_card: "admit-cards", result: "results", syllabus: "syllabus", exam_page: "exams" };
  for (const [type, base] of Object.entries(paths)) {
    assert.equal(new URL(getPublicContentUrl({ ...english, type })).pathname, `/${base}/${english.slug}`);
  }
});
