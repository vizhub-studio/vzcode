import fs from 'node:fs';
import path from 'node:path';

export class UnsafeWorkspacePathError extends Error {
  constructor(name: string) {
    super('Unsafe workspace path: ' + name);
    this.name = 'UnsafeWorkspacePathError';
  }
}

export const createWorkspacePathResolver = (root: string) => {
  // A symlink in the initial workspace argument is acceptable; all names
  // are validated against the resolved real root thereafter.
  const realRoot = fs.realpathSync(root);

  const resolve = (name: string): string => {
    if (
      typeof name !== 'string' ||
      name.length === 0 ||
      name.includes('\0') ||
      name.includes('\\') ||
      path.posix.isAbsolute(name) ||
      path.win32.isAbsolute(name) ||
      /^[A-Za-z]:/.test(name)
    ) {
      throw new UnsafeWorkspacePathError(String(name));
    }

    const withoutTrailingSlash = name.endsWith('/')
      ? name.slice(0, -1)
      : name;
    const segments = withoutTrailingSlash.split('/');
    if (
      segments.length === 0 ||
      segments.some(
        (segment) =>
          !segment ||
          segment === '.' ||
          segment === '..' ||
          /[:\x00-\x1f]/.test(segment) ||
          (process.platform === 'win32' &&
            (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/i.test(
              segment,
            ) ||
              /[. ]$/.test(segment))),
      )
    ) {
      throw new UnsafeWorkspacePathError(name);
    }

    let current = realRoot;
    for (let index = 0; index < segments.length; index++) {
      current = path.join(current, segments[index]);
      // lstat does not follow symlinks. Reject a symlink in any
      // existing parent or the leaf before using filesystem APIs.
      try {
        const stat = fs.lstatSync(current);
        if (
          stat.isSymbolicLink() ||
          (index < segments.length - 1 &&
            !stat.isDirectory())
        ) {
          throw new UnsafeWorkspacePathError(name);
        }
      } catch (error: any) {
        if (error?.code !== 'ENOENT') throw error;
      }
    }
    return current;
  };

  const validateFiles = (files: unknown) => {
    if (!files || typeof files !== 'object' ||
        Array.isArray(files)) {
      throw new UnsafeWorkspacePathError('invalid file collection');
    }
    const names = new Set<string>();
    for (const [id, file] of Object.entries(files)) {
      if (['__proto__', 'prototype', 'constructor'].includes(id)) {
        throw new UnsafeWorkspacePathError('unsafe file identifier');
      }
      if (!file || typeof file !== 'object' ||
          Array.isArray(file)) {
        throw new UnsafeWorkspacePathError('invalid file entry');
      }
      const entry = file as { name?: unknown; text?: unknown };
      if (typeof entry.name !== 'string' ||
          (entry.text !== null && typeof entry.text !== 'string')) {
        throw new UnsafeWorkspacePathError('invalid file entry');
      }
      resolve(entry.name);
      if (
        (entry.name.endsWith('/') && entry.text !== null) ||
        (!entry.name.endsWith('/') && typeof entry.text !== 'string')
      ) {
        throw new UnsafeWorkspacePathError(entry.name);
      }
      const normalized = entry.name.replace(/\/$/, '');
      if (names.has(normalized)) {
        throw new UnsafeWorkspacePathError(entry.name);
      }
      names.add(normalized);
    }
  };

  // O_NOFOLLOW protects against replacing the leaf with a symlink
  // between validation and opening the file. Parent-directory swaps
  // still require OS-level sandboxing for race-free protection.
  const writeFile = (name: string, content: string | Buffer) => {
    const destination = resolve(name);
    const flags =
      fs.constants.O_WRONLY |
      fs.constants.O_CREAT |
      fs.constants.O_TRUNC |
      (fs.constants.O_NOFOLLOW ?? 0);
    const fd = fs.openSync(destination, flags, 0o666);
    try {
      fs.writeFileSync(fd, content);
    } finally {
      fs.closeSync(fd);
    }
  };

  return { root: realRoot, resolve, validateFiles, writeFile };
};
