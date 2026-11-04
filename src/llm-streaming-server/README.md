# LLM Streaming Server

Server-side library for streaming LLM responses with ShareDB integration.

## Overview

This is an internal VZCode module that provides server-side functionality for:

- **LLM Streaming**: Creating and managing streaming LLM functions with OpenAI/OpenRouter
- **AI Code Editing**: Performing AI-assisted code transformations and edits
- **ShareDB Integration**: Managing chat operations and real-time collaboration
- **Request Validation**: Validating incoming AI chat requests
- **Error Handling**: Handling errors gracefully in streaming contexts

## Status

The module is used by VZCode's AI chat handler. It still depends on VZCode
types and utilities, and is not published as a standalone package.

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
