export const enableLiveKit =
  import.meta.env.VITE_ENABLE_LIVEKIT === 'true';

// Enables the speech-to-text microphone button in the AI chat
// input. Off by default: speech recognition is a browser media
// feature, and merely constructing a `SpeechRecognition` instance
// can make the browser show a microphone permission prompt. Set
// `VITE_ENABLE_VOICE_INPUT=true` to opt in.
export const enableVoiceInput =
  import.meta.env.VITE_ENABLE_VOICE_INPUT === 'true';

export const enableAIChat = true;

export const enableDiffView = true;

export const enableAskMode = false;

// Phase 0: Feature flag for minimal AI edit flow
export const enableMinimalEditFlow = true;

// If true, only include the minimal set of extensions,
// namely only the JSON1 OT extension and that's it.
// This is useful for testing and debugging the OT functionality
// without any other extensions getting in the way,
// just to rule them out as the source of a bug.
export const MINIMAL_EXTENSIONS = false;
