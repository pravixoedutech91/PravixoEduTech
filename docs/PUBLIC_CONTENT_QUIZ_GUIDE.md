# Public article revision quizzes

Status: frontend implementation prepared; publish quiz blocks only after this release is live.

## Student experience

An article can include a `pravixo-quiz` fenced Markdown block. The shared public renderer turns a valid block into a revision quiz in both the CMS preview and the public article:

1. Select an option using a tap, click or the native radio-button keyboard controls.
2. Choose **Check answer** / **उत्तर जाँचें**. The checked response is locked. The correct option and an original explanation appear, with a revision link when supplied.
3. Move to the next question and view the round score at the end.
4. Retry only the questions answered incorrectly in that round. The first-round score remains separate from retry scores.
5. Restart all questions for a fresh attempt.

Scoring is one point for a correct response with no penalty. There is no timer. Progress exists only in this page's component state; it is not saved or shared between the English and Hindi URLs. A refresh starts again. When JavaScript is disabled, all questions remain readable with native expandable answers and explanations.

This is free public revision material. Answers are delivered to the browser and are not secret. Do not use this format for protected mock tests, paid question banks, admission, rankings or official exam scoring.

## Copy into the CMS content body

Use ordinary Markdown for the article. Place one quiz block under a normal section heading near the end. Keep separate English and Hindi articles and keep their existing language-switch links.

The example below is **original practice**, not a PYQ. The answer index starts at zero: A = 0, B = 1, C = 2, D = 3, E = 4.

````markdown
## Revision quiz

```pravixo-quiz
{
  "version": 1,
  "language": "en-IN",
  "title": "British Acts: check the distinction",
  "questions": [
    {
      "id": "governor-general-bengal",
      "kind": "practice",
      "prompt": "Which Act created the office of Governor-General of Bengal?",
      "options": ["Charter Act 1813", "Government of India Act 1858", "Regulating Act 1773", "Indian Councils Act 1861"],
      "answerIndex": 2,
      "explanation": "The Regulating Act 1773 created this office. Distinguish it from the Governor-General of India under the Charter Act 1833."
    }
  ]
}
```
````

The Hindi block uses `"language": "hi-IN"` and Hindi title, questions, options and explanations. This also localises the quiz buttons, score and results, including in the CMS preview.

````markdown
## पुनरावृत्ति क्विज़

```pravixo-quiz
{
  "version": 1,
  "language": "hi-IN",
  "title": "अधिनियम: सही अंतर पहचानें",
  "questions": [
    {
      "id": "governor-general-bengal",
      "kind": "practice",
      "prompt": "बंगाल के गवर्नर-जनरल का पद किस अधिनियम ने बनाया?",
      "options": ["चार्टर अधिनियम 1813", "भारत शासन अधिनियम 1858", "रेगुलेटिंग एक्ट 1773", "भारतीय परिषद अधिनियम 1861"],
      "answerIndex": 2,
      "explanation": "रेगुलेटिंग एक्ट 1773 ने यह पद बनाया। इसे चार्टर अधिनियम 1833 के तहत बने भारत के गवर्नर-जनरल के पद से अलग याद रखें।"
    }
  ]
}
```
````

## Authoring contract

| Field | Requirement |
| --- | --- |
| `version` | Exactly `1` |
| `language` | `en-IN` or `hi-IN` |
| `title` | Nonempty plain text, at most 180 characters |
| `questions` | 1–20 questions; keep the article concise, usually 8–10 |
| Question `id` | Unique within that quiz; 1–80 ASCII letters, digits, underscores or hyphens |
| `kind` | `practice` for original questions; `pyq` for verified, adapted previous questions |
| `prompt` | Nonempty plain text, at most 2,000 characters |
| `options` | 2–5 distinct nonempty strings, at most 1,000 characters each |
| `answerIndex` | Integer identifying an existing option, counting from zero |
| `explanation` | Required original plain-text explanation, at most 4,000 characters |
| `source` | Optional for practice; required for PYQs. Object with `label` (at most 240 characters) and an absolute HTTPS `url` without credentials |
| `revisionHref` | Optional same-page heading fragment, such as `#section-company-rule`; check that it resolves in Preview |

Each block is limited to 100,000 characters. JSON requires double quotes and no trailing commas. A newline inside a string must be written as `\n`; normal line breaks between JSON fields are fine. HTML, Markdown formatting, images and scripts inside quiz fields render as plain text, not executable content.

A malformed block shows a short unavailable message, rather than exposing raw JSON or a partial quiz. Correct it in Preview before publication. Ordinary code fences and existing static answer-link quizzes continue to work.

## PYQ publication standard

Before assigning `kind: "pyq"`, inspect the actual paper and verify the answer. Include the exam, year, paper/shift when relevant, and a question number or other precise locator in `source.label`. Link the actual paper or its official archive in `source.url`. The renderer requires attribution but cannot verify that a question really appeared in the exam.

Adapt the wording without changing the tested concept, provide an original explanation, and label the adaptation transparently. The interface uses **PYQ · adapted** / **पिछला प्रश्न · रूपांतरित**. Never relabel an original question as a PYQ. The demo questions and automated-test fixtures are original practice, not a publish-ready PYQ set.

Keep answer positions varied without distorting the questions. Check that each Hindi question tests the same concept and has the same correct option as its English counterpart. Do not mix a second full-language translation into the same article.

## Next article: British Acts in India, 1773–1947

Use a short chronology, comparisons of commonly confused provisions, implementation-date traps, a quick-revision table, and sourced PYQs alongside clearly marked original practice. Link the existing Viceroys notes where they help explain implementation. Every question should explain the tested distinction; supply a valid `revisionHref` for concepts discussed in the article.

Background reference for the example: [NIOS History, Lesson 16](https://digital.nios.ac.in/content/315en/315_History_Eng_Lesson16.pdf). Use [UPSC's official paper archive](https://www.upsc.gov.in/examinations/previous-question-papers/archives) to establish PYQ provenance; a source link alone is not evidence that an invented question is a PYQ.

## Release and verification

No backend, database, protected mock-test code, authentication, payment code, dependencies, public routes or SEO metadata are changed. The CMS preview already uses `PublicContentBody`, so no separate editor implementation is needed. Existing public content uses the same renderer and keeps its usual formatting. The only Markdown normalisation change preserves JSON escapes in multiline Markdown while continuing to handle older whole-body escaped-newline imports.

Run from `frontend` using Node 24:

```text
node --test tests/publicContentReading.test.mjs tests/publicContentSeo.test.cjs tests/publicLearningQuiz.test.mjs tests/publicLearningQuizRender.test.cjs
npm exec -- tsc --noEmit
npm exec -- eslint components/public/PublicContentBody.tsx components/public/PublicLearningQuiz.tsx lib/publicContentMarkdown.ts lib/publicLearningQuiz.ts tests/publicLearningQuiz.test.mjs tests/publicLearningQuizRender.test.cjs
```

Validate the existing `npm run build:cloudflare` build with the production public origins configured. Do not deploy a temporary UI verification route. After deployment, preview one English and one Hindi block, deliberately miss a question, check the score, retry the missed question and confirm the original score is retained. Then publish the actual article and check its language and revision links.
