import { describe, it, expect } from 'vitest';
import {
  readFileSync,
  readdirSync,
  statSync,
} from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { builtinModules } from 'node:module';

const repoRoot = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
);
const srcRoot = join(repoRoot, 'src');
const packageJson = JSON.parse(
  readFileSync(join(repoRoot, 'package.json'), 'utf8'),
);

const declared = new Set<string>([
  ...Object.keys(packageJson.dependencies ?? {}),
  ...Object.keys(packageJson.devDependencies ?? {}),
  ...Object.keys(packageJson.optionalDependencies ?? {}),
  ...Object.keys(packageJson.peerDependencies ?? {}),
]);

const builtins = new Set<string>([
  ...builtinModules,
  ...builtinModules.map((name) => `node:${name}`),
]);

const walk = (dir: string): string[] => {
  const entries: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      entries.push(...walk(full));
    } else if (
      full.endsWith('.ts') ||
      full.endsWith('.tsx')
    ) {
      entries.push(full);
    }
  }
  return entries;
};

// Extract bare package specifiers from static and dynamic imports.
const importPatterns = [
  /^\s*import\s+[^'"]*?from\s*['"]([^'"]+)['"]/gm,
  /^\s*import\s*['"]([^'"]+)['"]/gm,
  /^\s*export\s+[^'"]*?from\s*['"]([^'"]+)['"]/gm,
  /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
];

const packageOf = (specifier: string): string | null => {
  if (
    specifier.startsWith('.') ||
    specifier.startsWith('/') ||
    specifier.startsWith('#')
  ) {
    return null;
  }
  if (specifier.startsWith('node:')) return specifier;
  const segments = specifier.split('/');
  return specifier.startsWith('@')
    ? `${segments[0]}/${segments[1]}`
    : segments[0];
};

describe('declared dependencies', () => {
  it('every bare import in src is declared in package.json', () => {
    const violations: string[] = [];

    for (const file of walk(srcRoot)) {
      const source = readFileSync(file, 'utf8');
      for (const pattern of importPatterns) {
        for (const match of source.matchAll(pattern)) {
          const specifier = match[1];
          const pkg = packageOf(specifier);
          if (!pkg) continue;
          if (builtins.has(pkg)) continue;
          if (declared.has(pkg)) continue;
          violations.push(
            `${relative(repoRoot, file)}: '${specifier}' (${pkg})`,
          );
        }
      }
    }

    expect(violations).toEqual([]);
  });
});
