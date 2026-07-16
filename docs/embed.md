# Tacto Embed — developer guide

Embed a published Tacto guide on any website: as an inline (auto-resizing)
iframe, or as a popup launcher. Everything is a hosted page framed by an iframe;
`embed.js` is a thin, dependency-free loader.

> Replace `https://app.tacto.so` below with your Tacto origin. A guide's
> **share id** and copy-paste snippets are in the guide's **Share → Developer**
> tab.

---

## 1. Inline — iframe (no JS)

```html
<iframe
  src="https://app.tacto.so/embed/g/SHAREID?mode=interactive"
  style="width:100%;aspect-ratio:16/10;border:0;border-radius:12px"
  allow="fullscreen" loading="lazy" title="Guide"></iframe>
```

Query params: `mode=list|interactive` · `theme=light|dark|auto` · `lang=<code>`.
Works anywhere iframes/oEmbed are accepted (Notion, Confluence, Framer, GitBook,
plain HTML).

## 2. Inline — script (auto-resizing)

```html
<script src="https://app.tacto.so/embed.js" async></script>
<div data-tacto-guide="SHAREID" data-tacto-mode="interactive" data-tacto-theme="auto"></div>
```

The loader replaces the `<div>` with an iframe and resizes it to the content.

## 3. Popup

```html
<script src="https://app.tacto.so/embed.js" async></script>
<button data-tacto-guide-popup="SHAREID" data-tacto-mode="interactive">Show me how</button>
```

Opens the guide in a centered modal (backdrop, close button, `Esc`, focus
restore, `prefers-reduced-motion` aware).

---

## 4. JavaScript SDK

`embed.js` exposes a global `window.Tacto`. The app origin is derived from the
script's own `src`.

```js
// Inline into a target (Element or selector) → instance
const inst = Tacto.embed("#el", { guide: "SHAREID", mode: "list", theme: "auto", height: 520 });

// Popup → instance
const pop = Tacto.open({ guide: "SHAREID", mode: "interactive" });

Tacto.close(pop);      // close a popup (or the most recent if omitted)
Tacto.destroy(inst);   // tear down an embed/popup (or all if omitted)

Tacto.on("complete", (payload) => { /* … */ });   // global listener
Tacto.off("complete", handler);
inst.on("resize", (p) => { /* per-instance */ });
Tacto.rescan();        // re-scan the DOM for data-tacto-* elements
```

**Options:** `{ guide, mode?: "list"|"interactive", theme?: "light"|"dark"|"auto", lang?, height? }`.

## 5. Events

| Event | Payload | Meaning |
|---|---|---|
| `ready` | `{ shareId, mode }` | the guide loaded |
| `resize` | `{ height }` | content height changed (inline auto-resize) |
| `step_change` | `{ index, total? }` | the visible/active step changed |
| `complete` | — | the reader reached completion |
| `error` | `{ message }` | an error occurred inside the embed |
| `open` / `close` | — | popup lifecycle (SDK-emitted) |

All cross-frame messages are **origin-checked** against the app origin; frames are
matched by `contentWindow`, so multiple embeds on one page stay independent.

## 6. Analytics

Reads from embeds flow through the existing guide analytics — **no separate
pipeline**. Each read is tagged `source = "embed"` and keeps the **embedding
site** as `referrerHost` (visible in the guide's *Sources*), plus mode and
completion.

## 7. Security & privacy

- Only `/embed/*` is framable cross-origin (`frame-ancestors *`); the rest of the
  app is `frame-ancestors 'self'`.
- Embed pages serve **published guides only**, are `noindex`, and require no auth.
- `embed.js` has no dependencies, no `eval`, and origin-checks every message.
- In a third-party iframe, browser storage partitioning isolates the visitor id
  per host site (expected).
