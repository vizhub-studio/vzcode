# LLM Streaming UI

Client-side React UI components for displaying streaming AI edits and chat.

## Overview

This module is a standalone, reusable React component library extracted
from VZCode's AI chat interface. It provides client-side UI for:

- **AI Chat Interface**: Main chat container component
- **Message Display**: Rendering user and assistant messages with streaming support
- **Diff Visualization**: Showing code changes with syntax highlighting
- **Status Indicators**: Displaying AI thinking/reasoning and file editing status
- **Voice Input**: Speech recognition for voice-based chat input

## Status

The library is **decoupled** from VZCode. It does **not** import from
`src/client` and contains no reference to `VZCodeContext`. All
application state and callbacks are supplied via props.

VZCode binds those props using the `AIChatWrapper` component in
`src/client/VZSidebar/AIChatWrapper.tsx`.

## Components

### Main Components

- `index.tsx` (AIChat) - Main chat container with message management
- `MessageList.tsx` - Scrollable message list with auto-scroll
- `Message.tsx` - Individual message rendering (user/assistant)
- `ChatInput.tsx` - Chat input field with voice support

### Diff/Code Display

- `DiffView.tsx` - Unified diff viewer for code changes
- `IndividualFileDiff.tsx` - Per-file diff display
- `FileEditingIndicator.tsx` - Status indicator for file editing

### Status/Loading

- `TypingIndicator.tsx` - Animated typing/loading indicator
- `ThinkingScratchpad.tsx` - AI reasoning/thinking display
- `JumpToLatestButton.tsx` - Button to scroll to latest message
- `Spinner.tsx` - Animated loading spinner

### Hooks

- `useSpeechRecognition.ts` - Voice input functionality
- `hooks/useAutoScroll.ts` - Auto-scroll behavior for the message list

### Support Modules

- `components/bootstrap.ts` - react-bootstrap component wrappers
- `components/icons.tsx` - Self-contained microphone icons
- `utils/scrollUtils.ts` - Diff scrolling and accessibility helpers
- `props.ts` - Public prop and callback types

### Styles

- `components/styles.scss` - Main component styles
- `components/DiffView.scss` - Diff viewer styles
- `components/Spinner.scss` - Spinner styles

## Dependencies

- React and React hooks
- react-bootstrap
- diff2html for diff rendering
- react-markdown for message rendering
- `@vizhub/viz-types` for chat/content types
- Shared, framework-agnostic VZCode utilities: `../types.js`
  and `../utils/fileDiff`

## Usage (Current)

`src/client/VZSidebar/index.tsx` renders `AIChatWrapper`, which passes
`VZCodeContext` state and callbacks into the standalone `AIChat`:

```typescript
import { AIChat } from '../../llm-streaming-ui';
```

```tsx
<AIChat
  content={content}
  aiChatMode={aiChatMode}
  handleSendMessage={handleSendMessage}
  // ...chat state, callbacks, feature flags
/>
```

See `AIChatProps` in `props.ts` for the full contract.

## Contributing

- Keep the library free of imports from `src/client`
- Prefer props over context for all host interaction
- Add or update tests when changing behavior
- Document new props and side effects

## Theming

The components currently use VZCode's theming system via SCSS variables.
Future versions will provide CSS custom properties and theme presets.
