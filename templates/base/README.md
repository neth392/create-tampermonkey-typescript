# {{PROJECT_NAME}}

## Table of Contents

- 🚀 [Quick Start](#quick-start)
- 📁 [Project Structure](#project-structure)
- 🏷️ [Userscript Header](#userscript-header)
- 📦 [Build Output](#build-output)
- 🎨 [CSS](#css)
- 🔗 [Module Resolution](#module-resolution)
- 📚 [Dependencies](#dependencies)
- 🐒 [TamperMonkey API](#tampermonkey-api)
- ⚛️ [React](#react)
- 🌊 [TailwindCSS](#tailwind-css)
- ✨ [Prettier](#prettier)
- ⚙️ [GitHub Workflows](#github-workflows)


## Quick Start

```bash
{{PM_RUN_SCRIPT}} build
```

The built script is output to `dist/script.user.js`

---

## Project Structure

```
{{PROJECT_NAME}}/
├── src/
│   ├── script.ts          # Entry point
│   ├── styles.css         # Stylesheet (imported by script.ts)
│   └── ...                # Your source files
├── userscript.txt          # TamperMonkey header template
├── vite.config.ts          # Vite build configuration
├── tsconfig.json
└── package.json
```

#### Added With React

```
src/
├── global.d.ts             # Type declarations for unsafeWindow.React / ReactDOM
└── util/
    └── react-util.ts       # getReact() and getReactDOM() helpers
```

#### Added With Git / GitHub Workflows

```
.github/workflows/
├── auto-tag.yml            # Creates a Git tag when package.json version changes
└── release.yml             # Builds and publishes a GitHub Release
.gitignore
```

---

## Userscript Header

The file `userscript.txt` defines your script's TamperMonkey metadata. It is automatically prepended to the built script, with placeholders replaced from `package.json` to maintain a single source of truth:

```
// ==UserScript==
// @name           <name>           ← package.json "name"
// @version        <version>        ← package.json "version"
// @description    <description>    ← package.json "description"
// @author         <author>         ← package.json "author"
// @homepage       <homepage>       ← package.json "homepage"
// ==/UserScript==
```

You should customize this file to include directives specific to your script, such as `@match`, `@grant`, `@require`, and so on. See the [TamperMonkey documentation](https://www.tampermonkey.net/documentation.php) for the full list of supported tags.

---

## Build Output

[Vite](https://vitejs.dev/) bundles everything into a single IIFE-format JavaScript file:

- All TypeScript is compiled to JavaScript
- All imported CSS is combined and injected as an inline `<style>` element at runtime
- The userscript header from `userscript.txt` is prepended

---

## CSS

Import `.css` files from anywhere in your source. All stylesheets are combined into a single style node and injected into the page at runtime — no manual DOM manipulation needed.

```typescript
import '@/styles.css'
import './MyComponent.css'
```

---

## Module Resolution

The `@/` path alias points to `src/`, giving you cleaner imports:

```typescript
import { helper } from '@/utils/helper'  // → src/utils/helper.ts
```

---

## Dependencies

Any imported dependency will be included in the bundled script. To keep the output small, the recommended approach is to load libraries via TamperMonkey's [`@require`](https://www.tampermonkey.net/documentation.php?locale=en#meta:require) tag and install them as dev dependencies so they aren't bundled.

**Example with jQuery:**

Install as a dev dependency:

```bash
{{PM_ADD_DEPENDENCY}} -D jquery
```

Then add the `@require` tag to `userscript.txt`:

```
// @require        https://code.jquery.com/jquery-2.1.4.min.js
```

jQuery is now available at runtime without being bundled into your script.

---

## TamperMonkey API

TypeScript types for `GM_` functions are included out of the box. Use them directly:

```typescript
GM_getValue('key', defaultValue)
GM_setValue('key', value)

GM_xmlhttpRequest({
  method: 'GET',
  url: 'https://api.example.com',
  onload: (res) => console.log(res.responseText),
})

GM_notification('Hello!')
GM_addStyle('body { color: red; }')
```

Remember to declare each function you use as a grant in `userscript.txt`:

```
// @grant          GM_getValue
// @grant          GM_setValue
// @grant          GM_xmlhttpRequest
// @grant          GM_notification
// @grant          GM_addStyle
```

---

## React

> This section only applies if React was enabled during project creation.

React and ReactDOM are **not bundled** into the output script. They are expected to be available on the host page via `unsafeWindow`. The generated project includes type declarations (`src/global.d.ts`) and helper functions for accessing them at runtime:

```tsx
import { getReact, getReactDOM } from '@/util/react-util'

const React = getReact()
const ReactDOM = getReactDOM()

const App = () => <div>Hello World</div>

const container = document.createElement('div')
document.body.appendChild(container)

const root = ReactDOM.createRoot(container)
root.render(<App />)
```

---

## Tailwind CSS

Tailwind is configured via the `@tailwindcss/vite` plugin and imported in `src/styles.css`. Just use utility classes in your code — only the classes you reference will be included in the final build.
```ts
const el = document.createElement('div')
el.className = 'bg-blue-500 text-white p-4 rounded'
document.body.appendChild(el)
```

Or with React:
```tsx
const Badge = ({ text, color }: { text: string; color: string }) => (
  <span className={`inline-block px-3 py-1 rounded-full text-sm font-semibold text-white ${color}`}>
    {text}
  </span>
)

const App = () => (
  <div className="flex gap-2 p-4">
    <Badge text="Online" color="bg-green-500" />
    <Badge text="Away" color="bg-yellow-500" />
    <Badge text="Offline" color="bg-red-500" />
  </div>
)

```

For more information, see the [Tailwind CSS docs](https://tailwindcss.com/docs).

---

## Prettier

Prettier is included with a pre-configured `.prettierrc` and `.prettierignore` file. Feel free to change them to best fit your programming style.

---

## GitHub Workflows

> This section only applies if Git was enabled during project creation.

Two GitHub Actions workflows are included to automate your release process.

### Auto-Tagging (`auto-tag.yml`)

Runs on every push to `master`. Reads the version from `package.json` and creates a Git tag (e.g., `v1.2.3`) if one doesn't already exist.

### Release (`release.yml`)

Triggers when the auto-tag workflow completes successfully. Runs the build, then creates a GitHub Release with `dist/script.user.js` attached.

### Publishing Workflow

1. Update `version` in `package.json`
2. Commit and push to `master`
3. The auto-tag workflow creates a new tag
4. The release workflow builds and publishes the script

Users can install directly from your releases by adding these tags to `userscript.txt`:

```
// @updateURL      https://github.com/user/repo/releases/latest/download/script.user.js
// @downloadURL    https://github.com/user/repo/releases/latest/download/script.user.js
```


