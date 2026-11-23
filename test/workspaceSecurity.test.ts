import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  createWorkspacePathResolver,
  UnsafeWorkspacePathError,
} from '../src/server/workspaceSecurity.js';
import { computeInitialDocument } from '../src/server/computeInitialDocument.js';

describe('workspace path confinement', () => {
  const withWorkspace = (
    test: (root: string, outside: string) => void,
  ) => {
    const temp = fs.mkdtempSync(
      path.join(os.tmpdir(), 'vzcode-path-security-'),
    );
    const root = path.join(temp, 'workspace');
    const outside = path.join(temp, 'outside');
    fs.mkdirSync(root);
    fs.mkdirSync(outside);
    try {
      test(root, outside);
    } finally {
      fs.rmSync(temp, { recursive: true, force: true });
    }
  };

  it('rejects parent traversal, absolute, Windows and malformed paths', () =>
    withWorkspace((root) => {
      const workspace = createWorkspacePathResolver(root);
      for (const name of [
        '../outside/file.js',
        'a/../../outside/file.js',
        '/etc/passwd',
        'C:\\Windows\\system.ini',
        'C:/Windows/system.ini',
        '..\\outside\\file.js',
        'a//file.js',
        './file.js',
        'a/../file.js',
        'a/./file.js',
        'a/\0file.js',
        '',
      ]) {
        expect(() => workspace.resolve(name)).toThrow(
          UnsafeWorkspacePathError,
        );
      }
      expect(workspace.resolve('nested/file.js')).toBe(
        path.join(root, 'nested', 'file.js'),
      );
    }));

  it('rejects symlink files and symlink parent directories', () =>
    withWorkspace((root, outside) => {
      fs.writeFileSync(
        path.join(outside, 'secret.txt'),
        'secret',
      );
      fs.symlinkSync(
        path.join(outside, 'secret.txt'),
        path.join(root, 'leak.txt'),
      );
      fs.symlinkSync(
        outside,
        path.join(root, 'linkdir'),
        'dir',
      );
      const workspace = createWorkspacePathResolver(root);
      expect(() => workspace.resolve('leak.txt')).toThrow(
        UnsafeWorkspacePathError,
      );
      expect(() =>
        workspace.resolve('linkdir/created.txt'),
      ).toThrow(UnsafeWorkspacePathError);
      expect(
        fs.readFileSync(
          path.join(outside, 'secret.txt'),
          'utf8',
        ),
      ).toBe('secret');
    }));

  it('does not load symlinks into the initial ShareDB document', () =>
    withWorkspace((root, outside) => {
      fs.writeFileSync(path.join(root, 'good.js'), 'good');
      fs.writeFileSync(
        path.join(outside, 'secret.js'),
        'secret',
      );
      fs.symlinkSync(
        path.join(outside, 'secret.js'),
        path.join(root, 'linked.js'),
      );
      fs.symlinkSync(
        outside,
        path.join(root, 'linked-dir'),
        'dir',
      );
      const doc = computeInitialDocument({
        fullPath: root,
      });
      const names = Object.values(doc.files).map(
        (file: any) => file.name,
      );
      expect(names).toContain('good.js');
      expect(names).not.toContain('linked.js');
      expect(names).not.toContain('linked-dir/');
    }));

  it('rejects corrupt file entry shapes and duplicate names', () =>
    withWorkspace((root) => {
      const { validateFiles } =
        createWorkspacePathResolver(root);
      expect(() =>
        validateFiles({
          a: { name: 'valid.js', text: 'ok' },
          b: { name: 'valid.js', text: 'different' },
        }),
      ).toThrow(UnsafeWorkspacePathError);
      expect(() =>
        validateFiles({
          a: { name: 'folder/', text: 'bad' },
        }),
      ).toThrow(UnsafeWorkspacePathError);
      expect(() =>
        validateFiles({
          a: { name: '../escape.js', text: 'bad' },
        }),
      ).toThrow(UnsafeWorkspacePathError);
      expect(() =>
        validateFiles({
          a: { name: 'folder/', text: null },
          b: { name: 'folder/valid.js', text: 'ok' },
        }),
      ).not.toThrow();
    }));
});
