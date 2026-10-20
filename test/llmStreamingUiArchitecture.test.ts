import { describe, expect, it } from 'vitest';
import {
  readdirSync,
  readFileSync,
  statSync,
} from 'node:fs';
import { join, relative } from 'node:path';

const repoRoot = process.cwd();
const libRoot = join(repoRoot, 'src/llm-streaming-ui');

const collectSourceFiles = (dir: string): string[] => {
  const entries = readdirSync(dir);
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = join(dir, entry);
    if (statSync(fullPath).isDirectory()) {
      files.push(...collectSourceFiles(fullPath));
    } else if (/\.(ts|tsx)$/.test(entry)) {
      files.push(fullPath);
    }
  }
  return files;
};

describe('llm-streaming-ui independence', () => {
  const sourceFiles = collectSourceFiles(libRoot);

  it('contains source files to check', () => {
    expect(sourceFiles.length).toBeGreaterThan(0);
  });

  it('does not import application code from src/client', () => {
    const offenders: string[] = [];
    // Match `from '../../client/...'` and `from '<anything>/client/...'`.
    const pattern = /from\s+['"][^'"]*\/client\//;
    for (const file of sourceFiles) {
      const source = readFileSync(file, 'utf8');
      const lines = source.split('\n');
      lines.forEach((line, index) => {
        if (pattern.test(line)) {
          offenders.push(
            `${relative(repoRoot, file)}:${index + 1}: ${line.trim()}`,
          );
        }
      });
    }
    expect(offenders).toEqual([]);
  });

  it('does not import VZCodeContext', () => {
    const offenders = sourceFiles.filter((file) =>
      readFileSync(file, 'utf8').includes('VZCodeContext'),
    );
    expect(
      offenders.map((f) => relative(repoRoot, f)),
    ).toEqual([]);
  });

  it('exposes its public API and hooks through the barrel', () => {
    const barrel = readFileSync(
      join(libRoot, 'index.ts'),
      'utf8',
    );
    expect(barrel).toContain('./components/index.js');
    expect(barrel).toContain('./hooks/useAutoScroll.js');
    expect(barrel).toContain("from './props.js'");
  });
});

describe('llm-streaming-ui local support modules', () => {
  it('bundles its own spinner, icons, and bootstrap wrappers', () => {
    const components = join(libRoot, 'components');
    const names = readdirSync(components);
    expect(names).toContain('Spinner.tsx');
    expect(names).toContain('icons.tsx');
    expect(names).toContain('bootstrap.ts');
  });

  it('ships the relocated auto-scroll hook and scroll utils', () => {
    expect(() =>
      statSync(join(libRoot, 'hooks/useAutoScroll.ts')),
    ).not.toThrow();
    expect(() =>
      statSync(join(libRoot, 'utils/scrollUtils.ts')),
    ).not.toThrow();
  });
});
