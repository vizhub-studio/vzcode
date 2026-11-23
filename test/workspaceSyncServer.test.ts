import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
} from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import WebSocket from 'ws';
import ShareDBClient from 'sharedb/lib/client/index.js';
import { diff, json1Presence } from '../src/ot.js';
import {
  createVZCodeServer,
  type VZCodeServer,
} from '../src/server/createServer.js';

ShareDBClient.types.register(json1Presence.type);

const waitFor = async (
  predicate: () => boolean,
  timeoutMS = 6000,
) => {
  const deadline = Date.now() + timeoutMS;
  while (!predicate()) {
    if (Date.now() >= deadline) {
      throw new Error('Timed out waiting for filesystem synchronization');
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
};

describe('standalone filesystem synchronization', () => {
  let root: string;
  let server: VZCodeServer;
  let client: any;
  let doc: any;
  let port: number;

  const filePath = (name: string) => path.join(root, name);
  const read = (name: string) =>
    fs.readFileSync(filePath(name), 'utf8');
  const idByName = (name: string): string | undefined =>
    Object.keys(doc.data.files).find(
      (id) => doc.data.files[id].name === name,
    );
  const serverId = (name: string): string | undefined =>
    Object.keys(server.shareDBDoc.data.files).find(
      (id) => server.shareDBDoc.data.files[id].name === name,
    );

  const start = async (opts: {
    autoSave?: boolean;
    watchFiles?: boolean;
    scanIntervalMS?: number;
  } = {}) => {
    server = createVZCodeServer({
      cwd: root,
      autoSave: opts.autoSave ?? false,
      watchFiles: opts.watchFiles ?? false,
      scanIntervalMS: opts.scanIntervalMS,
      serveStaticDir: null,
    });
    await server.ready;
    port = await server.listen(0, '127.0.0.1');
    const ws = new WebSocket(
      'ws://127.0.0.1:' + port + '/ws',
      {
        headers: {
          Authorization: 'Bearer ' + server.accessToken,
        },
      },
    );
    client = new ShareDBClient.Connection(ws);
    doc = client.get('documents', '1');
    await new Promise<void>((resolve, reject) =>
      doc.subscribe((error: Error | null) =>
        error ? reject(error) : resolve(),
      ),
    );
  };

  const edit = async (
    mutate: (files: Record<string, any>) => Record<string, any>,
  ) => {
    const before = doc.data;
    const next = {
      ...before,
      files: mutate({ ...before.files }),
    };
    await new Promise<void>((resolve, reject) =>
      doc.submitOp(diff(before, next), (error: Error | null) =>
        error ? reject(error) : resolve(),
      ),
    );
  };

  beforeEach(() => {
    root = fs.mkdtempSync(
      path.join(os.tmpdir(), 'vzcode-filesystem-sync-'),
    );
    fs.writeFileSync(filePath('index.js'), 'original');
    fs.writeFileSync(filePath('other.css'), 'css');
    fs.mkdirSync(filePath('src'));
    fs.writeFileSync(filePath('src/nested.js'), 'nested');
  });

  afterEach(async () => {
    client?.close();
    if (server) await server.close();
    fs.rmSync(root, { recursive: true, force: true });
    client = undefined;
    server = undefined!;
  });

  it('imports external changes to both ShareDB clients and keeps IDs stable', async () => {
    await start();
    const id = idByName('index.js');
    fs.writeFileSync(filePath('index.js'), 'external');
    await server.syncFromDisk();
    await waitFor(() => doc.data.files[id!]?.text === 'external');
    expect(idByName('index.js')).toBe(id);
    expect(read('index.js')).toBe('external');
    server.save();
    expect(read('index.js')).toBe('external');
  });

  it('discovers nested additions and external deletions', async () => {
    await start();
    const original = idByName('src/nested.js');
    fs.mkdirSync(filePath('src/deep'));
    fs.writeFileSync(filePath('src/deep/new.ts'), 'new');
    await server.syncFromDisk();
    await waitFor(() => !!idByName('src/deep/new.ts'));
    expect(idByName('src/nested.js')).toBe(original);
    expect(idByName('src/deep/')).toBeDefined();

    fs.rmSync(filePath('src/deep'), { recursive: true });
    await server.syncFromDisk();
    await waitFor(() => !idByName('src/deep/new.ts'));
    expect(idByName('src/deep/')).toBeUndefined();
    expect(idByName('src/nested.js')).toBe(original);
  });

  it('preserves file and folder IDs on an external rename', async () => {
    await start();
    const oldId = idByName('src/nested.js');
    const folderId = idByName('src/');
    fs.renameSync(filePath('src'), filePath('moved'));
    await server.syncFromDisk();
    await waitFor(() => !!idByName('moved/nested.js'));
    expect(idByName('moved/nested.js')).toBe(oldId);
    expect(idByName('moved/')).toBe(folderId);
    expect(serverId('src/nested.js')).toBeUndefined();
  });

  it('imports a binary image as base64 without rewriting the image', async () => {
    await start();
    const bytes = Buffer.from([0, 1, 2, 255]);
    fs.writeFileSync(filePath('pixel.png'), bytes);
    await server.syncFromDisk();
    await waitFor(() => !!idByName('pixel.png'));
    expect(
      doc.data.files[idByName('pixel.png')!].text,
    ).toBe(bytes.toString('base64'));
    server.save();
    expect(fs.readFileSync(filePath('pixel.png'))).toEqual(bytes);
  });

  it('does not follow symlinks or import ignored directories', async () => {
    await start();
    const outside = fs.mkdtempSync(
      path.join(os.tmpdir(), 'vzcode-sync-outside-'),
    );
    try {
      fs.writeFileSync(path.join(outside, 'secret.js'), 'secret');
      fs.symlinkSync(
        path.join(outside, 'secret.js'),
        filePath('secret-link.js'),
      );
      fs.mkdirSync(filePath('node_modules'));
      fs.writeFileSync(filePath('node_modules/hidden.js'), 'hidden');
      await server.syncFromDisk();
      expect(idByName('secret-link.js')).toBeUndefined();
      expect(idByName('node_modules/hidden.js')).toBeUndefined();
    } finally {
      fs.rmSync(outside, { recursive: true, force: true });
    }
  });

  it('detects a conflict before any stale editor write can overwrite disk', async () => {
    await start();
    const id = idByName('index.js')!;
    await edit((files) => ({
      ...files,
      [id]: { ...files[id], text: 'editor' },
    }));
    fs.writeFileSync(filePath('index.js'), 'external');
    expect(() => server.save()).toThrow(/External filesystem change/);
    await server.syncFromDisk();
    await waitFor(
      () => (doc.data.workspaceConflicts || []).includes('index.js'),
    );
    expect(read('index.js')).toBe('external');
    expect(doc.data.files[id].text).toBe('editor');
    expect(() => server.save()).toThrow(/conflicts/);
  });

  it('allows explicit disk-wins conflict resolution', async () => {
    await start();
    const id = idByName('index.js')!;
    await edit((files) => ({
      ...files,
      [id]: { ...files[id], text: 'editor' },
    }));
    fs.writeFileSync(filePath('index.js'), 'external');
    await server.syncFromDisk();
    await server.resolveConflict('index.js', 'disk');
    await waitFor(() => doc.data.files[id].text === 'external');
    await waitFor(() => (doc.data.workspaceConflicts || []).length === 0);
    expect(doc.data.workspaceConflicts).toEqual([]);
    server.save();
    expect(read('index.js')).toBe('external');
  });

  it('allows explicit editor-wins conflict resolution', async () => {
    await start();
    const id = idByName('index.js')!;
    await edit((files) => ({
      ...files,
      [id]: { ...files[id], text: 'editor' },
    }));
    fs.writeFileSync(filePath('index.js'), 'external');
    await server.syncFromDisk();
    await server.resolveConflict('index.js', 'editor');
    expect(doc.data.workspaceConflicts).toEqual([]);
    server.save();
    expect(read('index.js')).toBe('editor');
  });

  it('preserves unrelated pending edits during an external modification', async () => {
    await start();
    const id = idByName('index.js')!;
    const other = idByName('other.css')!;
    await edit((files) => ({
      ...files,
      [id]: { ...files[id], text: 'editor' },
    }));
    fs.writeFileSync(filePath('other.css'), 'external css');
    expect(() => server.save()).toThrow(/External filesystem change/);
    await server.syncFromDisk();
    await waitFor(
      () => doc.data.files[other].text === 'external css',
    );
    expect(doc.data.files[id].text).toBe('editor');
    expect(doc.data.workspaceConflicts).toEqual([]);
    server.save();
    expect(read('index.js')).toBe('editor');
    expect(read('other.css')).toBe('external css');
  });

  it('persists local rename plus text edit to the destination path', async () => {
    await start();
    const id = idByName('index.js')!;
    await edit((files) => ({
      ...files,
      [id]: { name: 'src/renamed.js', text: 'new content' },
    }));
    server.save();
    expect(fs.existsSync(filePath('index.js'))).toBe(false);
    expect(read('src/renamed.js')).toBe('new content');
    await server.syncFromDisk();
    expect(idByName('src/renamed.js')).toBe(id);
  });

  it('blocks external deletion when an unsaved editor edit exists', async () => {
    await start();
    const id = idByName('index.js')!;
    await edit((files) => ({
      ...files,
      [id]: { ...files[id], text: 'editor' },
    }));
    fs.unlinkSync(filePath('index.js'));
    await server.syncFromDisk();
    await waitFor(() => (doc.data.workspaceConflicts || []).includes('index.js'));
    expect(doc.data.files[id].text).toBe('editor');
    expect(doc.data.workspaceConflicts).toContain('index.js');
    await server.resolveConflict('index.js', 'editor');
    server.save();
    expect(read('index.js')).toBe('editor');
  });

  it('resolves an external deletion with the disk version', async () => {
    await start();
    const id = idByName('index.js')!;
    await edit((files) => ({
      ...files,
      [id]: { ...files[id], text: 'editor' },
    }));
    fs.unlinkSync(filePath('index.js'));
    await server.syncFromDisk();
    await server.resolveConflict('index.js', 'disk');
    await waitFor(() => !doc.data.files[id]);
    expect(fs.existsSync(filePath('index.js'))).toBe(false);
    server.save();
  });

  it('exposes conflict resolution only to authenticated callers', async () => {
    await start();
    const response = await fetch(
      'http://127.0.0.1:' + port + '/workspace-conflicts/resolve',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'index.js',
          choice: 'disk',
        }),
      },
    );
    expect(response.status).toBe(401);
  });

  it('resolves a conflict through the authenticated HTTP endpoint', async () => {
    await start();
    const id = idByName('index.js')!;
    await edit((files) => ({
      ...files,
      [id]: { ...files[id], text: 'editor' },
    }));
    fs.writeFileSync(filePath('index.js'), 'from another editor');
    await server.syncFromDisk();

    const unauthorized = await fetch(
      'http://127.0.0.1:' + port + '/workspace-conflicts/resolve',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'index.js', choice: 'disk' }),
      },
    );
    expect(unauthorized.status).toBe(401);

    const invalid = await fetch(
      'http://127.0.0.1:' + port + '/workspace-conflicts/resolve',
      {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + server.accessToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: 'index.js', choice: 'invalid' }),
      },
    );
    expect(invalid.status).toBe(400);

    const authorized = await fetch(
      'http://127.0.0.1:' + port + '/workspace-conflicts/resolve',
      {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + server.accessToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: 'index.js', choice: 'disk' }),
      },
    );
    expect(authorized.status).toBe(204);
    await waitFor(
      () => doc.data.files[id].text === 'from another editor',
    );
    expect(doc.data.workspaceConflicts).toEqual([]);
    expect(read('index.js')).toBe('from another editor');
  });

  it('handles multiple conflicts without unblocking premature saves', async () => {
    await start();
    const indexId = idByName('index.js')!;
    const cssId = idByName('other.css')!;
    await edit((files) => ({
      ...files,
      [indexId]: { ...files[indexId], text: 'editor JS' },
      [cssId]: { ...files[cssId], text: 'editor CSS' },
    }));
    fs.writeFileSync(filePath('index.js'), 'disk JS');
    fs.writeFileSync(filePath('other.css'), 'disk CSS');
    await server.syncFromDisk();
    await waitFor(() => (doc.data.workspaceConflicts || []).length === 2);
    expect(doc.data.workspaceConflicts).toEqual([
      'index.js',
      'other.css',
    ]);

    await server.resolveConflict('index.js', 'editor');
    expect(() => server.save()).toThrow(/conflicts/);
    expect(read('index.js')).toBe('disk JS');
    await server.resolveConflict('other.css', 'disk');
    server.save();
    expect(read('index.js')).toBe('editor JS');
    expect(read('other.css')).toBe('disk CSS');
  });

  it('periodically detects changes in nested directories', async () => {
    await start({ watchFiles: true, scanIntervalMS: 80 });
    fs.writeFileSync(filePath('src/nested.js'), 'from disk');
    const id = idByName('src/nested.js')!;
    await waitFor(() => doc.data.files[id]?.text === 'from disk');
    expect(read('src/nested.js')).toBe('from disk');
  });

  it('autosaves through the normal ShareDB path without echo loops', async () => {
    await start({
      autoSave: true,
      watchFiles: true,
      scanIntervalMS: 100,
    });
    const id = idByName('index.js')!;
    await edit((files) => ({
      ...files,
      [id]: { ...files[id], text: 'editor saved' },
    }));
    await waitFor(() => read('index.js') === 'editor saved');
    await server.syncFromDisk();
    await new Promise((resolve) => setTimeout(resolve, 350));
    expect(read('index.js')).toBe('editor saved');
    expect(doc.data.files[id].text).toBe('editor saved');
    expect(doc.data.workspaceConflicts).toEqual([]);
  });
});
