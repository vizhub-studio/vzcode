import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  diskMatchesBaseline,
  readWorkspaceDisk,
  reconcileDisk,
  type DiskFile,
  type WorkspaceFiles,
} from '../src/server/workspaceSync.js';

const file = (name: string, text: string | null) => ({
  name,
  text,
});
const disk = (...files: DiskFile[]) =>
  new Map(files.map((item) => [item.name, item]));
const reconcile = (
  baseline: WorkspaceFiles,
  current: WorkspaceFiles,
  observed: DiskFile[],
  identities: Record<string, string | undefined> = {},
) => {
  let counter = 0;
  return reconcileDisk({
    baseline,
    current,
    disk: disk(...observed),
    identities,
    makeId: () => 'new' + ++counter,
  });
};

describe('three-way filesystem reconciliation', () => {
  it('does not modify an unchanged workspace', () => {
    const baseline = { a: file('index.js', 'one') };
    const result = reconcile(baseline, baseline, [
      { ...baseline.a, identity: '1:10' },
    ]);
    expect(result.changed).toBe(false);
    expect(result.files).toEqual(baseline);
    expect(result.conflicts).toEqual([]);
    expect(result.identities.a).toBe('1:10');
  });

  it('imports an external text edit without replacing the file ID', () => {
    const baseline = { a: file('index.js', 'one') };
    const result = reconcile(baseline, baseline, [
      file('index.js', 'two'),
    ]);
    expect(result.files.a.text).toBe('two');
    expect(result.baseline.a.text).toBe('two');
    expect(result.conflicts).toEqual([]);
  });

  it('preserves a pending local edit when disk has not changed', () => {
    const baseline = { a: file('index.js', 'one') };
    const current = { a: file('index.js', 'editor') };
    const result = reconcile(baseline, current, [
      file('index.js', 'one'),
    ]);
    expect(result.files.a.text).toBe('editor');
    expect(result.baseline.a.text).toBe('one');
    expect(result.conflicts).toEqual([]);
  });

  it('reports simultaneous changes without losing either version', () => {
    const baseline = { a: file('index.js', 'one') };
    const result = reconcile(
      baseline,
      { a: file('index.js', 'editor') },
      [file('index.js', 'disk')],
    );
    expect(result.files.a.text).toBe('editor');
    expect(result.baseline.a.text).toBe('one');
    expect(result.conflicts).toEqual(['index.js']);
  });

  it('treats matching local/disk edits as convergent', () => {
    const baseline = { a: file('index.js', 'one') };
    const result = reconcile(
      baseline,
      { a: file('index.js', 'same') },
      [file('index.js', 'same')],
    );
    expect(result.conflicts).toEqual([]);
    expect(result.baseline.a.text).toBe('same');
  });

  it('removes an externally deleted file when unchanged in editor', () => {
    const baseline = {
      a: file('index.js', 'one'),
      b: file('styles.css', 'blue'),
    };
    const result = reconcile(baseline, baseline, [
      file('index.js', 'one'),
    ]);
    expect(result.files.b).toBeUndefined();
    expect(result.baseline.b).toBeUndefined();
  });

  it('conflicts on external deletion when editor changed the file', () => {
    const baseline = { a: file('index.js', 'one') };
    const result = reconcile(
      baseline,
      { a: file('index.js', 'editor') },
      [],
    );
    expect(result.files.a.text).toBe('editor');
    expect(result.conflicts).toEqual(['index.js']);
  });

  it('conflicts on local deletion and external modification', () => {
    const baseline = { a: file('index.js', 'one') };
    const result = reconcile(baseline, {}, [
      file('index.js', 'disk'),
    ]);
    expect(result.files.a).toBeUndefined();
    expect(result.baseline.a.text).toBe('one');
    expect(result.conflicts).toEqual(['index.js']);
  });

  it('imports external creation with a new stable file ID', () => {
    const baseline = { a: file('index.js', 'one') };
    const result = reconcile(baseline, baseline, [
      file('index.js', 'one'),
      file('lib/helper.js', 'created'),
    ]);
    expect(result.files.new1).toEqual(
      file('lib/helper.js', 'created'),
    );
    expect(result.baseline.new1).toEqual(result.files.new1);
    expect(result.conflicts).toEqual([]);
  });

  it('handles external directory creation including empty folders', () => {
    const result = reconcile({}, {}, [
      file('src/', null),
      file('src/code.ts', 'code'),
      file('empty/', null),
    ]);
    expect(
      Object.values(result.files)
        .map((x) => x.name)
        .sort(),
    ).toEqual(['empty/', 'src/', 'src/code.ts']);
    expect(result.conflicts).toEqual([]);
  });

  it('does not silently replace a simultaneously created editor file', () => {
    const result = reconcile(
      {},
      { local: file('new.js', 'editor') },
      [file('new.js', 'disk')],
    );
    expect(result.files.local.text).toBe('editor');
    expect(result.conflicts).toEqual(['new.js']);
  });

  it('accepts identical editor/disk creations', () => {
    const result = reconcile(
      {},
      { local: file('new.js', 'same') },
      [file('new.js', 'same')],
    );
    expect(result.files.local.text).toBe('same');
    expect(result.baseline.local.text).toBe('same');
    expect(result.conflicts).toEqual([]);
  });

  it('recognizes a file rename by filesystem identity', () => {
    const baseline = { a: file('old.js', 'hello') };
    const result = reconcile(
      baseline,
      baseline,
      [{ name: 'new.js', text: 'hello', identity: '1:42' }],
      { a: '1:42' },
    );
    expect(result.files.a.name).toBe('new.js');
    expect(result.baseline.a.name).toBe('new.js');
    expect(result.files.new1).toBeUndefined();
  });

  it('recognizes an external directory move without replacing child IDs', () => {
    const baseline = {
      parent: file('old/', null),
      child: file('old/child.js', 'hello'),
    };
    const result = reconcile(
      baseline,
      baseline,
      [
        { name: 'new/', text: null, identity: '1:1' },
        {
          name: 'new/child.js',
          text: 'hello',
          identity: '1:2',
        },
      ],
      { parent: '1:1', child: '1:2' },
    );
    expect(result.files.parent.name).toBe('new/');
    expect(result.files.child.name).toBe('new/child.js');
    expect(result.conflicts).toEqual([]);
  });

  it('refuses ambiguous identity matches instead of guessing renames', () => {
    const baseline = { a: file('old.js', 'one') };
    const result = reconcile(
      baseline,
      baseline,
      [
        { name: 'first.js', text: 'one', identity: '1:42' },
        {
          name: 'second.js',
          text: 'one',
          identity: '1:42',
        },
      ],
      { a: '1:42' },
    );
    expect(result.files.a).toBeUndefined();
    expect(Object.values(result.files)).toHaveLength(2);
  });

  it('detects an unchanged directory snapshot and binary file', () => {
    const baseline = {
      folder: file('data/', null),
      image: file('data/pixel.png', 'AAAA'),
    };
    expect(
      diskMatchesBaseline(
        baseline,
        disk(
          file('data/', null),
          file('data/pixel.png', 'AAAA'),
        ),
      ),
    ).toBe(true);
    expect(
      diskMatchesBaseline(
        baseline,
        disk(
          file('data/', null),
          file('data/pixel.png', 'AAAB'),
        ),
      ),
    ).toBe(false);
  });

  it('reconciles only files in the configured ignore-aware workspace scan', () => {
    const root = fs.mkdtempSync(
      path.join(os.tmpdir(), 'vzcode-scan-test-'),
    );
    try {
      fs.mkdirSync(path.join(root, 'sub'));
      fs.mkdirSync(path.join(root, 'node_modules'));
      fs.writeFileSync(
        path.join(root, 'sub', 'index.js'),
        'hello',
      );
      fs.writeFileSync(
        path.join(root, 'node_modules', 'hidden.js'),
        'no',
      );
      fs.writeFileSync(
        path.join(root, 'sub', 'pixel.png'),
        Buffer.from([0, 1, 2, 255]),
      );
      const scanned = readWorkspaceDisk(root);
      expect(scanned.get('sub/index.js')?.text).toBe(
        'hello',
      );
      expect(scanned.get('sub/pixel.png')?.text).toBe(
        'AAEC/w==',
      );
      expect(scanned.has('node_modules/hidden.js')).toBe(
        false,
      );
      expect(scanned.has('sub/')).toBe(true);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
