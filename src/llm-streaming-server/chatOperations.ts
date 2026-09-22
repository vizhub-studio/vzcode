import { dateToTimestamp } from '@vizhub/viz-utils';
import { randomId } from '../randomId.js';
import {
  ShareDBDoc,
  StreamingEvent,
  ExtendedVizContent,
} from '../types.js';
import { diff } from '../ot.js';
import {
  VizChatId,
  VizContent,
  VizFiles,
} from '@vizhub/viz-types';

/**
 * Ensures the chats object exists in the ShareDB document
 */
export const ensureChatsExist = (shareDBDoc) => {
  if (!shareDBDoc.data.chats) {
    const op = diff(shareDBDoc.data, {
      ...shareDBDoc.data,
      chats: {},
    });
    shareDBDoc.submitOp(op);
  }
};

/**
 * Ensures a specific chat exists in the ShareDB document
 */
export const ensureChatExists = (
  shareDBDoc: ShareDBDoc<VizContent>,
  chatId: VizChatId,
) => {
  if (!shareDBDoc.data.chats[chatId]) {
    const op = diff(shareDBDoc.data, {
      ...shareDBDoc.data,
      chats: {
        ...shareDBDoc.data.chats,
        [chatId]: {
          id: chatId,
          messages: [],
          createdAt: dateToTimestamp(new Date()),
          updatedAt: dateToTimestamp(new Date()),
        },
      },
    });
    shareDBDoc.submitOp(op);
  }
};

/**
 * Adds a user message to the chat
 * Clears old messages to reflect that each prompt is a self-contained code transformation
 */
export const addUserMessage = (
  shareDBDoc: ShareDBDoc<VizContent>,
  chatId: VizChatId,
  content: string,
) => {
  const userMessage = {
    id: `user-${Date.now()}`,
    role: 'user',
    content: content,
    timestamp: dateToTimestamp(new Date()),
  };

  const userMessageOp = diff(shareDBDoc.data, {
    ...shareDBDoc.data,
    chats: {
      ...shareDBDoc.data.chats,
      [chatId]: {
        ...shareDBDoc.data.chats[chatId],
        messages: [userMessage], // Replace old messages with just the new user message
        updatedAt: dateToTimestamp(new Date()),
      },
    },
  });
  shareDBDoc.submitOp(userMessageOp);

  return userMessage;
};

/**
 * Persists AI metadata fields on a chat (Phase 3).
 *
 * `baseCommitId` records the commit the current AI attempt is applied on
 * top of. `escalationLevel` records how many times the user has pressed
 * "Try Harder". Persisting these on the chat makes retries idempotent and
 * keeps the level consistent across reloads and clients.
 *
 * Only fields that are explicitly provided are written.
 */
export const setChatAIMetadata = (
  shareDBDoc: ShareDBDoc<VizContent>,
  chatId: VizChatId,
  metadata: {
    baseCommitId?: string;
    escalationLevel?: number;
  },
) => {
  const chat = shareDBDoc.data.chats[chatId];
  if (!chat) {
    return;
  }

  const updates: Record<string, unknown> = {};
  if (metadata.baseCommitId !== undefined) {
    updates.baseCommitId = metadata.baseCommitId;
  }
  if (metadata.escalationLevel !== undefined) {
    updates.escalationLevel = metadata.escalationLevel;
  }
  if (Object.keys(updates).length === 0) {
    return;
  }

  const op = diff(shareDBDoc.data, {
    ...shareDBDoc.data,
    chats: {
      ...shareDBDoc.data.chats,
      [chatId]: {
        ...chat,
        ...updates,
        updatedAt: dateToTimestamp(new Date()),
      },
    },
  });
  shareDBDoc.submitOp(op);
};

const DEBUG = false;

/**
 * Updates AI status in the chat
 */
export const updateAIStatus = (
  shareDBDoc: ShareDBDoc<VizContent>,
  chatId: VizChatId,
  status: string,
) => {
  DEBUG &&
    console.log(
      `ChatOperations: updateAIStatus called with status: "${status}" for chatId: ${chatId}`,
    );

  const op = diff(shareDBDoc.data, {
    ...shareDBDoc.data,
    chats: {
      ...shareDBDoc.data.chats,
      [chatId]: {
        ...shareDBDoc.data.chats[chatId],
        aiStatus: status,
      },
    },
  });

  DEBUG &&
    console.log(
      `ChatOperations: Submitting operation for status update:`,
      op,
    );
  shareDBDoc.submitOp(op);
  DEBUG &&
    console.log(
      `ChatOperations: Status update operation submitted successfully`,
    );
};

/**
 * Updates AI scratchpad content
 */
export const updateAIScratchpad = (
  shareDBDoc: ShareDBDoc<VizContent>,
  chatId: VizChatId,
  content: string,
) => {
  const op = diff(shareDBDoc.data, {
    ...shareDBDoc.data,
    chats: {
      ...shareDBDoc.data.chats,
      [chatId]: {
        ...shareDBDoc.data.chats[chatId],
        aiScratchpad: content,
      },
    },
  });

  // op is `null` if there are no changes
  // This can happen if the content is the same as before
  // In that case, we don't need to submit an operation
  if (op) {
    shareDBDoc.submitOp(op);
  }
};

/**
 * Clears AI scratchpad and updates status
 */
export const clearAIScratchpadAndStatus = (
  shareDBDoc: ShareDBDoc<VizContent>,
  chatId: VizChatId,
  status: string,
) => {
  const op = diff(shareDBDoc.data, {
    ...shareDBDoc.data,
    chats: {
      ...shareDBDoc.data.chats,
      [chatId]: {
        ...shareDBDoc.data.chats[chatId],
        aiScratchpad: undefined,
        aiStatus: status,
      },
    },
  });
  shareDBDoc.submitOp(op);
};

/**
 * Creates an initial empty AI message for streaming
 */
export const createAIMessage = (
  shareDBDoc: ShareDBDoc<VizContent>,
  chatId: VizChatId,
) => {
  const aiMessage = {
    id: `assistant-${Date.now()}`,
    role: 'assistant',
    content: '',
    timestamp: dateToTimestamp(new Date()),
  };

  const messageOp = diff(shareDBDoc.data, {
    ...shareDBDoc.data,
    chats: {
      ...shareDBDoc.data.chats,
      [chatId]: {
        ...shareDBDoc.data.chats[chatId],
        messages: [
          ...shareDBDoc.data.chats[chatId].messages,
          aiMessage,
        ],
        updatedAt: dateToTimestamp(new Date()),
      },
    },
  });
  shareDBDoc.submitOp(messageOp);

  return aiMessage.id;
};

/**
 * Updates the content of an AI message during streaming
 */
export const updateAIMessageContent = (
  shareDBDoc: ShareDBDoc<VizContent>,
  chatId: VizChatId,
  messageId: string,
  content: string,
) => {
  const chat = shareDBDoc.data.chats[chatId];
  const messageIndex = chat.messages.findIndex(
    (msg) => msg.id === messageId,
  );

  if (messageIndex === -1) {
    console.warn(
      `AI message with id ${messageId} not found`,
    );
    return;
  }

  const updatedMessages = [...chat.messages];
  updatedMessages[messageIndex] = {
    ...updatedMessages[messageIndex],
    content,
  };

  const messageOp = diff(shareDBDoc.data, {
    ...shareDBDoc.data,
    chats: {
      ...shareDBDoc.data.chats,
      [chatId]: {
        ...chat,
        messages: updatedMessages,
        updatedAt: dateToTimestamp(new Date()),
      },
    },
  });
  shareDBDoc.submitOp(messageOp);
};

/**
 * Sets the AI status for a chat
 */
export const setAIStatus = (
  shareDBDoc: ShareDBDoc<VizContent>,
  chatId: VizChatId,
  status: string | undefined,
) => {
  const op = diff(shareDBDoc.data, {
    ...shareDBDoc.data,
    chats: {
      ...shareDBDoc.data.chats,
      [chatId]: {
        ...shareDBDoc.data.chats[chatId],
        aiStatus: status,
        updatedAt: dateToTimestamp(new Date()),
      },
    },
  });
  shareDBDoc.submitOp(op);
};

/**
 * Finalizes an AI message by clearing temporary fields
 */
export const finalizeAIMessage = (
  shareDBDoc: ShareDBDoc<VizContent>,
  chatId: VizChatId,
) => {
  const op = diff(shareDBDoc.data, {
    ...shareDBDoc.data,
    chats: {
      ...shareDBDoc.data.chats,
      [chatId]: {
        ...shareDBDoc.data.chats[chatId],
        aiScratchpad: undefined,
        aiStatus: undefined,
        updatedAt: dateToTimestamp(new Date()),
      },
    },
  });
  shareDBDoc.submitOp(op);
};

/**
 * Adds diff data to the most recent AI message
 */
export const addDiffToAIMessage = (
  shareDBDoc: ShareDBDoc<VizContent>,
  chatId: VizChatId,
  diffData: any,
  beforeCommitId?: string, // Commit ID before AI changes for VizHub integration
) => {
  const chat = shareDBDoc.data.chats[chatId];
  const messages = [...chat.messages];

  // Find the most recent AI message
  const lastAIMessageIndex = messages.length - 1;
  if (
    lastAIMessageIndex >= 0 &&
    messages[lastAIMessageIndex].role === 'assistant'
  ) {
    const newMessage = {
      ...messages[lastAIMessageIndex],
      diffData,
      ...(beforeCommitId && { beforeCommitId }), // Add beforeCommitId for VizHub integration
    };
    // Use type assertion to extend the message with diffData
    (messages[lastAIMessageIndex] as any) = newMessage;

    const messageOp = diff(shareDBDoc.data, {
      ...shareDBDoc.data,
      chats: {
        ...shareDBDoc.data.chats,
        [chatId]: {
          ...chat,
          messages,
          updatedAt: dateToTimestamp(new Date()),
        },
      },
    });

    shareDBDoc.submitOp(messageOp);
  }
};

/**
 * Adds an AI response message to the chat (legacy function, kept for compatibility)
 */
export const addAIMessage = (
  shareDBDoc: ShareDBDoc<VizContent>,
  chatId: VizChatId,
  content?: string,
) => {
  const aiResponse = {
    id: Date.now() + 1,
    role: 'assistant',
    content: content || 'AI edit completed successfully.',
    timestamp: dateToTimestamp(new Date()),
  };

  const messageOp = diff(shareDBDoc.data, {
    ...shareDBDoc.data,
    chats: {
      ...shareDBDoc.data.chats,
      [chatId]: {
        ...shareDBDoc.data.chats[chatId],
        messages: [
          ...shareDBDoc.data.chats[chatId].messages,
          aiResponse,
        ],
        updatedAt: dateToTimestamp(new Date()),
        aiStatus: undefined,
      },
    },
  });
  shareDBDoc.submitOp(messageOp);

  return aiResponse;
};

/**
 * Updates files in the ShareDB document
 */
export const updateFiles = (
  shareDBDoc: ShareDBDoc<VizContent>,
  files: VizFiles,
) => {
  const filesOp = diff(shareDBDoc.data, {
    ...shareDBDoc.data,
    files,
  });
  DEBUG && console.log('updateFiles op:');
  DEBUG && console.log(JSON.stringify(filesOp, null, 2));
  shareDBDoc.submitOp(filesOp);
  return filesOp;
};

/**
 * Finds a file ID by searching for a matching file name
 */
export const resolveFileId = (
  fileName: string,
  shareDBDoc: any,
) => {
  const files = shareDBDoc.data.files;

  // Search through all files to find matching name
  for (const [fileId, file] of Object.entries(files)) {
    if ((file as any).name === fileName) {
      return fileId;
    }
  }

  // If file doesn't exist, return null
  return null;
};

/**
 * Creates a new file with a random ID
 */
export const createNewFile = (
  shareDBDoc: ShareDBDoc<VizContent>,
  fileName: string,
) => {
  // Generate a new random file ID
  const newFileId = randomId();

  const newState = {
    ...shareDBDoc.data,
    files: {
      ...shareDBDoc.data.files,
      [newFileId]: {
        name: fileName,
        text: '',
      },
    },
  };

  const op = diff(shareDBDoc.data, newState);
  shareDBDoc.submitOp(op);
  return newFileId;
};

// ============================================================================
// Streaming Chat Operations
// ============================================================================

/**
 * Creates a streaming AI message with events array
 */
export const createStreamingAIMessage = (
  shareDBDoc: ShareDBDoc<ExtendedVizContent>,
  chatId: VizChatId,
) => {
  const aiMessage = {
    id: `assistant-${Date.now()}`,
    role: 'assistant',
    content: '',
    timestamp: dateToTimestamp(new Date()),
    streamingEvents: [],
    isProgressive: true,
  };

  const messageOp = diff(shareDBDoc.data, {
    ...shareDBDoc.data,
    chats: {
      ...shareDBDoc.data.chats,
      [chatId]: {
        ...shareDBDoc.data.chats[chatId],
        messages: [
          ...shareDBDoc.data.chats[chatId].messages,
          aiMessage,
        ],
        updatedAt: dateToTimestamp(new Date()),
        isStreaming: true,
      },
    },
  });
  shareDBDoc.submitOp(messageOp);

  return aiMessage.id;
};

/**
 * Adds a streaming event to the most recent AI message
 */
export const addStreamingEvent = (
  shareDBDoc: ShareDBDoc<ExtendedVizContent>,
  chatId: VizChatId,
  event: StreamingEvent,
) => {
  DEBUG &&
    console.log(
      `ChatOperations: Adding streaming event:`,
      event,
    );

  const chat = shareDBDoc.data.chats[chatId];
  const messages = [...chat.messages];
  const lastMessageIndex = messages.length - 1;

  if (
    lastMessageIndex >= 0 &&
    messages[lastMessageIndex].role === 'assistant'
  ) {
    const lastMessage = messages[lastMessageIndex] as any;
    const updatedEvents = [
      ...(lastMessage.streamingEvents || []),
      event,
    ];

    messages[lastMessageIndex] = {
      ...lastMessage,
      streamingEvents: updatedEvents,
    };

    const messageOp = diff(shareDBDoc.data, {
      ...shareDBDoc.data,
      chats: {
        ...shareDBDoc.data.chats,
        [chatId]: {
          ...chat,
          messages,
          updatedAt: dateToTimestamp(new Date()),
        },
      },
    });
    shareDBDoc.submitOp(messageOp);
  }
};

/**
 * Updates streaming status for a chat
 */
export const updateStreamingStatus = (
  shareDBDoc: ShareDBDoc<ExtendedVizContent>,
  chatId: VizChatId,
  status: string,
  isStreaming: boolean = true,
) => {
  DEBUG &&
    console.log(
      `ChatOperations: Updating streaming status: "${status}"`,
    );

  const op = diff(shareDBDoc.data, {
    ...shareDBDoc.data,
    chats: {
      ...shareDBDoc.data.chats,
      [chatId]: {
        ...shareDBDoc.data.chats[chatId],
        currentStatus: status,
        isStreaming,
        updatedAt: dateToTimestamp(new Date()),
      },
    },
  });
  shareDBDoc.submitOp(op);
};

/**
 * Sets the model for a chat when AI generation starts
 */
export const setChatModel = (
  shareDBDoc: ShareDBDoc<ExtendedVizContent>,
  chatId: VizChatId,
  model: string,
) => {
  DEBUG &&
    console.log(
      `ChatOperations: Setting model: "${model}" for chatId: ${chatId}`,
    );

  const op = diff(shareDBDoc.data, {
    ...shareDBDoc.data,
    chats: {
      ...shareDBDoc.data.chats,
      [chatId]: {
        ...shareDBDoc.data.chats[chatId],
        model: model,
        updatedAt: dateToTimestamp(new Date()),
      },
    },
  });
  shareDBDoc.submitOp(op);
};

/**
 * Finalizes streaming message and clears streaming state
 */
export const finalizeStreamingMessage = (
  shareDBDoc: ShareDBDoc<ExtendedVizContent>,
  chatId: VizChatId,
) => {
  DEBUG &&
    console.log(
      `ChatOperations: Finalizing streaming message`,
    );

  const chat = shareDBDoc.data.chats[chatId];
  const messages = [...chat.messages];
  const lastMessageIndex = messages.length - 1;

  if (
    lastMessageIndex >= 0 &&
    messages[lastMessageIndex].role === 'assistant'
  ) {
    const lastMessage = messages[lastMessageIndex] as any;

    messages[lastMessageIndex] = {
      ...lastMessage,
      isComplete: true,
    };

    const messageOp = diff(shareDBDoc.data, {
      ...shareDBDoc.data,
      chats: {
        ...shareDBDoc.data.chats,
        [chatId]: {
          ...chat,
          messages,
          currentStatus: 'Done',
          isStreaming: false,
          updatedAt: dateToTimestamp(new Date()),
        },
      },
    });
    shareDBDoc.submitOp(messageOp);
  }
};

// /**
//  * Ensures a file exists, creating it if necessary
//  */
// export const ensureFileExists = (shareDBDoc, fileName) => {
//   let fileId = resolveFileId(fileName, shareDBDoc);

//   if (!fileId) {
//     // File doesn't exist, create it
//     fileId = createNewFile(shareDBDoc, fileName);
//   }

//   return fileId;
// };

// /**
//  * Clears the content of a file
//  */
// export const clearFileContent = (
//   shareDBDoc: ShareDBDoc<VizContent>,
//   fileId: VizFileId,
// ) => {
//   const currentFile = shareDBDoc.data.files[fileId];

//   if (currentFile && currentFile.text) {
//     // Clear the file content
//     const newState = {
//       ...shareDBDoc.data,
//       files: {
//         ...shareDBDoc.data.files,
//         [fileId]: {
//           ...currentFile,
//           text: '',
//         },
//       },
//     };

//     const op = diff(shareDBDoc.data, newState);
//     shareDBDoc.submitOp(op);
//   }
// };

// /**
//  * Appends a line to a file using OT operations
//  */
// export const appendLineToFile = (
//   shareDBDoc: ShareDBDoc<VizContent>,
//   fileId: VizFileId,
//   line: string,
// ) => {
//   const currentFile = shareDBDoc.data.files[fileId];
//   const currentContent = currentFile?.text || '';
//   const newContent = currentContent + line + '\n';

//   const newDocState = {
//     ...shareDBDoc.data,
//     files: {
//       ...shareDBDoc.data.files,
//       [fileId]: {
//         ...currentFile,
//         text: newContent,
//       },
//     },
//   };

//   shareDBDoc.submitOp(diff(shareDBDoc.data, newDocState));
// };
