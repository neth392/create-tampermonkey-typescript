/**
 * Configured by create-tampermonkey-typescript to combine your entire codebase into a single TamperMonkey-ready script.
 * You can modify it as you like.
 */

import { defineConfig } from 'vite'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'
import cssInjectedByJsPlugin from 'vite-plugin-css-injected-by-js'
import banner from 'vite-plugin-banner'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const pkg = JSON.parse(fs.readFileSync(resolve(__dirname, 'package.json'), 'utf8'))
const hasReact = pkg.devDependencies?.react || pkg.dependencies?.react

// Replaced in the script's header to keep package.json as the source of truth.
const metaTags = {
  '<name>': pkg.name,
  '<version>': pkg.version,
  '<description>': pkg.description,
  '<author>': pkg.author,
  '<homepage>': pkg.homepage,
}

let meta = fs.readFileSync(resolve(__dirname, 'userscript.txt'), 'utf8')

for (const [tagName, tagValue] of Object.entries(metaTags).filter(([_, v]) => v)) {
  meta = meta.replace(tagName, tagValue)
}

export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  plugins: [cssInjectedByJsPlugin({ topExecutionPriority: true }), banner({ content: meta, verify: false })],
  build: {
    cssCodeSplit: false,
    lib: {
      entry: resolve(__dirname, 'src/script.ts'),
      name: pkg.name,
      formats: ['iife'],
      fileName: () => `script.user.js`,
    },
    rollupOptions: {
      ...(hasReact ? { external: ['react', 'react-dom/client'] } : {}),
    },
    outDir: 'dist',
    minify: false,
  },
})
