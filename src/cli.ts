#!/usr/bin/env node

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import open from 'open';
import { createVZCodeServer } from './server/createServer.js';

const DEFAULT_PORT = 3030;
const HOST = '127.0.0.1';
const __dirname = path.dirname(
  fileURLToPath(import.meta.url),
);

type CLIOptions = {
  directory: string;
  port: number;
  openBrowser: boolean;
  desktop: boolean;
  help: boolean;
};

const usage = [
  'VZCode - Multiplayer Code Editor',
  '',
  'Usage: vzcode [directory] [options]',
  '',
  'Starts the browser editor for a local workspace (defaults to ".").',
  '',
  'Options:',
  '  --help, -h       Show this help message',
  '  --browser        Use the browser editor (the default)',
  '  --desktop        Launch a locally built Tauri application (experimental)',
  '  --no-open        Start the server without opening a browser',
  '  --port=<port>    HTTP/WebSocket port (default: 3030)',
  '  --port <port>    Equivalent to --port=<port>',
  '',
  'Examples:',
  '  vzcode .',
  '  vzcode ./my-project --port=4000',
  '  vzcode --no-open',
  '',
  'VZCode listens on 127.0.0.1 only. Do not expose its unauthenticated',
  'workspace editing server to untrusted networks.',
].join('\n');

function parsePort(value: string): number {
  if (!/^\d+$/.test(value)) {
    throw new Error('Invalid port: ' + value);
  }
  const port = Number(value);
  if (!Number.isSafeInteger(port) || port > 65535) {
    throw new Error(
      'Port must be between 0 and 65535: ' + value,
    );
  }
  return port;
}

function parseOptions(args: string[]): CLIOptions {
  const options: CLIOptions = {
    directory: '.',
    port: DEFAULT_PORT,
    openBrowser: true,
    desktop: false,
    help: false,
  };

  let hasDirectory = false;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--help' || arg === '-h') {
      options.help = true;
      continue;
    }
    if (arg === '--browser') {
      continue;
    }
    if (arg === '--desktop') {
      options.desktop = true;
      continue;
    }
    if (arg === '--no-open') {
      options.openBrowser = false;
      continue;
    }
    if (arg === '--port' || arg.startsWith('--port=')) {
      const value =
        arg === '--port'
          ? args[++i]
          : arg.slice('--port='.length);
      if (value === undefined) {
        throw new Error('Missing value for --port');
      }
      options.port = parsePort(value);
      continue;
    }
    if (arg.startsWith('-')) {
      throw new Error('Unknown option: ' + arg);
    }
    if (hasDirectory) {
      throw new Error(
        'Provide at most one workspace directory',
      );
    }
    options.directory = arg;
    hasDirectory = true;
  }

  return options;
}

// The npm package intentionally does not include a desktop executable.
// This path is available only after building Tauri in a source checkout.
function findDesktopApp(): string | null {
  const root = path.resolve(__dirname, '..');
  const candidates = [
    'src-tauri/target/debug/vzcode',
    'src-tauri/target/debug/vzcode.exe',
    'src-tauri/target/release/vzcode',
    'src-tauri/target/release/vzcode.exe',
    'src-tauri/target/debug/vzcode.app/Contents/MacOS/vzcode',
    'src-tauri/target/release/vzcode.app/Contents/MacOS/vzcode',
  ];
  return (
    candidates
      .map((candidate) => path.join(root, candidate))
      .find((candidate) => fs.existsSync(candidate)) ?? null
  );
}

async function main(): Promise<void> {
  const options = parseOptions(process.argv.slice(2));
  if (options.help) {
    console.log(usage);
    return;
  }

  const directory = path.resolve(options.directory);
  if (
    !fs.existsSync(directory) ||
    !fs.statSync(directory).isDirectory()
  ) {
    throw new Error(
      'Workspace is not a directory: ' + directory,
    );
  }

  const desktopBinary = options.desktop
    ? findDesktopApp()
    : null;
  if (options.desktop && !desktopBinary) {
    throw new Error(
      'Tauri application not found. Build it with npm run tauri:build, ' +
        'or omit --desktop to use the browser editor.',
    );
  }

  const server = createVZCodeServer({ cwd: directory });
  await server.ready;
  let actualPort: number;
  try {
    // Local-only until authenticated remote collaboration exists.
    actualPort = await server.listen(options.port, HOST);
  } catch (error) {
    await server.close();
    throw error;
  }

  const url = 'http://' + HOST + ':' + actualPort;
  console.log('Workspace: ' + directory);
  const accessUrl =
    url + '/#vzcode-token=' + server.accessToken;
  console.log('Editor is live at ' + accessUrl);
  console.log(
    'Keep this private link secret; it grants workspace editing access.',
  );
  console.log('Press Ctrl+C to stop VZCode.');

  let closing = false;
  const shutdown = async () => {
    if (closing) return;
    closing = true;
    try {
      await server.close();
    } catch (error) {
      console.error('Failed to stop VZCode:', error);
      process.exitCode = 1;
    }
  };
  process.once('SIGINT', () => void shutdown());
  process.once('SIGTERM', () => void shutdown());

  if (desktopBinary) {
    const child = spawn(desktopBinary, [], {
      cwd: directory,
      stdio: 'inherit',
    });
    child.once('error', (error) => {
      console.error(
        'Unable to launch the desktop app:',
        error,
      );
      process.exitCode = 1;
      void shutdown();
    });
    child.once('exit', () => void shutdown());
  } else if (options.openBrowser) {
    try {
      await open(accessUrl);
    } catch (error) {
      console.warn(
        'Could not open a browser automatically. Visit ' +
          url,
        error,
      );
    }
  }
}

main().catch((error) => {
  console.error('VZCode: ' + (error.message ?? error));
  process.exitCode = 1;
});
