# Comprehensive Code Review — Diego Scifo Portfolio + Neural Digital Twin

**Date:** 2026-04-10  
**Reviewer:** AI Code Reviewer  
**Scope:** Full project — all source files  

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [File-by-File Review](#2-file-by-file-review)
   - [2.1 package.json](#21-packagejson)
   - [2.2 tsconfig.json](#22-tsconfigjson)
   - [2.3 next.config.ts](#23-nextconfigts)
   - [2.4 layout.tsx](#24-layouttsx)
   - [2.5 globals.css](#25-globalscss)
   - [2.6 page.tsx](#26-pagetsx)
   - [2.7 ChatTwin.tsx](#27-chattwintsx)
   - [2.8 route.ts (API)](#28-routets-api)
   - [2.9 Environment & Security](#29-environment--security)
3. [Cross-Cutting Concerns](#3-cross-cutting-concerns)
4. [Summary of All Findings](#4-summary-of-all-findings)
5. [Remedial Actions — Prioritised](#5-remedial-actions--prioritised)

---

## 1. Executive Summary

The project is a **single-page personal portfolio** for Diego Scifo (Java Tech Lead) built with **Next.js 16**, **React 19**, and **Tailwind CSS 4**. It includes a floating **"Neural Digital Twin"** chat widget that proxies requests to the OpenRouter AI API.

**Overall assessment:** The project demonstrates strong visual design and creative UI work. However, there are several issues ranging from a **critical security vulnerability** (API key exposure) to architectural improvements, accessibility gaps, and React anti-patterns that should be addressed before any production deployment.

| Severity | Count |
|----------|-------|
| 🔴 Critical | 2 |
| 🟠 High | 5 |
| 🟡 Medium | 8 |
| 🔵 Low | 6 |

---

## 2. File-by-File Review

### 2.1 `package.json`

```json
"scripts": {
    "dev": "./node_modules/.bin/next dev",
    "build": "./node_modules/.bin/next build",
    "start": "./node_modules/.bin/next start",
    "lint": "./node_modules/.bin/eslint"
}
```

| # | Severity | Finding | Explanation |
|---|----------|---------|-------------|
| 1 | 🟡 Medium | **Non-standard script paths** | Scripts use `./node_modules/.bin/next` instead of the conventional `next`. npm automatically resolves bins from `node_modules/.bin` when running `npm run <script>`. The current approach works but is unusual and will break with package managers that use different bin resolution (e.g., pnpm, yarn PnP). |
| 2 | 🟡 Medium | **Missing `engines` field** | Next.js 16 requires Node.js ≥ 20.9.0 but the project doesn't declare this constraint in `package.json`. The current dev environment uses Node 18.19.1, which causes the app to fail on `npm run dev`. |
| 3 | 🔵 Low | **No test script** | There is no `"test"` script defined. Even for a portfolio site, having at least a smoke test would catch regressions. |

---

### 2.2 `tsconfig.json`

No significant issues. The configuration is a standard Next.js 16 setup with the `@/*` path alias pointing to `./src/*`. The `jsx: "react-jsx"` setting is appropriate for React 19.

| # | Severity | Finding |
|---|----------|---------|
| — | ✅ | No issues found. |

---

### 2.3 `next.config.ts`

The config is empty (`{}` with a comment). This is acceptable for a simple project, though there are missed opportunities:

| # | Severity | Finding | Explanation |
|---|----------|---------|-------------|
| 4 | 🔵 Low | **No image optimization config** | If images are added in the future, `remotePatterns` or `images.domains` should be configured. |
| 5 | 🔵 Low | **No security headers** | No `headers()` function to set `X-Content-Type-Options`, `X-Frame-Options`, `Content-Security-Policy`, etc. |

---

### 2.4 `layout.tsx`

```tsx
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${spaceGrotesk.variable} ${jetBrainsMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-obsidian text-white">
        {children}
      </body>
    </html>
  );
}
```

| # | Severity | Finding | Explanation |
|---|----------|---------|-------------|
| 6 | 🟡 Medium | **`lang="en"` but content is bilingual** | The `<html>` element declares `lang="en"` but certifications and education text are in Spanish ("Angular Avanzado", "Ingeniero en Sistemas de Información"). This can confuse screen readers and accessibility tools. Consider using `lang` attributes on the specific Spanish-language elements, or change the page lang if the primary audience is Spanish-speaking. |
| 7 | 🔵 Low | **No viewport meta tag explicitly set** | Next.js provides a default viewport, but explicitly setting it in metadata exports is a best practice for mobile responsiveness. |

---

### 2.5 `globals.css`

```css
.noise-texture::before {
  content: "";
  position: absolute;
  /* ... */
  background-image: url("data:image/svg+xml,...");
}
```

| # | Severity | Finding | Explanation |
|---|----------|---------|-------------|
| 8 | 🟡 Medium | **`.bg-obsidian` class conflicts with Tailwind** | The custom `.bg-obsidian` class in vanilla CSS duplicates the auto-generated Tailwind `bg-obsidian` utility (from `@theme inline`). If Tailwind's specificity ordering changes between versions, this could cause unexpected behavior. The vanilla CSS class should be removed since the `@theme` block already registers the token. |
| 9 | 🔵 Low | **Custom `* { box-sizing: border-box }` is redundant** | Tailwind CSS 4's preflight (included via `@import "tailwindcss"`) already sets `box-sizing: border-box` on all elements. |
| 10 | 🟡 Medium | **`--fog` and `--card`/`--stroke` tokens are defined but unused** | The CSS custom properties `--fog`, `--card`, and `--stroke` (and their Tailwind counterparts `fog`, `card`, `stroke`) are defined but never referenced in any template. Dead design tokens add confusion for future developers. |

---

### 2.6 `page.tsx`

```tsx
const journey = [ /* ... */ ];
const skills = [ /* ... */ ];
const certifications = [ /* ... */ ];

import ChatTwin from "@/components/ChatTwin";

export default function Home() { /* ... */ }
```

| # | Severity | Finding | Explanation |
|---|----------|---------|-------------|
| 11 | 🟠 High | **Data arrays declared before imports** | The `journey`, `skills`, and `certifications` arrays are declared at the top of the file *before* the `import` statement on line 83. While this technically works in modern bundlers, it violates the ESLint `import/first` rule and is considered a code smell. **Imports should always come before any other statements.** |
| 12 | 🟠 High | **Data duplicated across files** | Career data is hardcoded in both `page.tsx` (as arrays) and `route.ts` (as the `careerData` object). This means any update to Diego's career must be made in two places, which is error-prone and violates DRY (Don't Repeat Yourself). |
| 13 | 🟡 Medium | **Server Component renders a Client Component without boundary** | `page.tsx` is a Server Component (no `"use client"` directive) that imports `<ChatTwin />`, a Client Component. While Next.js handles this correctly by auto-creating a client boundary, the `<ChatTwin />` is rendered inside the `<div className="relative overflow-hidden">` wrapper alongside static server content. This is fine functionally, but it means the parent div cannot use any server-only features like async data fetching because the entire subtree becomes a client boundary. Consider placing `<ChatTwin />` outside the server content wrapper. |
| 14 | 🟡 Medium | **No `<section>` or landmark `aria` labels** | The page uses `<section>` elements but none have `aria-label` or `aria-labelledby` attributes. Screen readers will announce them as generic "region" landmarks, which isn't helpful for navigation. |

---

### 2.7 `ChatTwin.tsx`

This is the largest and most complex component. Several issues were identified:

```tsx
{messages.map((msg, i) => (
  <motion.div key={i} /* ... */ >
```

| # | Severity | Finding | Explanation |
|---|----------|---------|-------------|
| 15 | 🟠 High | **Array index used as React `key`** | Messages are keyed by their array index (`key={i}`). If messages are ever reordered or deleted (e.g., a "delete message" feature), React will incorrectly reuse DOM nodes, causing visual glitches and stale state. Use a unique ID (e.g., `Date.now()` or `crypto.randomUUID()`) generated when each message is created. |
| 16 | 🟠 High | **Typewriter re-renders on every new message** | The `Typewriter` component is triggered for `i === messages.length - 1` which means every time a new message arrives, the *last* assistant message gets the typewriter effect — even old messages when the component re-renders. Additionally, when the Typewriter finishes and the user sends a new message, the previously typewritten message will suddenly switch to plain text (no typewriter), causing a visual "jump". A `hasBeenTyped` flag per message would prevent this. |
| 17 | 🟠 High | **Typewriter has a stale-closure bug** | Inside the `useEffect`, the `setTimeout` callback captures `currentIndex` from the closure. While `setCurrentIndex` uses a functional updater, `setCurrentText` references `text[currentIndex]` directly. If `text` changes between renders (unlikely here but a general concern), the wrong character could be appended. The `text` dependency in the effect's dependency array means the effect will restart if `text` changes, resetting the animation from scratch — which may or may not be desired. |
| 18 | 🟡 Medium | **No response status check before `.json()`** | In `handleSend`, the `fetch` response is parsed with `response.json()` without first checking `response.ok`. If the server returns a 500 with an HTML error page (not JSON), calling `.json()` will throw a `SyntaxError` rather than showing a meaningful error message. |
| 19 | 🟡 Medium | **No input sanitization** | User input is sent directly to the API without any sanitization or length limits. A malicious or accidental extremely long input could cause performance issues or unexpected API charges. |
| 20 | 🔵 Low | **No keyboard accessibility for the close button** | The close button and orb trigger don't have `aria-label` attributes. Screen readers will announce them as empty buttons. |

---

### 2.8 `route.ts` (API)

```tsx
const systemPrompt = `
  You are Diego Scifo's Digital Twin...
  ${careerData.bio}
  ${careerData.skills.join(", ")}
  ${careerData.journey.map(j => `...`).join("\n")}
`;
```

| # | Severity | Finding | Explanation |
|---|----------|---------|-------------|
| 21 | 🔴 Critical | **No rate limiting** | The API route has no rate limiting whatsoever. Any visitor can send unlimited requests to `/api/chat`, which will be proxied to OpenRouter. This could lead to: (a) API quota exhaustion, (b) unexpected billing, (c) denial-of-service. At minimum, implement per-IP rate limiting using `next/headers` or a middleware like `upstash/ratelimit`. |
| 22 | 🟡 Medium | **No input validation on server** | The route blindly destructures `{ messages }` from the request body without validating that it's an array, that each message has the expected shape, or that the array isn't excessively large. A malformed request body will cause an unhandled error. |
| 23 | 🟡 Medium | **System prompt sent on every request** | The full system prompt (including all career data) is sent with every single API call. For a conversation with many messages, this wastes tokens. Consider summarizing or truncating the message history. |
| 24 | 🔵 Low | **Hardcoded model name** | The model `"openai/gpt-oss-120b:free"` is hardcoded. If the model is deprecated or renamed (common with free-tier models on OpenRouter), the entire chat will stop working. This should be an environment variable. |

---

### 2.9 Environment & Security

| # | Severity | Finding | Explanation |
|---|----------|---------|-------------|
| 25 | 🔴 Critical | **API key exposed in plain text in `.env` at the `site/` root** | The file `site/.env` contains the `OPENROUTER_API_KEY` in plain text. While `web/.gitignore` covers `.env*` files inside the `web/` directory, the **parent** `site/.gitignore` only contains `.env` (no wildcard). More critically, the `.env` file is at `site/.env` — one directory *above* the Next.js app. **Next.js only auto-loads `.env` files from its project root (`web/`), not parent directories.** This means the API key seen in `site/.env` won't be loaded by Next.js unless there's also a copy at `web/.env` (which there is — confirmed). Having the same secret in two locations doubles the surface area for accidental exposure. |
| 26 | 🟠 High | **API key not prefixed correctly** | The environment variable `OPENROUTER_API_KEY` does not start with `NEXT_PUBLIC_` — which is correct and intentional (it should remain server-side only). However, there's no explicit documentation or comment confirming this was a deliberate security decision. A future developer might "fix" it by adding the prefix, accidentally exposing it to the client. |

---

## 3. Cross-Cutting Concerns

### 3.1 Performance
- **Bundle size**: `framer-motion` adds ~30-40KB gzipped to the client bundle. For a portfolio site where the chat widget is optional, consider lazy-loading the `ChatTwin` component with `next/dynamic` and `{ ssr: false }`.
- **CSS animations**: The `holographic-scan` animation runs infinitely even when the chat is closed (the orb has its own scan line). This consumes GPU resources unnecessarily on lower-end devices.

### 3.2 Accessibility (a11y)
- No skip-to-content link.
- No focus management when the chat dialog opens/closes.
- The chat input lacks a visible `<label>` element.
- Color contrast: Some text at `text-white/20` and `text-white/30` opacity will fail WCAG AA contrast requirements against the dark background.
- The chat widget behaves like a dialog but doesn't use `role="dialog"`, `aria-modal`, or trap focus.

### 3.3 SEO
- Good: Metadata title and description are set.
- Missing: Open Graph and Twitter Card meta tags for social sharing.
- Missing: A `robots.txt` and `sitemap.xml`.

### 3.4 Testing
- There are zero tests of any kind (unit, integration, end-to-end).

---

## 4. Summary of All Findings

| # | Severity | File | Finding |
|---|----------|------|---------|
| 1 | 🟡 | `package.json` | Non-standard script paths |
| 2 | 🟡 | `package.json` | Missing `engines` field |
| 3 | 🔵 | `package.json` | No test script |
| 4 | 🔵 | `next.config.ts` | No image optimization config |
| 5 | 🔵 | `next.config.ts` | No security headers |
| 6 | 🟡 | `layout.tsx` | `lang="en"` but contains Spanish content |
| 7 | 🔵 | `layout.tsx` | No explicit viewport meta |
| 8 | 🟡 | `globals.css` | `.bg-obsidian` conflicts with Tailwind utility |
| 9 | 🔵 | `globals.css` | Redundant `box-sizing` reset |
| 10 | 🟡 | `globals.css` | Unused design tokens (`fog`, `card`, `stroke`) |
| 11 | 🟠 | `page.tsx` | Data arrays declared before imports |
| 12 | 🟠 | `page.tsx` / `route.ts` | Career data duplicated in two files |
| 13 | 🟡 | `page.tsx` | Server/Client component boundary could be cleaner |
| 14 | 🟡 | `page.tsx` | No `aria-label` on `<section>` elements |
| 15 | 🟠 | `ChatTwin.tsx` | Array index used as React `key` |
| 16 | 🟠 | `ChatTwin.tsx` | Typewriter re-renders on every new message |
| 17 | 🟠 | `ChatTwin.tsx` | Typewriter stale-closure risk |
| 18 | 🟡 | `ChatTwin.tsx` | No `response.ok` check before `.json()` |
| 19 | 🟡 | `ChatTwin.tsx` | No input length limit |
| 20 | 🔵 | `ChatTwin.tsx` | Missing `aria-label` on buttons |
| 21 | 🔴 | `route.ts` | No rate limiting on API route |
| 22 | 🟡 | `route.ts` | No server-side input validation |
| 23 | 🟡 | `route.ts` | System prompt resent every request |
| 24 | 🔵 | `route.ts` | Hardcoded model name |
| 25 | 🔴 | `.env` | API key duplicated across two directories |
| 26 | 🟠 | `.env` | No documentation warning against `NEXT_PUBLIC_` prefix |

---

## 5. Remedial Actions — Prioritised

### 🔴 P0 — Critical (fix immediately)

1. **Consolidate `.env` files.** Delete `site/.env` and keep only `web/.env`. Verify that `web/.gitignore` covers `.env*` (it does). Add a comment inside `web/.env` stating that `OPENROUTER_API_KEY` must never be prefixed with `NEXT_PUBLIC_`.

2. **Add rate limiting to `/api/chat`.** Implement per-IP rate limiting (e.g., 10 requests per minute) using `Map`-based in-memory tracking at minimum, or a proper solution like `@upstash/ratelimit` for production.

### 🟠 P1 — High (fix before production)

3. **Extract career data to a shared module.** Create a file like `src/data/career.ts` exporting the career data, then import it in both `page.tsx` and `route.ts`. This eliminates the duplication.

4. **Move imports above data declarations in `page.tsx`.** Place the `import ChatTwin` statement at the top of the file before any variable declarations.

5. **Generate stable message IDs.** When creating a `Message`, add a unique `id` field (e.g., `crypto.randomUUID()`) and use it as the React `key` instead of the array index.

6. **Fix Typewriter logic.** Add a `typed: boolean` flag to each `Message`. Set it to `true` after the typewriter finishes. Only show the typewriter for messages where `typed === false`.

7. **Check `response.ok` before parsing.**
   ```tsx
   if (!response.ok) {
     throw new Error(`Server error: ${response.status}`);
   }
   const data = await response.json();
   ```

### 🟡 P2 — Medium (fix soon)

8. **Add server-side input validation** in `route.ts`. Verify `messages` is an array, each item has `role` and `content` strings, and enforce a maximum array length (e.g., 50 messages) and maximum content length (e.g., 2000 characters).

9. **Standardise npm scripts.** Replace `./node_modules/.bin/next` with just `next` in all scripts.

10. **Add `engines` field** to `package.json`:
    ```json
    "engines": { "node": ">=20.9.0" }
    ```

11. **Clean up unused design tokens.** Remove `--fog`, `--card`, `--stroke` from `:root` and the corresponding `@theme` entries, or start using them.

12. **Remove duplicate `.bg-obsidian` CSS class.** The Tailwind `@theme` block already registers `obsidian` as a color, making the vanilla CSS class unnecessary.

13. **Add `aria-label` attributes** to all `<section>` elements and interactive buttons (close, send, orb trigger).

14. **Add bilingual language annotations.** Add `lang="es"` attributes to Spanish text elements (certifications, education).

15. **Lazy-load the ChatTwin component.** Use `next/dynamic` to code-split the heavy `framer-motion` dependency:
    ```tsx
    const ChatTwin = dynamic(() => import("@/components/ChatTwin"), { ssr: false });
    ```

### 🔵 P3 — Low (nice to have)

16. **Add Open Graph and Twitter Card meta tags** for better social media presence.

17. **Add security headers** in `next.config.ts` (CSP, X-Frame-Options, etc.).

18. **Move the AI model name** to an environment variable: `OPENROUTER_MODEL`.

19. **Add a basic test script** — even a simple `next build` verification.

20. **Remove redundant `box-sizing: border-box` reset** from `globals.css` since Tailwind's preflight handles it.

21. **Add `robots.txt` and `sitemap.xml`** using the Next.js metadata API.

---

*End of review.*
