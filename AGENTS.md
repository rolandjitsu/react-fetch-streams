# AGENTS.md

Guidance for AI coding agents in this repo. Human contributors: see the
[Contribute](./README.md#contribute) section of the README.

This is `react-fetch-streams`: a single React hook, `useStream`, that streams a response body
via the Fetch + Streams APIs. It is a small, dependency-free, published npm library. Keep it that
way; think twice before adding a runtime dependency.

The toolchain is the Rust-based oxc stack: [oxlint](https://oxc.rs/) to lint,
[Prettier](https://prettier.io/) to format, [tsdown](https://tsdown.dev/) (Rolldown + oxc) to
build, and [Vitest](https://vitest.dev/) to test. There is no Babel, ESLint, or Rollup; do not
reintroduce them.

## Workflow

- Clarify the design before implementing. For anything non-trivial, agree on the approach first.
- One unit of change per commit. Never mix unrelated changes. Present the change for review
  before committing.
- Every change ships with tests. Run local CI before calling it done, and do not claim it passes
  without running it.
- Verify against the code and the tools: read before you answer, run before you assert.

Local CI (must be green before review):

```shell
npm run lint          # oxlint
npm run format:check  # prettier
npm run build         # tsdown
npm run test:cov      # vitest
```

## Writing: code, comments, docs, commits

- Concise and to the point. No fluff. Explain the non-obvious; do not narrate the obvious.
- ASCII only. No em-dash and no `--`; write `-`. Use `->` not the arrow glyph, `!=` not the
  not-equal glyph, and so on.
- Comments justify _why_, not _what_. Delete any comment that restates the code.
- Formatting is not a matter of taste: Prettier owns it. Run `npm run format` rather than
  hand-formatting. House style (`.prettierrc.json`) is single quotes, no trailing commas, no
  bracket spacing, and arrow parens omitted when possible.

## Commits

- [Conventional Commits](https://www.conventionalcommits.org/). Write the subject in the present
  tense, imperative voice: `feat: add retry option`, not `added` or `adds`.
- Keep the body minimal, or omit it. A good subject plus the diff is usually enough; add a body
  only for what the code cannot show (why, a trade-off, a non-obvious consequence). Never restate
  the change or narrate the diff.
- Disclose AI with an `Assisted-by: Claude:claude-opus-4-8` trailer. Never `Co-Authored-By`, and
  never add a human's `Signed-off-by`.

## Tests

- Tests live beside the source as `src/*.test.js` and run under Vitest with the jsdom environment.
- Exercise the hook with `renderHook` from `@testing-library/react`. Mock `fetch` directly with
  `vi.fn` / `vi.stubGlobal`; do not reach for a mocking library.
- The suite drives real async streaming, so keep timing assertions tolerant. Prefer awaiting an
  observable effect (a callback firing) over sleeping for a fixed wall-clock duration where you
  can.
- Coverage must not drop. New code ships with tests that hold or raise it. Measure with
  `npm run test:cov`.

## Code conventions

- Source is modern ESM (`import`/`export`). No JSX in `src` - the hook is UI-agnostic.
- Follow the rules of hooks; oxlint's `react` plugin enforces them. Keep effect dependency arrays
  honest.
- The published API is exactly what `src/index.js` re-exports. Every public change must be
  mirrored in the TypeScript declarations at `typings/index.d.ts` and in the README usage
  examples - keep all three in sync.

## Browser support

- The support matrix is the `browserslist` field in `package.json`; it also documents the intent
  behind the build `target` in `tsdown.config.mjs`. Keep the two consistent.
- Do not silently narrow or widen support. Changing it is a deliberate change: update the README
  "Browser Support" section to match.

## Build and publish

- `npm run build` bundles `src` with tsdown into `dist/` (CommonJS, ESM, and minified UMD). What
  ships to npm is the `files` allowlist in `package.json`; keep it accurate.
- Do not hand-edit anything in `dist/` - it is generated.

## CI workflows

- GitHub Actions live in `.github/workflows`. Write the workflow `name:`, every job name, and
  every named step in Sentence case.
- Keep workflows minimal and scoped to one purpose; prefer the built-in `GITHUB_TOKEN` over a
  personal access token.
