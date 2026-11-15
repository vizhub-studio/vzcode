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

- `components/ChatInput.tsx` - native React buttons and textarea component wrappers
- `components/icons.tsx` - Self-contained microphone icons
- `utils/scrollUtils.ts` - Diff scrolling and accessibility helpers
- `props.ts` - Public prop and callback types

### Styles

- `components/styles.scss` - Main component styles
- `components/DiffView.scss` - Diff viewer styles
- `components/Spinner.scss` - Spinner styles

## Dependencies

- React and React hooks
- native React buttons and textarea
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

## Host-owned microphone integration

A host can pass `renderChatVoiceInput` to `VZCodeProvider`. VZCode renders its
returned element in the chat composer footer, immediately before Send. The host
owns the microphone implementation, recording state, speech-to-text, any cleanup,
and cancellation. No VZCode speech-recognition code runs when the host control is
used; `enableVoiceInput` remains an independent, legacy standalone option.

```tsx
<VZCodeProvider
  // ...other provider props
  renderChatVoiceInput={({ value, onChange, onBusyChange, onPreviewChange }) => (
    <MyAppVoiceButton
      value={value}
      onCommitDraft={onChange}
      onBusyChange={onBusyChange}
      onPreviewChange={onPreviewChange}
    />
  )}
/>
```

The renderer must return a component rather than directly calling hooks. Its
`value` is the **complete committed draft**. Call `onChange(nextFullDraft)`
only when dictation has finished; this must never submit the chat message.
Call `onPreviewChange(fullDraftPreview)` to display optional interim text,
and `onPreviewChange(null)` to clear it. Call `onBusyChange(true)` before
starting microphone work, including permission and transcript processing; while
busy, VZCode makes its textarea read-only and blocks Send and Enter. Always
call `onBusyChange(false)` on completion, cancellation, errors, and teardown.
Without a renderer, the existing chat composer behavior is preserved.

## Theming

The components use scoped CSS custom properties with VZCode defaults, so they
can render without a host UI framework. When embedding them, hosts can override
the `--vz-color-*` properties on the chat container. The styles do not inject
Bootstrap or VizHub UI CSS.
