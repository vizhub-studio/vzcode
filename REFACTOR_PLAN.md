# Refactoring Plan: LLM Streaming UI Migration

## Completed: VZCode context boundary (2026-10-20)

- Phases 1–3: `AIChatWrapper` in `src/client/VZSidebar` is now the only VZCode context reader for the chat message tree.
- `AIChat`, `MessageList`, `Message`, and `DiffView` consume typed props instead of `VZCodeContext`.
- The wrapper owns file navigation for diff clicks; standalone `DiffView` can render without an editor host by omitting `onOpenFile`.
- `ChatInput` already consumes callbacks via props; it did not need context migration.
- Existing host-facing `VZCodeContextValue` and external behavior are unchanged.

## Remaining: independent reusable component library

1. **Hooks:** Move or share `useAutoScroll` from `src/client/hooks` into `src/llm-streaming-ui` without duplication.
2. **Utilities and feature flags:** Move/share diff and scroll helpers; supply `enableDiffView`, `enableAskMode`, and `enableVoiceInput` through explicit props or local UI defaults.
3. **Presentation dependencies:** Remove direct imports of `src/client/Icons` and `src/client/bootstrap` by passing UI primitives or moving portable assets into the library.
4. **Packaging:** After dependency direction is clean, evaluate publishing `llm-streaming-ui` as its own package. Do not duplicate source or remove host capabilities prematurely.

The earlier instruction to delete `src/client/VZSidebar/AIChat` was obsolete: that legacy directory no longer exists.
