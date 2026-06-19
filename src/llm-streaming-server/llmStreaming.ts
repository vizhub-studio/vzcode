import OpenAI from 'openai';
import {
  parseMarkdownFiles,
  StreamingMarkdownParser,
} from 'llm-code-format';
import { mergeFileChanges } from 'editcodewithai';
import {
  FileCollection,
  VizChatId,
  VizFiles,
} from '@vizhub/viz-types';
import {
  updateFiles,
  updateAIScratchpad,
  createStreamingAIMessage,
  addStreamingEvent,
  updateStreamingStatus,
  finalizeStreamingMessage,
  setChatModel,
} from './chatOperations.js';
import {
  ShareDBDoc,
  ExtendedVizContent,
} from '../types.js';
import { formatFiles } from '../server/prettier.js';

// Verbose logs
const DEBUG = false;

// Useful for testing/debugging the streaming behavior
const slowMode = false;

// If the `EMIT_FIXTURES` variable is true,
// then an output file in the `test/fixtures` folder
// with the before and after file states for testing purposes.
// This feeds into tests in codemirror-ot.
const EMIT_FIXTURES = false;

/**
 * Creates and configures the LLM function for streaming with reasoning tokens
 */
export const createLLMFunction = ({
  shareDBDoc,
  chatId,
  // Feature flag to enable/disable reasoning tokens.
  // When false, reasoning tokens are not requested from the API
  // and reasoning content is not processed in the streaming response.
  enableReasoningTokens = false,
  model,
  aiRequestOptions,
}: {
  shareDBDoc: ShareDBDoc<ExtendedVizContent>;
  chatId: VizChatId;
  enableReasoningTokens?: boolean;
  model?: string;
  aiRequestOptions?: any;
}) => {
  return async (fullPrompt: string) => {
    // Create OpenRouter client for reasoning token support
    const apiKey =
      aiRequestOptions?.apiKey ||
      process.env.VZCODE_EDIT_WITH_AI_API_KEY;
    if (!apiKey) {
      console.warn(
        '[LLMStreaming] OpenAI API Key not found',
      );
    }

    const openRouterClient = new OpenAI({
      apiKey: apiKey,
      baseURL:
        aiRequestOptions?.baseURL ||
        process.env.VZCODE_EDIT_WITH_AI_BASE_URL ||
        'https://openrouter.ai/api/v1',
      defaultHeaders: {
        'HTTP-Referer': 'https://vizhub.com',
        'X-Title': 'VizHub',
      },
    });

    let fullContent = '';
    let generationId = '';
    let currentEditingFileName = null;
    let accumulatedTextChunk = '';
    let currentFileContent = '';

    // Stream the response with reasoning tokens
    const modelName =
      model ||
      process.env.VZCODE_EDIT_WITH_AI_MODEL_NAME ||
      'anthropic/claude-haiku-4.5';

    // Create streaming AI message
    createStreamingAIMessage(shareDBDoc, chatId);

    // Set the model being used for this chat
    setChatModel(shareDBDoc, chatId, modelName);

    // Set initial content generation status
    updateStreamingStatus(
      shareDBDoc,
      chatId,
      'Formulating a plan...',
    );

    // Helper to get original file content
    const getOriginalFileContent = (
      fileName: string,
    ): string => {
      const files = shareDBDoc.data.files;
      for (const file of Object.values(files)) {
        if ((file as any).name === fileName) {
          return (file as any).text || '';
        }
      }
      return '';
    };

    // Helper to emit text chunk when accumulated
    const emitTextChunk = async () => {
      if (accumulatedTextChunk.trim()) {
        DEBUG &&
          console.log(
            'LLMStreaming: Emitting text chunk:',
            accumulatedTextChunk.substring(0, 100) + '...',
          );
        await addStreamingEvent(shareDBDoc, chatId, {
          type: 'text_chunk',
          content: accumulatedTextChunk,
          timestamp: Date.now(),
        });
        accumulatedTextChunk = '';
      }
    };

    // Helper to complete file editing
    const completeFileEditing = async (
      fileName: string,
    ) => {
      if (fileName) {
        DEBUG &&
          console.log(
            `LLMStreaming: Completing file editing for ${fileName}`,
          );
        await addStreamingEvent(shareDBDoc, chatId, {
          type: 'file_complete',
          fileName,
          beforeContent: getOriginalFileContent(fileName),
          afterContent: currentFileContent,
          timestamp: Date.now(),
        });
        currentFileContent = '';
      }
    };

    // Define callbacks for streaming parser
    const callbacks = {
      onFileNameChange: async (
        fileName: string,
        format: string,
      ) => {
        DEBUG &&
          console.log(
            `LLMStreaming: File changed to: ${fileName} (${format})`,
          );

        // Emit any accumulated text chunk first
        await emitTextChunk();

        // Complete previous file if any
        if (currentEditingFileName) {
          await completeFileEditing(currentEditingFileName);
        }

        // Start new file
        currentEditingFileName = fileName;
        currentFileContent = '';

        // Emit file start event
        await addStreamingEvent(shareDBDoc, chatId, {
          type: 'file_start',
          fileName,
          timestamp: Date.now(),
        });

        // Update status
        updateStreamingStatus(
          shareDBDoc,
          chatId,
          `Editing ${fileName}...`,
        );
      },
      onCodeLine: async (line: string) => {
        DEBUG && console.log(`Code line: ${line}`);
        // Accumulate code content for the current file
        currentFileContent += line + '\n';
      },
      onNonCodeLine: async (line: string) => {
        DEBUG && console.log(`Non-code line: ${line}`);
        // Accumulate non-code content as text chunk
        if (line.trim() !== '') {
          accumulatedTextChunk += line + '\n';

          // Update status for subsequent non-code chunks
          if (firstNonCodeChunkProcessed) {
            updateStreamingStatus(
              shareDBDoc,
              chatId,
              'Describing changes...',
            );
          } else {
            firstNonCodeChunkProcessed = true;
          }
        }
      },
      onFileDelete: async (fileName: string) => {
        DEBUG &&
          console.log(
            `LLMStreaming: File marked for deletion: ${fileName}`,
          );

        // Emit any accumulated text chunk first
        await emitTextChunk();

        // Complete previous file if any
        if (currentEditingFileName) {
          await completeFileEditing(currentEditingFileName);
        }

        // Reset current editing state
        currentEditingFileName = null;
        currentFileContent = '';

        // Emit file delete event
        await addStreamingEvent(shareDBDoc, chatId, {
          type: 'file_delete',
          fileName,
          timestamp: Date.now(),
        });

        // Update status
        updateStreamingStatus(
          shareDBDoc,
          chatId,
          `Deleting ${fileName}...`,
        );
      },
    };

    const parser = new StreamingMarkdownParser(callbacks);

    const chunks = [];
    let reasoningContent = '';

    // Configure reasoning tokens based on enableReasoningTokens flag
    const requestConfig: any = {
      model: modelName,
      messages: [{ role: 'user', content: fullPrompt }],
      stream: true,
    };

    // Only include reasoning configuration if reasoning tokens are enabled
    // if (enableReasoningTokens) {
    //   requestConfig.reasoning = {
    //     effort: 'low',
    //     exclude: false,
    //   };
    // }

    const stream = await (
      openRouterClient.chat.completions.create as any
    )(requestConfig);

    let reasoningStarted = false;
    let contentStarted = false;
    let firstNonCodeChunkProcessed = false;

    for await (const chunk of stream) {
      if (slowMode) {
        await new Promise((resolve) =>
          setTimeout(resolve, 500),
        );
      }
      const delta = chunk.choices[0]?.delta as any; // Type assertion for OpenRouter-specific reasoning fields

      if (delta?.reasoning && enableReasoningTokens) {
        // Handle reasoning tokens (thinking) - only if enabled
        if (!reasoningStarted) {
          reasoningStarted = true;
          updateStreamingStatus(
            shareDBDoc,
            chatId,
            'Thinking...',
          );
        }
        reasoningContent += delta.reasoning;
        updateAIScratchpad(
          shareDBDoc,
          chatId,
          reasoningContent,
        );
      } else if (delta?.content) {
        // Handle regular content tokens
        if (!contentStarted) {
          contentStarted = true;
          if (reasoningStarted) {
            // Clear reasoning when content starts
            updateAIScratchpad(shareDBDoc, chatId, '');
          }
          // // Set initial content generation status
          // updateStreamingStatus(
          //   shareDBDoc,
          //   chatId,
          //   'Formulating a plan...',
          // );
        }

        const chunkContent = delta.content;
        chunks.push(chunkContent);

        await parser.processChunk(chunkContent);
        fullContent += chunkContent;
      } else if (chunk.usage) {
        // Handle usage information
        DEBUG && console.log('Usage:', chunk.usage);
      }

      if (!generationId && chunk.id) {
        generationId = chunk.id;
      }
    }
    await parser.flushRemaining();

    // Emit any remaining text chunk
    await emitTextChunk();

    // Complete final file if any
    if (currentEditingFileName) {
      await completeFileEditing(currentEditingFileName);
    }

    // // Capture the current state of files before applying changes
    // const beforeFiles = createFilesSnapshot(
    //   shareDBDoc.data.files,
    // );

    // Parse the full content to extract file changes
    // export type FileCollection = Record<string, string>;
    const newFilesUnformatted: FileCollection =
      parseMarkdownFiles(fullContent, 'bold').files;

    // Run Prettier on `newFiles` before applying them,
    // preserving empty files as empty
    // since that is the cue to delete a file.
    const newFilesFormatted = await formatFiles(
      newFilesUnformatted,
    );

    // Capture the current state of files before applying changes
    let vizFilesBefore: VizFiles;
    if (EMIT_FIXTURES) {
      vizFilesBefore = JSON.parse(
        JSON.stringify(shareDBDoc.data.files),
      );
    }

    // Apply all the edits at once
    const vizFilesAfter: VizFiles = mergeFileChanges(
      shareDBDoc.data.files,
      newFilesFormatted,
    );

    const filesOp = updateFiles(shareDBDoc, vizFilesAfter);

    if (EMIT_FIXTURES) {
      const fs = await import('fs');
      const path = await import('path');
      const testCasesDir = path.resolve(
        process.cwd(),
        '../',
        'fixtures',
      );
      if (!fs.existsSync(testCasesDir)) {
        fs.mkdirSync(testCasesDir, { recursive: true });
      }
      const timestamp = new Date()
        .toISOString()
        .replace(/[:.]/g, '-');
      const testCasePath = path.join(
        testCasesDir,
        `ai-chat-${timestamp}.json`,
      );
      const testCaseData = {
        vizFilesBefore,
        vizFilesAfter,
        filesOp,
      };
      fs.writeFileSync(
        testCasePath,
        JSON.stringify(testCaseData, null, 2),
      );
      console.log(
        `AI chat test case written to ${testCasePath}`,
      );
    }

    // Finalize streaming message
    finalizeStreamingMessage(shareDBDoc, chatId);

    return {
      content: fullContent,
      generationId: generationId,
    };
  };
};
