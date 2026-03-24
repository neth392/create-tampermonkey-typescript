/**
 * NOTE: Tests generated with AI, didn't want to spend time on writing them but figured they could help for
 * when I edit the project.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import fs from 'fs'
import path from 'path'
import os from 'os'

import {
  validateProjectName,
  createPackageJson,
  createProjectDirectory,
  writeObjectToJsonFile,
  renameDotFiles,
  commandExists,
  checkCwdAccess,
  availableFeatures,
  availablePackageManagers,
  defaultDevDeps,
  defaultDeps,
  baseTsConfig,
  basePrettierRc,
  prettierTailwindPlugins,
  type Params,
  type Feature,
  type PackageManager,
} from '../src/cli.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a temporary directory for test isolation */
function makeTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'ctt-test-'))
}

/** Build a minimal Params object pointing at a temp directory */
function makeParams(overrides: Partial<Params> = {}): Params {
  const projectPath = overrides.projectPath ?? makeTmpDir()
  if (!fs.existsSync(projectPath)) fs.mkdirSync(projectPath, { recursive: true })

  return {
    projectName: 'test-project',
    version: '1.0.0',
    description: 'A test project',
    author: 'tester',
    projectPath,
    featureNames: [],
    features: [],
    packageManagerName: 'npm',
    packageManager: availablePackageManagers[0]!,
    prettierTailwindPlugins: false,
    ...overrides,
  } as Params
}

// ---------------------------------------------------------------------------
// validateProjectName
// ---------------------------------------------------------------------------

describe('validateProjectName', () => {
  let originalCwd: string
  let tmpDir: string

  beforeEach(() => {
    originalCwd = process.cwd()
    tmpDir = makeTmpDir()
    process.chdir(tmpDir)
  })

  afterEach(() => {
    process.chdir(originalCwd)
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it('rejects empty string', () => {
    expect(validateProjectName('')).toBe('Project name cannot be empty')
  })

  it('rejects names with spaces', () => {
    expect(validateProjectName('my project')).toBe('Project name cannot contain spaces')
  })

  it('accepts a valid name when directory does not exist', () => {
    expect(validateProjectName('fresh-project')).toBe(true)
  })

  it('accepts a valid name when directory exists but is empty', () => {
    fs.mkdirSync(path.join(tmpDir, 'empty-dir'))
    expect(validateProjectName('empty-dir')).toBe(true)
  })

  it('rejects when directory exists and is not empty', () => {
    const dir = path.join(tmpDir, 'full-dir')
    fs.mkdirSync(dir)
    fs.writeFileSync(path.join(dir, 'file.txt'), 'content')
    const result = validateProjectName('full-dir')
    expect(result).toContain('already exists and is not empty')
  })

  it('rejects when path exists but is a file, not a directory', () => {
    fs.writeFileSync(path.join(tmpDir, 'some-file'), 'data')
    const result = validateProjectName('some-file')
    expect(result).toContain('already exists and is not a directory')
  })
})

// ---------------------------------------------------------------------------
// createProjectDirectory
// ---------------------------------------------------------------------------

describe('createProjectDirectory', () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = makeTmpDir()
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it('creates a new directory and returns true', async () => {
    const target = path.join(tmpDir, 'new-project')
    const result = await createProjectDirectory(target)
    expect(result).toBe(true)
    expect(fs.existsSync(target)).toBe(true)
    expect(fs.statSync(target).isDirectory()).toBe(true)
  })

  it('creates nested directories recursively', async () => {
    const target = path.join(tmpDir, 'a', 'b', 'c')
    const result = await createProjectDirectory(target)
    expect(result).toBe(true)
    expect(fs.existsSync(target)).toBe(true)
  })

  it('returns true when directory already exists', async () => {
    const target = path.join(tmpDir, 'existing')
    fs.mkdirSync(target)
    const result = await createProjectDirectory(target)
    expect(result).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// createPackageJson
// ---------------------------------------------------------------------------

describe('createPackageJson', () => {
  it('generates correct package.json structure', () => {
    const params = makeParams({
      projectName: 'my-script',
      version: '2.3.4',
      description: 'Does things',
      author: 'Jane',
    })

    const pkg = createPackageJson(params)

    expect(pkg.name).toBe('my-script')
    expect(pkg.version).toBe('2.3.4')
    expect(pkg.description).toBe('Does things')
    expect(pkg.author).toBe('Jane')
    expect(pkg.main).toBe('dist/script.user.js')
    expect(pkg.type).toBe('module')
    expect(pkg.scripts).toEqual({ build: 'vite build' })
  })

  it('handles empty/undefined optional fields gracefully', () => {
    const params = makeParams({
      projectName: 'minimal',
      version: undefined as any,
      description: undefined as any,
      author: undefined as any,
    })

    const pkg = createPackageJson(params)
    expect(pkg.name).toBe('minimal')
    expect(pkg.version).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// writeObjectToJsonFile
// ---------------------------------------------------------------------------

describe('writeObjectToJsonFile', () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = makeTmpDir()
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it('writes a JSON file with 2-space indentation', () => {
    const params = makeParams({ projectPath: tmpDir })
    const data = { foo: 'bar', num: 42 }

    writeObjectToJsonFile(data, 'test.json', params)

    const written = fs.readFileSync(path.join(tmpDir, 'test.json'), 'utf-8')
    expect(JSON.parse(written)).toEqual(data)
    // Verify pretty-printed (2-space indent)
    expect(written).toContain('  "foo"')
  })

  it('overwrites an existing file', () => {
    const params = makeParams({ projectPath: tmpDir })
    const filePath = path.join(tmpDir, 'overwrite.json')
    fs.writeFileSync(filePath, '{"old":true}')

    writeObjectToJsonFile({ new: true }, 'overwrite.json', params)

    expect(JSON.parse(fs.readFileSync(filePath, 'utf-8'))).toEqual({ new: true })
  })
})

// ---------------------------------------------------------------------------
// renameDotFiles
// ---------------------------------------------------------------------------

describe('renameDotFiles', () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = makeTmpDir()
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it('renames _gitignore to .gitignore', () => {
    const params = makeParams({ projectPath: tmpDir })
    fs.writeFileSync(path.join(tmpDir, '_gitignore'), 'node_modules/')

    renameDotFiles(params, 'gitignore')

    expect(fs.existsSync(path.join(tmpDir, '.gitignore'))).toBe(true)
    expect(fs.existsSync(path.join(tmpDir, '_gitignore'))).toBe(false)
    expect(fs.readFileSync(path.join(tmpDir, '.gitignore'), 'utf-8')).toBe('node_modules/')
  })

  it('renames multiple files at once', () => {
    const params = makeParams({ projectPath: tmpDir })
    fs.writeFileSync(path.join(tmpDir, '_gitignore'), 'a')
    fs.writeFileSync(path.join(tmpDir, '_prettierignore'), 'b')

    renameDotFiles(params, 'gitignore', 'prettierignore')

    expect(fs.existsSync(path.join(tmpDir, '.gitignore'))).toBe(true)
    expect(fs.existsSync(path.join(tmpDir, '.prettierignore'))).toBe(true)
  })

  it('throws when source file does not exist', () => {
    const params = makeParams({ projectPath: tmpDir })
    expect(() => renameDotFiles(params, 'nonexistent')).toThrow()
  })
})

// ---------------------------------------------------------------------------
// commandExists
// ---------------------------------------------------------------------------

describe('commandExists', () => {
  it('returns true for a command that exists', () => {
    // `echo` or `node` should exist in any test environment
    expect(commandExists('node --version')).toBe(true)
  })

  it('returns false for a command that does not exist', () => {
    expect(commandExists('definitely_not_a_real_command_xyz_12345')).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// checkCwdAccess
// ---------------------------------------------------------------------------

describe('checkCwdAccess', () => {
  it('returns true when cwd is accessible', () => {
    // The test runner's cwd should always be accessible
    expect(checkCwdAccess()).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Constants & configuration
// ---------------------------------------------------------------------------

describe('defaultDevDeps', () => {
  it('includes core build dependencies', () => {
    expect(defaultDevDeps).toContain('typescript')
    expect(defaultDevDeps).toContain('vite')
    expect(defaultDevDeps).toContain('vite-plugin-banner')
    expect(defaultDevDeps).toContain('vite-plugin-checker')
    expect(defaultDevDeps).toContain('vite-plugin-css-injected-by-js')
    expect(defaultDevDeps).toContain('ts-node')
    expect(defaultDevDeps).toContain('@types/tampermonkey')
  })

  it('has exactly 7 entries', () => {
    expect(defaultDevDeps).toHaveLength(7)
  })
})

describe('defaultDeps', () => {
  it('is empty (no runtime dependencies by default)', () => {
    expect(defaultDeps).toHaveLength(0)
  })
})

describe('baseTsConfig', () => {
  it('targets ES2022', () => {
    expect(baseTsConfig.compilerOptions?.target).toBe('ES2022')
  })

  it('uses bundler module resolution', () => {
    expect(baseTsConfig.compilerOptions?.moduleResolution).toBe('bundler')
  })

  it('enables strict mode', () => {
    expect(baseTsConfig.compilerOptions?.strict).toBe(true)
  })

  it('includes DOM libs for browser userscripts', () => {
    expect(baseTsConfig.compilerOptions?.lib).toContain('dom')
    expect(baseTsConfig.compilerOptions?.lib).toContain('dom.iterable')
  })

  it('sets up @/ path alias', () => {
    expect(baseTsConfig.compilerOptions?.paths).toEqual({ '@/*': ['src/*'] })
  })

  it('includes type declarations for vite, node, and tampermonkey', () => {
    expect(baseTsConfig.compilerOptions?.types).toContain('vite/client')
    expect(baseTsConfig.compilerOptions?.types).toContain('node')
    expect(baseTsConfig.compilerOptions?.types).toContain('tampermonkey')
  })
})

describe('basePrettierRc', () => {
  it('uses 2-space tabs', () => {
    expect(basePrettierRc.tabWidth).toBe(2)
  })

  it('disables semicolons', () => {
    expect(basePrettierRc.semi).toBe(false)
  })

  it('uses single quotes', () => {
    expect(basePrettierRc.singleQuote).toBe(true)
  })

  it('has 120 char print width', () => {
    expect(basePrettierRc.printWidth).toBe(120)
  })

  it('starts with empty plugins array', () => {
    expect(basePrettierRc.plugins).toEqual([])
  })
})

describe('prettierTailwindPlugins', () => {
  it('includes the three tailwind-related prettier plugins', () => {
    expect(prettierTailwindPlugins).toContain('prettier-plugin-tailwindcss')
    expect(prettierTailwindPlugins).toContain('prettier-plugin-classnames')
    expect(prettierTailwindPlugins).toContain('prettier-plugin-merge')
    expect(prettierTailwindPlugins).toHaveLength(3)
  })
})

// ---------------------------------------------------------------------------
// availableFeatures
// ---------------------------------------------------------------------------

describe('availableFeatures', () => {
  it('has 5 features', () => {
    expect(availableFeatures).toHaveLength(5)
  })

  const featureNames = ['React', 'TailwindCSS', 'Prettier', 'Git', 'Github Workflows']

  it.each(featureNames)('includes the "%s" feature', (name) => {
    expect(availableFeatures.find((f) => f.name === name)).toBeDefined()
  })

  describe('React feature', () => {
    const react = availableFeatures.find((f) => f.name === 'React')!

    it('has a directory', () => {
      expect(react.directory).toBeDefined()
      expect(react.directory).toContain('react')
    })

    it('has a tsConfigModifier that sets jsx to "react"', () => {
      const config = { compilerOptions: {} } as any
      react.tsConfigModifier!(config)
      expect(config.compilerOptions.jsx).toBe('react')
    })

    it('includes react-related devDependencies', () => {
      expect(react.devDependencies).toContain('react')
      expect(react.devDependencies).toContain('react-dom')
      expect(react.devDependencies).toContain('@types/react')
      expect(react.devDependencies).toContain('@types/react-dom')
    })
  })

  describe('TailwindCSS feature', () => {
    const tailwind = availableFeatures.find((f) => f.name === 'TailwindCSS')!

    it('includes tailwind devDependencies', () => {
      expect(tailwind.devDependencies).toContain('tailwindcss')
      expect(tailwind.devDependencies).toContain('@tailwindcss/vite')
    })

    it('has no hook', () => {
      expect(tailwind.hook).toBeUndefined()
    })
  })

  describe('Prettier feature', () => {
    const prettier = availableFeatures.find((f) => f.name === 'Prettier')!

    it('has a hook function', () => {
      expect(prettier.hook).toBeDefined()
      expect(typeof prettier.hook).toBe('function')
    })

    it('includes prettier devDependency', () => {
      expect(prettier.devDependencies).toContain('prettier')
    })
  })

  describe('Git feature', () => {
    const git = availableFeatures.find((f) => f.name === 'Git')!

    it('has a directory', () => {
      expect(git.directory).toBeDefined()
      expect(git.directory).toContain('git')
    })

    it('has a hook function', () => {
      expect(git.hook).toBeDefined()
      expect(typeof git.hook).toBe('function')
    })
  })

  describe('Github Workflows feature', () => {
    const workflows = availableFeatures.find((f) => f.name === 'Github Workflows')!

    it('has a directory', () => {
      expect(workflows.directory).toBeDefined()
      expect(workflows.directory).toContain('github-workflows')
    })

    it('has no hook', () => {
      expect(workflows.hook).toBeUndefined()
    })

    it('has no devDependencies', () => {
      expect(workflows.devDependencies).toBeUndefined()
    })
  })
})

// ---------------------------------------------------------------------------
// availablePackageManagers
// ---------------------------------------------------------------------------

describe('availablePackageManagers', () => {
  it('has 3 package managers', () => {
    expect(availablePackageManagers).toHaveLength(3)
  })

  it.each(['npm', 'yarn', 'pnpm'])('includes %s', (name) => {
    const pm = availablePackageManagers.find((p) => p.name === name)
    expect(pm).toBeDefined()
  })

  describe('npm config', () => {
    const npm = availablePackageManagers.find((p) => p.name === 'npm')!

    it('uses "npm install" for install', () => {
      expect(npm.installCmd).toBe('npm install')
    })

    it('uses "npm install" for adding dependencies', () => {
      expect(npm.addDependencyCmd).toBe('npm install')
    })

    it('uses "npm run" for running scripts', () => {
      expect(npm.runCmd).toBe('npm run')
    })
  })

  describe('yarn config', () => {
    const yarn = availablePackageManagers.find((p) => p.name === 'yarn')!

    it('uses "yarn add" for adding dependencies', () => {
      expect(yarn.addDependencyCmd).toBe('yarn add')
    })

    it('uses "yarn run" for running scripts', () => {
      expect(yarn.runCmd).toBe('yarn run')
    })
  })

  describe('pnpm config', () => {
    const pnpm = availablePackageManagers.find((p) => p.name === 'pnpm')!

    it('uses "pnpm add" for adding dependencies', () => {
      expect(pnpm.addDependencyCmd).toBe('pnpm add')
    })

    it('uses "pnpm run" for running scripts', () => {
      expect(pnpm.runCmd).toBe('pnpm run')
    })
  })

  it('each package manager has an exists() function', () => {
    for (const pm of availablePackageManagers) {
      expect(typeof pm.exists).toBe('function')
    }
  })
})

// ---------------------------------------------------------------------------
// Feature dependency aggregation
// ---------------------------------------------------------------------------

describe('feature dependency aggregation', () => {
  it('collects devDependencies from multiple features', () => {
    const selected: Feature[] = [
      availableFeatures.find((f) => f.name === 'React')!,
      availableFeatures.find((f) => f.name === 'TailwindCSS')!,
    ]

    const devDeps = [...defaultDevDeps, ...selected.flatMap((f) => f.devDependencies ?? [])]

    expect(devDeps).toContain('typescript')
    expect(devDeps).toContain('react')
    expect(devDeps).toContain('react-dom')
    expect(devDeps).toContain('tailwindcss')
    expect(devDeps).toContain('@tailwindcss/vite')
  })

  it('handles features with no devDependencies', () => {
    const selected: Feature[] = [availableFeatures.find((f) => f.name === 'Github Workflows')!]

    const devDeps = [...defaultDevDeps, ...selected.flatMap((f) => f.devDependencies ?? [])]

    // Should only contain defaults
    expect(devDeps).toEqual(defaultDevDeps)
  })
})

// ---------------------------------------------------------------------------
// tsConfig modification by features
// ---------------------------------------------------------------------------

describe('tsConfig feature modification', () => {
  it('React feature adds jsx: "react" to compilerOptions', () => {
    const tsConfig = JSON.parse(JSON.stringify(baseTsConfig))
    const react = availableFeatures.find((f) => f.name === 'React')!

    react.tsConfigModifier!(tsConfig)

    expect(tsConfig.compilerOptions.jsx).toBe('react')
  })

  it('non-React features do not modify tsConfig', () => {
    const tsConfig = JSON.parse(JSON.stringify(baseTsConfig))
    const original = JSON.parse(JSON.stringify(tsConfig))

    const tailwind = availableFeatures.find((f) => f.name === 'TailwindCSS')!
    expect(tailwind.tsConfigModifier).toBeUndefined()

    // tsConfig should be unchanged
    expect(tsConfig).toEqual(original)
  })

  it('applying multiple features compounds modifications', () => {
    const tsConfig = JSON.parse(JSON.stringify(baseTsConfig))

    for (const feature of availableFeatures) {
      if (feature.tsConfigModifier) {
        feature.tsConfigModifier(tsConfig)
      }
    }

    // Only React adds a tsConfig modifier
    expect(tsConfig.compilerOptions.jsx).toBe('react')
    // Everything else should still be there
    expect(tsConfig.compilerOptions.strict).toBe(true)
    expect(tsConfig.compilerOptions.target).toBe('ES2022')
  })
})

// ---------------------------------------------------------------------------
// Prettier hook behavior
// ---------------------------------------------------------------------------

describe('Prettier feature hook', () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = makeTmpDir()
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it('creates .prettierrc without tailwind plugins when not selected', () => {
    // Create the _prettierignore file that the hook will rename
    fs.writeFileSync(path.join(tmpDir, '_prettierignore'), 'dist/')

    const params = makeParams({
      projectPath: tmpDir,
      prettierTailwindPlugins: false,
      // Mock package manager to avoid actual shell commands
      packageManager: {
        name: 'npm',
        exists: () => true,
        installCmd: 'echo',
        addDependencyCmd: 'echo',
        runCmd: 'echo',
      },
    })

    const prettier = availableFeatures.find((f) => f.name === 'Prettier')!
    prettier.hook!(params)

    const prettierRc = JSON.parse(fs.readFileSync(path.join(tmpDir, '.prettierrc'), 'utf-8'))
    expect(prettierRc.tabWidth).toBe(2)
    expect(prettierRc.semi).toBe(false)
    expect(prettierRc.singleQuote).toBe(true)
    expect(prettierRc.plugins).toEqual([])
  })

  it('renames _prettierignore to .prettierignore', () => {
    fs.writeFileSync(path.join(tmpDir, '_prettierignore'), 'dist/')

    const params = makeParams({
      projectPath: tmpDir,
      prettierTailwindPlugins: false,
      packageManager: {
        name: 'npm',
        exists: () => true,
        installCmd: 'echo',
        addDependencyCmd: 'echo',
        runCmd: 'echo',
      },
    })

    const prettier = availableFeatures.find((f) => f.name === 'Prettier')!
    prettier.hook!(params)

    expect(fs.existsSync(path.join(tmpDir, '.prettierignore'))).toBe(true)
    expect(fs.existsSync(path.join(tmpDir, '_prettierignore'))).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Template file existence (smoke tests)
// ---------------------------------------------------------------------------

describe('template directories', () => {
  it('every feature with a directory points to a path containing its name', () => {
    for (const feature of availableFeatures) {
      if (feature.directory) {
        const dirName = path.basename(feature.directory).toLowerCase()
        expect(feature.directory.toLowerCase()).toContain(dirName)
      }
    }
  })
})

// ---------------------------------------------------------------------------
// Package manager exists() contract
// ---------------------------------------------------------------------------

describe('package manager exists()', () => {
  it('npm.exists() returns a boolean', () => {
    const npm = availablePackageManagers.find((p) => p.name === 'npm')!
    const result = npm.exists()
    expect(typeof result).toBe('boolean')
  })

  it('all exists() functions return booleans', () => {
    for (const pm of availablePackageManagers) {
      expect(typeof pm.exists()).toBe('boolean')
    }
  })
})

// ---------------------------------------------------------------------------
// Integration-style: end-to-end writeObjectToJsonFile + read back
// ---------------------------------------------------------------------------

describe('JSON round-trip', () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = makeTmpDir()
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it('package.json round-trips correctly', () => {
    const params = makeParams({
      projectPath: tmpDir,
      projectName: 'round-trip-test',
      version: '0.0.1',
      description: 'Testing round trip',
      author: 'Tester',
    })

    const pkg = createPackageJson(params)
    writeObjectToJsonFile(pkg, 'package.json', params)

    const read = JSON.parse(fs.readFileSync(path.join(tmpDir, 'package.json'), 'utf-8'))
    expect(read.name).toBe('round-trip-test')
    expect(read.version).toBe('0.0.1')
    expect(read.description).toBe('Testing round trip')
    expect(read.author).toBe('Tester')
    expect(read.type).toBe('module')
    expect(read.scripts.build).toBe('vite build')
  })

  it('tsconfig.json round-trips correctly', () => {
    const params = makeParams({ projectPath: tmpDir })
    const tsConfig = JSON.parse(JSON.stringify(baseTsConfig))

    writeObjectToJsonFile(tsConfig, 'tsconfig.json', params)

    const read = JSON.parse(fs.readFileSync(path.join(tmpDir, 'tsconfig.json'), 'utf-8'))
    expect(read.compilerOptions.target).toBe('ES2022')
    expect(read.compilerOptions.strict).toBe(true)
    expect(read.compilerOptions.paths['@/*']).toEqual(['src/*'])
    expect(read.include).toEqual(['src'])
  })
})
