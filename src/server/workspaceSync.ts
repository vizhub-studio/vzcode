import fs from 'node:fs';
import { computeInitialDocument } from './computeInitialDocument.js';
import { randomId } from '../randomId.js';
import { createWorkspacePathResolver } from './workspaceSecurity.js';

export type WorkspaceFile = {
  name: string;
  text: string | null;
};
export type WorkspaceFiles = Record<string, WorkspaceFile>;

export type DiskFile = WorkspaceFile & {
  /** Stable within a filesystem, used to recognize external renames. */
  identity?: string;
};
export type DiskFiles = Map<string, DiskFile>;

export const sameFile = (
  a: WorkspaceFile | undefined,
  b: WorkspaceFile | undefined,
): boolean =>
  (!a && !b) ||
  (!!a &&
    !!b &&
    a.name === b.name &&
    a.text === b.text);

export const copyFiles = (
  files: WorkspaceFiles,
): WorkspaceFiles =>
  Object.fromEntries(
    Object.entries(files).map(([id, file]) => [
      id,
      { name: file.name, text: file.text },
    ]),
  );

const diskFile = (entry: DiskFile): WorkspaceFile => ({
  name: entry.name,
  text: entry.text,
});

/**
 * Use the same ignore rules and symlink exclusions as initial startup.
 * The repeated scan is also a portable fallback for nested directories on
 * platforms without recursive fs.watch support.
 */
export const readWorkspaceDisk = (
  root: string,
): DiskFiles => {
  const workspace = createWorkspacePathResolver(root);
  const snapshot = computeInitialDocument({
    fullPath: workspace.root,
  });
  const files: DiskFiles = new Map();
  for (const file of Object.values(
    snapshot.files,
  ) as WorkspaceFile[]) {
    const stat = fs.lstatSync(workspace.resolve(file.name));
    if (stat.isSymbolicLink()) continue;
    const identity =
      stat.ino > 0
        ? String(stat.dev) + ':' + String(stat.ino)
        : undefined;
    files.set(file.name, {
      name: file.name,
      text: file.text,
      identity,
    });
  }
  return files;
};

/** Check content and paths, rather than timestamps that can be coarse. */
export const diskMatchesBaseline = (
  baseline: WorkspaceFiles,
  disk: DiskFiles,
): boolean => {
  if (Object.keys(baseline).length !== disk.size) {
    return false;
  }
  for (const file of Object.values(baseline)) {
    const onDisk = disk.get(file.name);
    if (!onDisk || !sameFile(file, onDisk)) return false;
  }
  return true;
};

export type Reconciliation = {
  files: WorkspaceFiles;
  baseline: WorkspaceFiles;
  identities: Record<string, string | undefined>;
  conflicts: string[];
  changed: boolean;
};

/**
 * Three-way merge: previous saved disk state, live collaborative document,
 * and the new filesystem snapshot. Only apply an external change when the
 * matching editor entry has not changed locally. Conflicts stay unsaved.
 * The caller must publish files+conflicts as ONE OT change.
 */
export const reconcileDisk = ({
  baseline,
  current,
  disk,
  identities,
  makeId = randomId,
}: {
  baseline: WorkspaceFiles;
  current: WorkspaceFiles;
  disk: DiskFiles;
  identities: Record<string, string | undefined>;
  makeId?: () => string;
}): Reconciliation => {
  const files = copyFiles(current);
  const nextBaseline = copyFiles(baseline);
  const nextIdentities = { ...identities };
  const conflicts = new Set<string>();
  const unclaimed = new Set(disk.keys());

  const byIdentity = new Map<string, DiskFile[]>();
  for (const file of disk.values()) {
    if (!file.identity) continue;
    const matches = byIdentity.get(file.identity) ?? [];
    matches.push(file);
    byIdentity.set(file.identity, matches);
  }

  for (const [id, saved] of Object.entries(baseline)) {
    let observed = disk.get(saved.name);
    // Only recognize a rename by an unambiguous filesystem identity.
    if (!observed && identities[id]) {
      const matches = (byIdentity.get(identities[id]) ?? [])
        .filter((file) => unclaimed.has(file.name));
      if (matches.length === 1) observed = matches[0];
    }
    if (observed) unclaimed.delete(observed.name);
    const remoteChanged = !sameFile(saved, observed);
    const localChanged = !sameFile(saved, current[id]);

    if (remoteChanged && localChanged &&
        !sameFile(current[id], observed)) {
      conflicts.add(saved.name);
      continue;
    }
    if (remoteChanged) {
      if (observed) {
        files[id] = diskFile(observed);
        nextBaseline[id] = diskFile(observed);
        nextIdentities[id] = observed.identity;
      } else {
        delete files[id];
        delete nextBaseline[id];
        delete nextIdentities[id];
      }
    } else if (observed) {
      nextIdentities[id] = observed.identity;
    }
  }

  // New disk entries are imported, while simultaneous creation of a
  // same-name file in the editor is treated as a conflict.
  for (const name of unclaimed) {
    const observed = disk.get(name)!;
    const editorEntry = Object.entries(files).find(
      ([, file]) => file.name === name,
    );
    if (editorEntry) {
      const [id, editorFile] = editorEntry;
      if (
        !baseline[id] &&
        sameFile(editorFile, observed)
      ) {
        nextBaseline[id] = diskFile(observed);
        nextIdentities[id] = observed.identity;
      } else {
        conflicts.add(name);
      }
      continue;
    }
    let id = makeId();
    while (files[id] || nextBaseline[id]) {
      id = makeId();
    }
    files[id] = diskFile(observed);
    nextBaseline[id] = diskFile(observed);
    nextIdentities[id] = observed.identity;
  }

  const changed = Object.keys(files).length !==
    Object.keys(current).length ||
    Object.entries(files).some(
      ([id, file]) => !sameFile(file, current[id]),
    );

  return {
    files,
    baseline: nextBaseline,
    identities: nextIdentities,
    conflicts: Array.from(conflicts).sort(),
    changed,
  };
};
