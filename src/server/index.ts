#!/usr/bin/env node
import open from 'open';
import { createVZCodeServer } from './createServer.js';

// Helper function to get the port from command line arguments or use default.
function getPortFromArgs(defaultPort = 3030) {
  const portArg = process.argv.find((arg) =>
    arg.startsWith('--port='),
  );
  if (portArg) {
    return parseInt(portArg.split('=')[1], 10);
  }
  return defaultPort;
}

// Server port.
const port = getPortFromArgs();

const { ready, listen } = createVZCodeServer();

ready.catch((error) => {
  console.error(
    'Failed to initialize ShareDB document:',
    error,
  );
});

listen(port).then((actualPort) => {
  // Sets the port to the one specified in the environment
  // variable (for development) or the default port.
  const livePort = process.env.EDITOR_PORT || actualPort;
  console.log(`EDITOR_PORT: ${process.env.EDITOR_PORT}`);
  console.log(
    `Editor is live at http://localhost:${livePort}`,
  );
  open(`http://localhost:${livePort}`);
});
