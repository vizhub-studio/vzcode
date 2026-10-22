# Refactoring Plan: LLM Streaming UI Extraction

Status: **Completed.**

The `llm-streaming-ui` module has been decoupled from the VZCode client.
It no longer imports from `src/client` and no longer reads
`VZCodeContext`; all host interaction happens through props. VZCode
binds those props in `src/client/VZSidebar/AIChatWrapper.tsx`.

This is enforced by `test/llmStreamingUiArchitecture.test.ts`, which
fails if any file under `src/llm-streaming-ui` imports `src/client` or
`VZCodeContext`.

## What was done

1. **Wrapper**: `src/client/VZSidebar/AIChatWrapper.tsx` consumes
   `VZCodeContext` and supplies props to `AIChat`.
2. **AIChat**: reads only props; types in `src/llm-streaming-ui/props.ts`.
3. **MessageList / Message / DiffView**: no longer use context; receive
   `additionalWidgets`, `handleSendMessage`, `enableDiffView`, and
   `onOpenFile` via props.
4. **useAutoScroll**: moved to `src/llm-streaming-ui/hooks/`.
5. **scrollUtils**: moved to `src/llm-streaming-ui/utils/`.
6. **Icons**: the microphone icons are self-contained in
   `src/llm-streaming-ui/components/icons.tsx`.
7. **Bootstrap UI**: react-bootstrap wrappers live in
   `src/llm-streaming-ui/components/bootstrap.ts`.
8. **Spinner**: self-contained in
   `src/llm-streaming-ui/components/Spinner.tsx`.
9. **Barrel**: `src/llm-streaming-ui/index.ts` now exports the
   component API, hooks, and public prop types; `VZSidebar` uses the
   `AIChatWrapper`.

## Intentional deviation

`fileDiff.ts` remains in `src/utils/fileDiff.ts`. It is
framework-agnostic and is shared by the client UI **and** the
server-side module `src/llm-streaming-server/aiEditing.ts`, so it is
treated as a shared utility rather than being moved under the UI
library.
