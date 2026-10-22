# LLM Streaming Server

Server-side library for streaming LLM responses with ShareDB integration.

## Overview

This module is being extracted from VZCode's AI chat functionality to become a standalone, reusable library. It provides server-side functionality for:

- **LLM Streaming**: Creating and managing streaming LLM functions with OpenAI/OpenRouter
- **AI Code Editing**: Performing AI-assisted code transformations and edits
- **ShareDB Integration**: Managing chat operations and real-time collaboration
- **Request Validation**: Validating incoming AI chat requests
- **Error Handling**: Handling errors gracefully in streaming contexts

## Current Status

⚠️ **Work in Progress**: This is Phase 1 of the extraction plan. The files have been copied to this directory and imports have been updated, but the code is not yet decoupled from VZCode.

## Files

- `index.ts` - Main entry point exporting all public APIs
- `llmStreaming.ts` - Core LLM streaming functionality with OpenAI/OpenRouter
- `aiEditing.ts` - AI-assisted code editing operations
- `chatOperations.ts` - ShareDB chat operations (messages, events, streaming)
- `validation.ts` - Request validation utilities
- `errorHandling.ts` - Error handling for streaming contexts

## Dependencies

Declared in `package.json`:

- `openai` - OpenAI SDK for LLM interactions (declared directly; also used transitively by `@langchain/openai`)
- `sharedb` - Real-time collaborative editing framework
- `llm-code-format` - Markdown parsing for code blocks
- `editcodewithai` - Code editing utilities
- VZCode utilities: `../types.js`, `../ot.js`, `../randomId.js`, etc.

## Future Plans

This module will eventually be:

1. Decoupled from VZCode-specific types and utilities
2. Published as `@vizhub/llm-streaming-server` on npm
3. Made framework-agnostic (can work with Express, Fastify, etc.)
4. Fully documented with usage examples

This module is being extracted into a standalone package
(`@vizhub/llm-streaming-server`). Follow the conventions in
`../llm-streaming-ui/README.md` when contributing.

## Usage (Current)

Currently, this module is imported by `src/server/aiChatHandler/index.ts`:

```typescript
import { createLLMFunction } from '../../llm-streaming-server/llmStreaming.js';
import { performAIEditing } from '../../llm-streaming-server/aiEditing.js';
import {
  ensureChatsExist,
  ensureChatExists,
  addUserMessage,
  setAIStatus,
} from '../../llm-streaming-server/chatOperations.js';
```

## Contributing

As this module is being extracted, please:

- Keep changes minimal and focused
- Maintain backward compatibility with VZCode
- Update tests when modifying functionality
- Document any new dependencies or breaking changes
