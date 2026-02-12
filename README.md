# create-tampermonkey-typescript

> A CLI scaffolding tool for creating minimal TamperMonkey userscript projects written in TypeScript.

Write your userscripts in TypeScript, organize code across multiple files, and let the toolchain handle the rest 
— bundling, CSS injection, and userscript header generation are all taken care of. The result is a single `.user.js` 
file ready to install in TamperMonkey.

---

## Features

📦 **TypeScript with multi-file support** — Structure your project however you like. All source files are bundled into 
a single IIFE-format JavaScript file via [Vite](https://vitejs.dev/), fully compatible with TamperMonkey.

🏷️ **Automatic userscript header** — The `// ==UserScript==` block is generated from a template (`userscript.txt`) and
prepended to every build. Metadata fields such as name, version, and description are pulled directly from `package.json`, 
keeping a single source of truth.

🎨 **CSS injection** — Import `.css` files from TypeScript as you normally would. At build time, styles are extracted 
and bundled into the output script, then injected into the page at runtime — no manual DOM manipulation required.

⚛️ **Optional React support** — Scaffold the project with React pre-configured, including type declarations for 
`unsafeWindow.React` and `unsafeWindow.ReactDOM`, and utility functions for accessing them at runtime.

🚀 **GitHub Actions workflows** — Optionally include CI/CD workflows that automatically create Git tags when 
`package.json` version changes, and publish GitHub Releases with the built script attached.

🔧 **Package manager agnostic** — Generated projects are standard Node.js projects. Use npm, yarn, or pnpm — 
whichever you prefer.

---

## Quick Start

### npm
```bash
npx create-tampermonkey-typescript
```

### yarn
```bash
yarn create tampermonkey-typescript
```

### pnpm
```bash
pnpm create tampermonkey-typescript
```

The CLI will walk you through the project configuration — name, version, description, author — and let you 
select optional features (React, Git). The output is your new project folder containing its own `README.md`
to get you started. You can preview that file here: [Generated Project README](templates/base/README.md)
---

## License

[MIT](LICENSE)