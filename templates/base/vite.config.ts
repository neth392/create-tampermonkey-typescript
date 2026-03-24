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
import checker from 'vite-plugin-checker'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const pkg = JSON.parse(fs.readFileSync(resolve(__dirname, 'package.json'), 'utf8'))
const hasReact = pkg.devDependencies?.react || pkg.dependencies?.react
const hasTailwind = pkg.devDependencies?.['@tailwindcss/vite'] || pkg.dependencies?.['@tailwindcss/vite']

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
  meta = meta.replaceAll(tagName, tagValue)
}

export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  plugins: [
    checker({ typescript: true }),
    ...(hasTailwind
      ? [
          (await import('@tailwindcss/vite')).default({
            optimize: { minify: true },
          }),
        ]
      : []),
    cssInjectedByJsPlugin({ topExecutionPriority: true }),
    banner({ content: meta, verify: false }),
    // Uncomment below to remove comments & JSDoc from the final script.
    // {
    //   name: 'strip-comments',
    //   renderChunk(code) {
    //     return code.replace(/\/\*\*[\s\S]*?\*\//g, '').replace(/\/\*[^!][\s\S]*?\*\//g, '')
    //   },
    // },
  ],
  build: {
    cssCodeSplit: false,
    lib: {
      entry: resolve(__dirname, 'src/script.ts'),
      name: pkg.name.replace(/[^a-zA-Z0-9]/g, '_'),
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
