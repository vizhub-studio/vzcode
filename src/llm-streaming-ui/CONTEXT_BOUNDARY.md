# Standalone AI Chat UI boundary

The exported `AIChat` component accepts an explicit `AIChatProps` contract
defined in `src/llm-streaming-ui/types.ts`. It does **not** read
`VZCodeContext`.

When embedding chat in VZCode, use
`src/client/VZSidebar/AIChatWrapper.tsx`, which reads the editor context,
passes chat state/actions as props, and supplies `onOpenDiffFile` to open
clicked diff filenames in VZCode. The callback is optional for standalone
consumers; without it, diffs still render but filenames do not navigate.

`MessageList` and `Message` pass `additionalWidgets`,
`handleSendMessage`, and `onOpenDiffFile` explicitly. Streaming completion
widgets and completed-message widgets continue to use their existing
rendering conditions.

This PR addresses the context coupling only. Feature flags, editor icons,
bootstrap styles, scrolling hooks, and file-diff utilities still need to be
decoupled before `llm-streaming-ui` is an independently packaged library.
