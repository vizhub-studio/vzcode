import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const repoRoot = process.cwd();

const readJson = (path: string) =>
  JSON.parse(readFileSync(join(repoRoot, path), 'utf8'));

describe('declared dependencies', () => {
  const pkg = readJson('package.json');
  const dependencies = pkg.dependencies ?? {};

  it('declares openai directly because the server imports it', () => {
    const source = readFileSync(
      join(
        repoRoot,
        'src/llm-streaming-server/llmStreaming.ts',
      ),
      'utf8',
    );
    expect(source).toMatch(/from ['"]openai['"]/);
    expect(dependencies.openai).toBeDefined();
    expect(dependencies.openai).toMatch(/^[\^~]?\d+\./);
  });

  it('resolves the declared openai range in the lockfile', () => {
    const lock = readJson('package-lock.json');
    const rootDeps =
      lock.packages?.['']?.dependencies ?? {};
    expect(rootDeps.openai).toBe(dependencies.openai);
    expect(
      lock.packages?.['node_modules/openai']?.version,
    ).toBeTruthy();
  });

  it('does not depend on the npm package as a runtime dependency', () => {
    expect(dependencies.npm).toBeUndefined();
  });
});
