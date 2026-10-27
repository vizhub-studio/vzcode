import { describe, it, expect } from 'vitest';
import {
  readFileSync,
  readdirSync,
  statSync,
} from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const read = (file: string) =>
  readFileSync(join(root, file), 'utf8');
const walk = (folder: string): string[] =>
  readdirSync(join(root, folder)).flatMap((name) => {
    const path = folder + '/' + name;
    return statSync(join(root, path)).isDirectory()
      ? walk(path)
      : [path];
  });

describe('framework-independent VZCode styles', () => {
  it('does not import Bootstrap, Bootstrap icons, or vizhub-ui', () => {
    const offenders = walk('src')
      .filter((path) => /\.(tsx?|jsx?|s?css)$/.test(path))
      .filter((path) =>
        /(?:react-bootstrap|bootstrap-icons|vizhub-ui\/dist|--vh-|--bs-|vh-spinner|user-select-none)/.test(
          read(path),
        ),
      );
    expect(offenders).toEqual([]);
  });

  it('does not depend on the retired packages', () => {
    const deps = JSON.parse(
      read('package.json'),
    ).dependencies;
    for (const name of [
      'react-bootstrap',
      'bootstrap-icons',
      'vizhub-ui',
    ]) {
      expect(deps).not.toHaveProperty(name);
    }
  });

  it('limits the layout and custom properties to the editor root', () => {
    const css = read('src/client/App/style.scss');
    expect(css).not.toMatch(/:root\s*\{/);
    expect(css).not.toMatch(/html,\s*body,\s*#root/);
    expect(css).toContain('.app');
    expect(read('src/client/VZSettings.tsx')).not.toContain(
      'document.body.style.setProperty',
    );
  });
});
