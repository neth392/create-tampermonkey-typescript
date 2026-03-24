#!/usr/bin/env node

import type { PackageJson, TsConfigJson } from 'type-fest'

import fs from 'fs'
import path from 'path'
import prompts from 'prompts'
import kleur from 'kleur'
import { execSync } from 'node:child_process'
import { fileURLToPath } from 'url'

export type Params = Awaited<ReturnType<typeof promptForParams>> & {
  projectPath: string
  features: Feature[]
  packageManager: PackageManager
}

export type Feature = {
  name: string
  description: string
  directory?: string
  tsConfigModifier?: (config: TsConfigJson) => void
  devDependencies?: string[]
  dependencies?: string[]
  hook?: (params: Params) => void
}

export type PackageManager = {
  name: string
  exists: () => boolean
  installCmd: string
  addDependencyCmd: string
  runCmd: string
}

export const __FILENAME = fileURLToPath(import.meta.url)
export const __DIRNAME = path.dirname(__FILENAME)
export const TEMPLATES_DIR = path.join(__DIRNAME, '../templates')

export const defaultDevDeps: string[] = [
  'typescript', //
  'vite',
  'vite-plugin-checker',
  'vite-plugin-banner',
  'vite-plugin-css-injected-by-js',
  'ts-node',
  '@types/tampermonkey',
]

export const defaultDeps: string[] = []

export const baseTsConfig: TsConfigJson = {
  compilerOptions: {
    types: ['vite/client', 'node', 'tampermonkey'],
    target: 'ES2022',
    module: 'ESNext',
    moduleResolution: 'bundler',
    strict: true,
    esModuleInterop: true,
    forceConsistentCasingInFileNames: true,
    skipLibCheck: true,
    resolveJsonModule: true,
    outDir: 'dist',
    baseUrl: '.',
    paths: {
      '@/*': ['src/*'],
    },
    lib: ['ES2022', 'dom', 'dom.iterable'],
  },
  include: ['src'],
}

export const basePrettierRc = {
  trailingComma: 'es5',
  tabWidth: 2,
  semi: false,
  singleQuote: true,
  printWidth: 120,
  plugins: [],
}

export const prettierTailwindPlugins = [
  'prettier-plugin-tailwindcss',
  'prettier-plugin-classnames',
  'prettier-plugin-merge',
]

export const availableFeatures: Feature[] = [
  {
    name: 'React',
    description: 'Adds react support to the project',
    directory: path.join(TEMPLATES_DIR, 'react'),
    tsConfigModifier: (config) => (config.compilerOptions!.jsx = 'react'),
    devDependencies: ['react', 'react-dom', '@types/react', '@types/react-dom'],
  },
  {
    name: 'TailwindCSS',
    description: 'Adds TailwindCSS support to the project',
    directory: path.join(TEMPLATES_DIR, 'tailwindcss'),
    devDependencies: ['tailwindcss', '@tailwindcss/vite'],
  },
  {
    name: 'Prettier',
    description: 'Adds Prettier with default .prettierrc and .prettierignore files',
    directory: path.join(TEMPLATES_DIR, 'prettier'),
    devDependencies: ['prettier'],
    hook: (params) => {
      if (params.prettierTailwindPlugins) {
        installDependencies(params, prettierTailwindPlugins, '-D')
      }
      const prettierRc = {
        ...basePrettierRc,
        ...(params.prettierTailwindPlugins ? { plugins: prettierTailwindPlugins } : {}),
      }
      writeObjectToJsonFile(prettierRc, '.prettierrc', params)
      renameDotFiles(params, 'prettierignore')
    },
  },
  {
    name: 'Git',
    description: 'Initializes the new project as a git repository',
    directory: path.join(TEMPLATES_DIR, 'git'),
    hook: (params) => {
      renameDotFiles(params, 'gitignore')
      execInProjectDir(`git init && git add . && git commit -m "Initial commit"`, params)
    },
  },
  {
    name: 'Github Workflows',
    description:
      'Includes 2 workflows; one for tagging releases with current version, and another for building & creating a release',
    directory: path.join(TEMPLATES_DIR, 'github-workflows'),
  },
]

export const availablePackageManagers: PackageManager[] = [
  {
    name: 'npm',
    exists: () => commandExists('npm --version'),
    installCmd: 'npm install',
    addDependencyCmd: 'npm install',
    runCmd: 'npm run',
  },
  {
    name: 'yarn',
    exists: () => commandExists('yarn --version'),
    installCmd: 'yarn install',
    addDependencyCmd: 'yarn add',
    runCmd: 'yarn run',
  },
  {
    name: 'pnpm',
    exists: () => commandExists('pnpm --version'),
    installCmd: 'pnpm install',
    addDependencyCmd: 'pnpm add',
    runCmd: 'pnpm run',
  },
]

async function main() {
  console.log(kleur.green('create-tampermonkey-typescript'))
  if (!checkCwdAccess()) return
  if (!findValidPackageManager()) return

  // Prompt for project parameters
  const promptResults = await promptForParams()
  const params: Params = {
    ...promptResults,
    projectPath: path.join(process.cwd(), promptResults.projectName),
    features: promptResults.featureNames.map((featureName: string) =>
      availableFeatures.find((a) => a.name === featureName)
    ),
    packageManager: availablePackageManagers.find((pm) => pm.name === promptResults.packageManagerName)!,
  }

  // Create the directory
  logWithPrefix(`Creating directory ${kleur.yellow(params.projectPath)}`)

  const createDirResult = await createProjectDirectory(params.projectPath)
  if (typeof createDirResult === 'string') {
    console.log(kleur.red('An occurred while attempting to create the project directory:'))
    console.log(kleur.red(createDirResult))
    return
  }

  // Initialize package.json
  logWithPrefix(`Creating ${kleur.yellow('package.json')}`)
  const packageJson = createPackageJson(params)
  writeObjectToJsonFile(packageJson, 'package.json', params)

  // Initialize the lock file
  logWithPrefix(`Initializing lock file`)
  execInProjectDir(`${params.packageManager.installCmd}`, params)

  // Gather dependencies
  const devDeps = [...defaultDevDeps, ...params.features.flatMap((f) => f.devDependencies ?? [])]
  const deps = [...defaultDeps, ...params.features.flatMap((f) => f.dependencies ?? [])]

  // Install dev dependencies
  if (devDeps.length > 0) {
    logWithPrefix('Installing dev dependencies')
    console.log(`    ${kleur.dim(devDeps.join(', '))}`)
    installDependencies(params, devDeps, '-D')
  }

  // Install dependencies
  if (deps.length > 0) {
    logWithPrefix('Installing dependencies')
    console.log(`    ${kleur.dim(deps.join(', '))}`)
    installDependencies(params, deps, '-D')
  }

  // Handle tsconfig.json
  const tsConfig = { ...baseTsConfig }
  for (const feature of params.features) {
    if (feature.tsConfigModifier) {
      feature.tsConfigModifier(tsConfig)
    }
  }
  logWithPrefix(`Creating ${kleur.yellow('tsconfig.json')}`)
  writeObjectToJsonFile(tsConfig, 'tsconfig.json', params)

  // Copy files
  logWithPrefix('Copying project files')
  // Base files
  fs.cpSync(path.join(TEMPLATES_DIR, 'base'), params.projectPath, { recursive: true, force: true })
  // README.md replacements
  const readmePath = path.join(params.projectPath, 'README.md')
  let content = fs.readFileSync(readmePath, 'utf-8')
  content = content.replaceAll('{{PROJECT_NAME}}', params.projectName)
  content = content.replaceAll('{{PROJECT_PATH}}', params.projectPath)
  content = content.replaceAll('{{PM_ADD_DEPENDENCY}}', params.packageManager.addDependencyCmd)
  content = content.replaceAll('{{PM_RUN_SCRIPT}}', params.packageManager.runCmd)
  fs.writeFileSync(readmePath, content)

  // Feature files
  params.features
    .filter((f) => f.directory)
    .forEach((f) => fs.cpSync(f.directory!, params.projectPath, { recursive: true, force: true }))

  // Handle feature hooks
  params.features
    .filter((f) => f.hook)
    .forEach((f) => {
      logWithPrefix(`Running feature hook: ${kleur.yellow(f.name)}`)
      f.hook!(params)
    })

  console.log(`${kleur.green('Done!')} Project created at ${kleur.yellow(params.projectPath)}`)
}

function logWithPrefix(message: string) {
  console.log(`${kleur.cyan('-')} ${kleur.white(message)}`)
}

export function commandExists(cmd: string): boolean {
  try {
    execSync(cmd, { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

export function checkCwdAccess() {
  try {
    fs.accessSync(process.cwd(), fs.constants.W_OK | fs.constants.R_OK)
  } catch {
    console.log(kleur.red('Read & write access to current working directory is required.'))
    return false
  }
  return true
}

export function findValidPackageManager() {
  if (!availablePackageManagers.find((pm) => pm.exists())) {
    console.log(kleur.red('Could not find any valid package manager: '))
    console.log(kleur.yellow(`(${availablePackageManagers.map((pm) => pm.name).join(', ')})`))
    return false
  }
  return true
}

export function validateProjectName(projectName: string) {
  if (!projectName || projectName.length === 0) return 'Project name cannot be empty'
  if (projectName.includes(' ')) return 'Project name cannot contain spaces'

  const projectPath = path.join(process.cwd(), projectName)
  try {
    const stats = fs.statSync(projectPath)
    if (!stats.isDirectory()) {
      return `Path ${projectPath} already exists and is not a directory.`
    }
    const files = fs.readdirSync(projectPath)
    if (files.length > 0) return `Directory ${projectPath} already exists and is not empty.`
  } catch {}

  return true
}

async function promptForParams() {
  return await prompts(
    [
      {
        type: 'text',
        name: 'projectName',
        message: 'Project name:',
        format: (s) => s.trim(),
        validate: (s) => validateProjectName(s.trim()),
      },
      {
        type: 'text',
        name: 'version',
        message: 'Version:',
      },
      {
        type: 'text',
        name: 'description',
        message: 'Description:',
      },
      {
        type: 'text',
        name: 'author',
        message: 'Author:',
      },
      {
        type: 'select',
        name: 'packageManagerName',
        message: 'Package manager:',
        choices: availablePackageManagers.filter((pm) => pm.exists()).map((pm) => ({ title: pm.name, value: pm.name })),
      },
      {
        type: 'multiselect',
        name: 'featureNames',
        message: 'Select features:',
        choices: availableFeatures.map((f) => ({ title: f.name, value: f.name, description: f.description })),
      },
      {
        type: (prev) => (prev.includes('Prettier') && prev.includes('TailwindCSS') ? 'confirm' : null),
        name: 'prettierTailwindPlugins',
        message:
          'Install prettier-plugin-tailwindcss (auto-sorts classes) and prettier-plugin-classnames (wraps long class strings)?',
      },
    ],
    {
      onCancel: () => process.exit(0),
    }
  )
}

export async function createProjectDirectory(path: string) {
  try {
    fs.mkdirSync(path, { recursive: true })
    return true
  } catch (error) {
    if (error instanceof Error) {
      return error.message
    }
    return 'Unknown error.'
  }
}

export function createPackageJson(params: Params): PackageJson {
  return {
    name: params.projectName,
    description: params.description,
    version: params.version,
    author: params.author,
    main: 'dist/script.user.js',
    type: 'module',
    scripts: {
      build: 'vite build',
    },
  }
}

export function writeObjectToJsonFile(object: Object, fileName: string, params: Params) {
  const filePath = path.join(params.projectPath, fileName)
  const jsonString = JSON.stringify(object, null, 2)
  fs.writeFileSync(filePath, jsonString)
}

function execInProjectDir(command: string, params: Params) {
  execSync(command, { stdio: 'inherit', cwd: params.projectPath })
}

function installDependencies(params: Params, dependencies: string[], flags: string = '') {
  execInProjectDir(`${params.packageManager.addDependencyCmd} ${flags} ${dependencies.join(' ')}`, params)
}

export function renameDotFiles(params: Params, ...fileNames: string[]) {
  for (const fileName of fileNames) {
    fs.renameSync(path.join(params.projectPath, `_${fileName}`), path.join(params.projectPath, `.${fileName}`))
  }
}

const isDirectRun = process.argv[1]?.endsWith('cli.ts') || process.argv[1]?.endsWith('cli.js')
if (isDirectRun) {
  main().then(
    () => {},
    (e) => console.error(kleur.red(e.message || e))
  )
}
