import { validateRequest } from '../../llm-streaming-server/validation.js';
import {
  ensureChatsExist,
  ensureChatExists,
  addUserMessage,
  setAIStatus,
  setChatAIMetadata,
} from '../../llm-streaming-server/chatOperations.js';
import { createLLMFunction } from '../../llm-streaming-server/llmStreaming.js';
import { performAIEditing } from '../../llm-streaming-server/aiEditing.js';
import {
  handleError,
  handleBackgroundError,
} from '../../llm-streaming-server/errorHandling.js';
import { createRunCodeFunction } from '../../runCode.js';
import { ShareDBDoc } from '../../types.js';
import { VizContent } from '@vizhub/viz-types';
import { createSubmitOperation } from '../../submitOperation.js';
import { getGenerationMetadata } from 'editcodewithai';

const DEBUG = false;

export const handleAIChatMessage =
  ({
    shareDBDoc,
    onCreditDeduction,
    onGenerationFinished,
    model,
    aiRequestOptions,
    enableReasoningTokens,
    baseCommitId,
    escalationLevel,
  }: {
    shareDBDoc: ShareDBDoc<VizContent>;
    onCreditDeduction?: any;
    onGenerationFinished?: (result: {
      success: boolean;
      editResult?: any;
      metrics?: any;
      error?: any;
    }) => Promise<void> | void;
    model?: string;
    aiRequestOptions?: any;
    enableReasoningTokens?: boolean;
    // Phase 3: explicit escalation base. Persisted on the chat so that
    // repeated "Try Harder" clicks are idempotent and do not depend on
    // the fragile `parent(currentCommit)` heuristic.
    baseCommitId?: string;
    // Explicit escalation level, persisted on the chat so it survives
    // reloads and is shared across clients.
    escalationLevel?: number;
  }) =>
  async (req: any, res: any) => {
    const { content, chatId } = req.body;

    if (DEBUG) {
      console.log(
        '[handleAIChatMessage] content:',
        content,
        'chatId:',
        chatId,
        'shareDBDoc:',
        shareDBDoc,
      );
    }

    // Validate request
    if (!validateRequest(req, res)) {
      return;
    }

    try {
      // Ensure chats structure exists
      ensureChatsExist(shareDBDoc);
      ensureChatExists(shareDBDoc, chatId);

      // Add user message to chat
      addUserMessage(shareDBDoc, chatId, content);

      // Persist explicit escalation metadata on the chat, so that
      // retries are idempotent and the level survives reloads.
      setChatAIMetadata(shareDBDoc, chatId, {
        baseCommitId,
        escalationLevel,
      });

      // Return success immediately - AI generation continues in background
      res.status(200).json('success');

      // Continue AI processing in background (don't await)
      processAIRequestAsync({
        shareDBDoc,
        chatId,
        content,
        model,
        aiRequestOptions,
        enableReasoningTokens,
        onCreditDeduction,
        onGenerationFinished,
      }).catch((error) => {
        console.error(
          'Background AI processing error:',
          error,
        );
        // Handle error without HTTP response
        handleBackgroundError(shareDBDoc, chatId, error);
      });
    } catch (error) {
      handleError(shareDBDoc, chatId, error, res);
    }
  };

/**
 * Processes the AI request asynchronously in the background
 */
const processAIRequestAsync = async ({
  shareDBDoc,
  chatId,
  content,
  model,
  aiRequestOptions,
  enableReasoningTokens,
  onCreditDeduction,
  onGenerationFinished,
}: {
  shareDBDoc: ShareDBDoc<VizContent>;
  chatId: string;
  content: string;
  model?: string;
  aiRequestOptions?: any;
  enableReasoningTokens?: boolean;
  onCreditDeduction?: any;
  onGenerationFinished?: (result: {
    success: boolean;
    editResult?: any;
    metrics?: any;
    error?: any;
  }) => Promise<void> | void;
}) => {
  try {
    // Create LLM function for streaming
    const llmFunction = createLLMFunction({
      shareDBDoc,
      chatId,
      enableReasoningTokens: enableReasoningTokens ?? true,
      model,
      aiRequestOptions,
    });

    // Create server-side runCode function using shareDBDoc
    const submitOperation =
      createSubmitOperation(shareDBDoc);
    const runCode = createRunCodeFunction(submitOperation);

    // Perform AI editing or chat based on mode
    const editResult = await performAIEditing({
      prompt: content,
      shareDBDoc,
      llmFunction,
      runCode,
    });

    // Billing is best-effort. It must NEVER prevent the edit from
    // being committed. Any metadata failure is logged and swallowed.
    let metrics: any = null;
    if (onCreditDeduction && editResult.generationId) {
      try {
        metrics = await getGenerationMetadata({
          apiKey:
            aiRequestOptions?.apiKey ||
            process.env.VZCODE_EDIT_WITH_AI_API_KEY,
          generationId: editResult.generationId,
        });
        await onCreditDeduction(metrics);
      } catch (creditError) {
        console.error(
          'Credit deduction error (edit will still be finalized):',
          creditError,
        );
      }
    }

    // Always notify settlement on success, regardless of billing
    // outcome, so the caller can commit the edit and release locks.
    if (onGenerationFinished) {
      try {
        await onGenerationFinished({
          success: true,
          editResult,
          metrics,
        });
      } catch (settleError) {
        console.error(
          'onGenerationFinished (success) error:',
          settleError,
        );
      }
    }

    // Clear the AI status to indicate completion
    setAIStatus(shareDBDoc, chatId, undefined);
  } catch (error) {
    // Set error status and add error message to chat
    setAIStatus(shareDBDoc, chatId, 'error');

    // Always notify settlement on failure so the caller can roll back
    // the pre-restore snapshot and release locks.
    if (onGenerationFinished) {
      try {
        await onGenerationFinished({
          success: false,
          error,
        });
      } catch (settleError) {
        console.error(
          'onGenerationFinished (failure) error:',
          settleError,
        );
      }
    }

    handleBackgroundError(shareDBDoc, chatId, error);
  }
};
