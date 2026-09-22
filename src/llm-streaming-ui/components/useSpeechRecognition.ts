import {
  useState,
  useEffect,
  useCallback,
  useRef,
  Dispatch,
  SetStateAction,
} from 'react';

export interface UseSpeechRecognitionResult {
  isSpeaking: boolean;
  toggleSpeechRecognition: () => void;
  stopSpeaking: () => void;
}

/**
 * Speech-to-text input for the AI chat box.
 *
 * The underlying `SpeechRecognition` instance is created lazily, on the
 * first call to `toggleSpeechRecognition`, rather than eagerly when the
 * hook mounts. Eager construction can make some browsers show a
 * microphone permission prompt as soon as the editor loads, before the
 * user has asked for voice input.
 */
export const useSpeechRecognition = (
  onTranscriptChange: Dispatch<SetStateAction<string>>,
): UseSpeechRecognitionResult => {
  const [isSpeaking, setIsSpeaking] =
    useState<boolean>(false);
  // `SpeechRecognition` is not part of the DOM lib, so the type
  // reference is suppressed here, as with the constructor lookups below.
  // @ts-ignore
  const recognitionRef = useRef<SpeechRecognition | null>(
    null,
  );

  // Keep the latest callback in a ref so the lazily-created
  // recognition instance always calls the current handler, without
  // having to tear down and recreate the instance.
  const onTranscriptChangeRef = useRef(onTranscriptChange);
  useEffect(() => {
    onTranscriptChangeRef.current = onTranscriptChange;
  }, [onTranscriptChange]);

  // Create the SpeechRecognition instance on first use.
  const getRecognition = useCallback(() => {
    if (recognitionRef.current) {
      return recognitionRef.current;
    }

    // Check if browser supports SpeechRecognition
    const SpeechRecognition =
      // @ts-ignore
      window.SpeechRecognition ||
      // @ts-ignore
      window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      return null;
    }

    const recognitionInstance = new SpeechRecognition();
    recognitionInstance.continuous = true;
    recognitionInstance.interimResults = true;

    recognitionInstance.onresult = (event) => {
      let finalText = '';
      let interimText = '';

      // Process all results to separate final and interim text
      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalText += result[0].transcript;
        } else {
          interimText += result[0].transcript;
        }
      }

      // Combine final and interim text and update the prompt
      onTranscriptChangeRef.current(
        finalText + interimText,
      );
    };

    recognitionInstance.onerror = (event) => {
      console.error(
        'Speech recognition error',
        event.error,
      );
      setIsSpeaking(false);
    };

    recognitionInstance.onend = () => {
      setIsSpeaking(false);
    };

    recognitionRef.current = recognitionInstance;
    return recognitionInstance;
  }, []);

  const toggleSpeechRecognition = useCallback(() => {
    const recognition = getRecognition();
    if (!recognition) {
      console.error(
        'Speech recognition not supported in this browser',
      );
      return;
    }

    if (isSpeaking) {
      recognition.stop();
      setIsSpeaking(false);
    } else {
      recognition.start();
      setIsSpeaking(true);
    }
  }, [getRecognition, isSpeaking]);

  const stopSpeaking = useCallback(() => {
    if (recognitionRef.current && isSpeaking) {
      recognitionRef.current.stop();
      setIsSpeaking(false);
    }
  }, [isSpeaking]);

  // Release the microphone if the component unmounts while listening.
  useEffect(
    () => () => {
      recognitionRef.current?.abort();
    },
    [],
  );

  return {
    isSpeaking,
    toggleSpeechRecognition,
    stopSpeaking,
  };
};
