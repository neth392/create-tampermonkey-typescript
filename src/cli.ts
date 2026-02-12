#!/usr/bin/env node

import type { PackageJson, TsConfigJson } from 'type-fest'

import fs from 'fs'
import path from 'path'
import prompts from 'prompts'
import kleur from 'kleur'
import { execSync } from 'node:child_process'
import { fileURLToPath } from 'url'

type Params = Awaited<ReturnType<typeof promptForParams>> & {
  projectPath: string
  selectedFeatures: Feature[]
}

type Feature = {
  name: string
  description: string
  directory?: string
  tsConfigModifier?: (config: TsConfigJson) => void
  devDependencies?: string[]
  dependencies?: string[]
  hook?: (params: Params) => void
}

const __FILENAME = fileURLToPath(import.meta.url)
const __DIRNAME = path.dirname(__FILENAME)
const TEMPLATES_DIR = path.join(__DIRNAME, '../templates')

const defaultDevDeps: string[] = [
  'typescript', //
  'vite',
  'vite-plugin-banner',
  'vite-plugin-css-injected-by-js',
  'ts-node',
  '@types/tampermonkey',
]

const defaultDeps: string[] = []

const baseTsConfig: TsConfigJson = {
  compilerOptions: {
    types: ['vite/client', 'node'],
    target: 'ES2022',
    module: 'ESNext',
    moduleResolution: 'NodeNext',
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

const availableFeatures: Feature[] = [
  {
    name: 'React',
    description: 'Adds react support to the project',
    directory: path.join(TEMPLATES_DIR, 'react'),
    tsConfigModifier: (config) => (config.compilerOptions!.jsx = 'react-jsx'),
    devDependencies: ['react', 'react-dom', '@types/react', '@types/react-dom'],
  },
  {
    name: 'Git',
    description: 'Initializes the new project as a git repository',
    directory: path.join(TEMPLATES_DIR, 'git'),
    hook: (params) => execInProjectDir(`git init`, params),
  },
]

async function main() {
  console.log(kleur.green('create-tampermonkey-typescript'))
  if (!checkCwdAccess()) return

  // Prompt for project parameters
  const promptResults = await promptForParams()
  const params: Params = {
    ...promptResults,
    projectPath: path.join(process.cwd(), promptResults.projectName),
    selectedFeatures: promptResults.features.map((featureName: string) =>
      availableFeatures.find((a) => a.name === featureName)
    ),
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
  writeObjectToFile(packageJson, 'package.json', params)

  // Gather dependencies
  const devDeps = [...defaultDevDeps, ...params.selectedFeatures.flatMap((f) => f.devDependencies ?? [])]
  const deps = [...defaultDeps, ...params.selectedFeatures.flatMap((f) => f.dependencies ?? [])]

  // Install dev dependencies
  if (devDeps.length > 0) {
    logWithPrefix('Installing dev dependencies')
    console.log(`    ${kleur.dim(devDeps.join(', '))}`)
    execInProjectDir(`npm install -D ${devDeps.join(' ')}`, params)
  }

  // Install dependencies
  if (deps.length > 0) {
    logWithPrefix('Installing dependencies')
    console.log(`    ${kleur.dim(deps.join(', '))}`)
    execInProjectDir(`npm install ${deps.join(' ')}`, params)
  }

  // Handle tsconfig.json
  const tsConfig = { ...baseTsConfig }
  for (const feature of params.selectedFeatures) {
    if (feature.tsConfigModifier) {
      feature.tsConfigModifier(tsConfig)
    }
  }
  logWithPrefix(`Creating ${kleur.yellow('tsconfig.json')}`)
  writeObjectToFile(tsConfig, 'tsconfig.json', params)

  // Copy files
  logWithPrefix('Copying project files')
  // Base files
  fs.cpSync(path.join(TEMPLATES_DIR, 'base'), params.projectPath, { recursive: true, force: true })
  // Feature files
  params.selectedFeatures
    .filter((f) => f.directory)
    .forEach((f) => fs.cpSync(f.directory!, params.projectPath, { recursive: true, force: true }))

  // Handle feature runAfter's
  logWithPrefix('Running feature hooks')
  params.selectedFeatures.forEach((f) => f.hook?.(params))
}

function logWithPrefix(message: string) {
  console.log(`${kleur.cyan('-')} ${kleur.white(message)}`)
}

function checkCwdAccess() {
  try {
    fs.accessSync(process.cwd(), fs.constants.W_OK | fs.constants.R_OK)
  } catch {
    console.log('Read & write access to current working directory is required.')
    return false
  }
  return true
}

function validateProjectName(projectName: string) {
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
        type: 'multiselect',
        name: 'features',
        message: 'Select features:',
        choices: availableFeatures.map((f) => ({ title: f.name, value: f.name, description: f.description })),
      },
    ],
    {
      onCancel: () => process.exit(0),
    }
  )
}

async function createProjectDirectory(path: string) {
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

function createPackageJson(params: Params): PackageJson {
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

function writeObjectToFile(object: Object, fileName: string, params: Params) {
  const filePath = path.join(params.projectPath, fileName)
  const jsonString = JSON.stringify(object, null, 2)
  fs.writeFileSync(filePath, jsonString)
}

function execInProjectDir(command: string, params: Params) {
  execSync(command, { stdio: 'inherit', cwd: params.projectPath })
}

main().then(
  () => console.log(kleur.green('Done!')),
  (e) => console.error(kleur.red(e.message || e))
)
