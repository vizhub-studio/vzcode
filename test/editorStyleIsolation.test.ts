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

  it('preserves VizHub legacy color values and fonts without global CSS', () => {
    const source = read('src/client/ui.scss');
    // Original values from vizhub-ui/scss/_variables.scss.
    const tokens: Record<string, string> = {
      neutral_01: '#1f2022',
      neutral_02: '#202e46',
      neutral_03: '#576786',
      neutral_04: '#bdc7dc',
      action_01: '#3866e9',
      action_02: '#022a9f',
      action_03: '#e0e8ff',
      warning_01: '#eb1c69',
      caution_01: '#ffa800',
      success_01: '#36bb4a',
    };
    for (const [name, hex] of Object.entries(tokens)) {
      expect(source).toContain(
        `--vz-color-${name.replace('_', '-')}: ${hex};`,
      );
    }
    expect(source).toContain(
      '--vz-font-body: Inter, sans-serif',
    );
    expect(source).toContain(
      '--vz-font-heading: Poppins, sans-serif',
    );
    expect(read('src/client/App/style.scss')).toContain(
      "'Roboto Mono'",
    );
    expect(source).not.toMatch(/:root\s*\{/);
    expect(source).not.toMatch(/^\s*(?:html|body)\s*\{/m);
    expect(source).toContain('.vz-ui-modal');
    // Embedded host (VizHub Cloud) does not render the standalone .app.
    expect(source).toContain('.vz-sidebar');
  });

  it('keeps sidebar actions compact, legible and keyboard accessible', () => {
    const css = read('src/client/VZSidebar/styles.scss');
    const component = read(
      'src/client/VZSidebar/index.tsx',
    );
    expect(css).toContain('min-height: 38px');
    expect(css).toContain('justify-content: flex-start');
    expect(css).toContain('gap: 10px');
    expect(css).toContain('&:focus-visible');
    expect(css).toContain('&.delete-all-button');
    expect(css).not.toContain('opacity: 0.7');
    expect(component).toContain('Delete all files');
    expect(component).toContain(
      'onClick={handleDeleteAllClick}',
    );
  });

  it('contains no Bootstrap-era component or utility class references', () => {
    const offenders = walk('src/client')
      .concat(walk('src/llm-streaming-ui'))
      .filter((path) => /\.(tsx?|jsx?|s?css)$/.test(path))
      .flatMap((path) => {
        const lines = read(path).split('\n');
        return lines.flatMap((line, i) =>
          /\b(?:mb-3|pt-1|text-muted|form-control|form-label|form-select|btn-primary|btn-secondary|btn-group|user-select-none|icon-button-dark)\b/.test(
            line,
          )
            ? [`${path}:${i + 1}: ${line.trim()}`]
            : [],
        );
      });
    expect(offenders).toEqual([]);
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
