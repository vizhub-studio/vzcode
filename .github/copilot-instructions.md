# VZCode: Multiplayer Code Editor

VZCode is a browser-based multiplayer code editor built for real-time collaborative development. It serves as both a standalone editor and the core component of VizHub. The application supports AI-assisted coding, file management, syntax highlighting, and live collaboration features.

**Always reference these instructions first and fallback to search or bash commands only when you encounter unexpected information that does not match the info here.**

## Working Effectively

### Essential Setup and Build Commands

Run these commands in sequence for a complete setup:

```bash
# Install dependencies - NEVER CANCEL: Takes ~2 minutes
npm install  # Set timeout to 5+ minutes

# Build the application - NEVER CANCEL: Takes ~40 seconds
npm run build  # Set timeout to 3+ minutes

# Run tests - Takes ~3 seconds, expect all tests to pass (baseline)
npm test  # Set timeout to 1+ minute

# Format code (always run before committing) - Takes ~3 seconds
npm run prettier  # Set timeout to 1+ minute

# Type checking - Takes ~5 seconds, expect 0 errors (baseline)
npm run typecheck  # Set timeout to 1+ minute
```

### Development Servers

Choose one of these development approaches:

**Interactive Test Server (Recommended for basic development):**

```bash
# Starts server on port 3030 with sample files
npm run test-interactive
# Server starts immediately, runs indefinitely until stopped
# Access at: http://localhost:3030
```

**Development Server with Hot Reloading (For UI changes):**

```bash
# Starts both backend server and Vite dev server on port 5173
npm run dev
# NEVER CANCEL: Takes ~10 seconds to fully start both servers
# Access at: http://localhost:5173 with hot reloading enabled
```

### Windows-Specific Setup

If developing on Windows, install additional dependency:

```bash
npm install @rollup/rollup-win32-x64-msvc
```

### Tauri Desktop Application (Optional)

```bash
# Development mode (if Rust/Cargo installed)
npm run tauri:dev

# Build desktop app (if Rust/Cargo installed)
npm run tauri:build
```

## Validation Scenarios

**CRITICAL: Always manually validate changes using these complete user scenarios:**

### Core Editor Functionality Test

1. Start the server: `npm run test-interactive`
2. Navigate to http://localhost:3030
3. Click the Files icon (second icon) in left sidebar
4. Verify file tree shows: constants.js, index.html, index.js, README.md, renderer.js, star.js, styles.css
5. Click on `index.js` to open it
6. Verify:
   - URL changes to `http://localhost:3030/?file=index.js`
   - File opens with syntax highlighting and line numbers
   - Code editor displays JavaScript with proper formatting
   - Tab appears at top showing "index.js"
7. Test file switching by clicking different files in sidebar
8. Verify AI chat panel loads on left (should show "Edit with AI" interface)

### AI Integration Test

1. With server running, verify AI chat interface displays correctly
2. Confirm "Try edit requests like these:" section shows example buttons
3. Test export functionality: click "Export to ZIP" and "Copy for AI" buttons
4. Verify chat input field is functional (though actual AI features require API keys)

### Development Hot Reloading Test

1. Start development server: `npm run dev`
2. Navigate to http://localhost:5173
3. Verify same functionality as above but on port 5173
4. Check browser console shows "[vite] connected." message
5. Make a small change to a React component file and verify hot reload works

## Common Commands and Timing

```bash
# Package management
npm install                    # ~2 minutes - NEVER CANCEL, timeout: 5+ min
npm run upgrade               # Updates dependencies

# Build and development
npm run build                 # ~40 seconds - NEVER CANCEL, timeout: 3+ min
npm run build-release         # Production build with release mode
npm run preview               # Build + preview server

# Testing and validation
npm test                      # ~3 seconds, expect all tests to pass
npm run test:e2e              # Server E2E: real HTTP + ShareDB/WebSocket on a temp workspace
npm run test-interactive      # Starts dev server on port 3030
npm run dev                   # ~10 seconds - NEVER CANCEL, dual server startup

# Code quality
npm run prettier              # ~3 seconds - ALWAYS run before commits
npm run typecheck            # ~5 seconds, expect 0 errors

# Tauri desktop (if Rust available)
npm run tauri:dev            # Desktop development
npm run tauri:build          # Desktop build
```

## Technology Stack and Architecture

**Core Technologies:**

- **Backend**: Node.js, Express, ShareDB (real-time collaboration)
- **Frontend**: React 18, Vite (build tool), CodeMirror 6 (editor)
- **Collaboration**: JSON1 Operational Transform, WebSocket connections
- **Desktop**: Tauri (Rust-based desktop wrapper)
- **AI Integration**: OpenAI API, various AI coding assistants

**Key File Locations:**

```
src/
├── client/           # React frontend components
├── server/           # Express server and API handlers
├── types.ts          # TypeScript definitions
└── index.ts          # Main entry point

test/                 # Test files and sample directories
src-tauri/           # Tauri desktop app configuration
```

## Known Issues and Workarounds

- **Tests**: All tests pass in baseline (1 test is intentionally skipped)
- **TypeScript**: No type errors in baseline
- **Font Loading**: External font requests blocked in sandboxed environments - cosmetic issue only
- **Windows Only**: Large chunks warning in build output - performance consideration only

## Essential Validation Checklist

Before completing any code changes, always verify:

- [ ] `npm run prettier` executes successfully
- [ ] `npm run build` completes without new errors
- [ ] `npm run test-interactive` starts server successfully
- [ ] Can navigate to http://localhost:3030 and see VZCode interface
- [ ] File tree loads and shows sample files
- [ ] Can open and view index.js with syntax highlighting
- [ ] AI chat interface displays on left sidebar
- [ ] For UI changes: Test with `npm run dev` on port 5173 with hot reloading

**CRITICAL**: Always test actual user workflows - starting the application and clicking through the interface is mandatory for validating changes.

## Environment Configuration

**Required:**

- Node.js 16+ (tested with v20.19.4)
- npm 8+ (tested with v10.8.2)

**Optional:**

- Rust/Cargo (for Tauri desktop builds)
- OpenAI API key (for AI features - set in .env file)
- Ngrok token (for public tunneling - set in .env file)

**Environment Variables** (create .env file from .env.example):

```bash
VZCODE_EDIT_WITH_AI_API_KEY=your_openai_api_key_here
NGROK_TOKEN=your_ngrok_token_here
EDITOR_PORT=5173
```
