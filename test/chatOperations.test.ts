import {
  describe,
  it,
  expect,
  vi,
  afterEach,
} from 'vitest';
import { apply } from '../src/ot.js';
import {
  ensureChatsExist,
  ensureChatExists,
  addUserMessage,
  setAIStatus,
  updateAIScratchpad,
  clearAIScratchpadAndStatus,
  setChatAIMetadata,
  createAIMessage,
  updateAIMessageContent,
  finalizeAIMessage,
  addDiffToAIMessage,
  addAIMessage,
  updateFiles,
  resolveFileId,
  createNewFile,
  createStreamingAIMessage,
  addStreamingEvent,
  updateStreamingStatus,
  finalizeStreamingMessage,
} from '../src/llm-streaming-server/chatOperations.js';

// A minimal ShareDB-doc double that applies submitted ops to `data` using the
// real OT type, so read-after-write behaves like the real document.
const createDoc = (data: unknown = { files: {} }) => {
  const doc: any = {
    data: JSON.parse(JSON.stringify(data)),
    ops: [] as unknown[],
    submitOp(op: unknown) {
      doc.ops.push(op);
      if (op) doc.data = apply(doc.data, op);
      return op;
    },
    on() {},
    subscribe(callback?: (error?: unknown) => void) {
      callback?.();
    },
  };
  return doc;
};

const seedChat = (doc: any, chatId = 'c1') => {
  ensureChatsExist(doc);
  ensureChatExists(doc, chatId);
  return chatId;
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('chatOperations: chat lifecycle', () => {
  it('creates the chats map and a chat if missing', () => {
    const doc = createDoc({ files: {} });
    ensureChatsExist(doc);
    expect(doc.data.chats).toEqual({});

    ensureChatExists(doc, 'c1');
    expect(doc.data.chats.c1).toMatchObject({
      id: 'c1',
      messages: [],
    });
  });

  it('does not recreate an existing chat', () => {
    const doc = createDoc({ files: {} });
    const chatId = seedChat(doc);
    const before = doc.data.chats[chatId];
    ensureChatExists(doc, chatId);
    expect(doc.data.chats[chatId]).toEqual(before);
  });

  it('adds a user message, replacing prior messages', () => {
    const doc = createDoc({ files: {} });
    const chatId = seedChat(doc);
    addUserMessage(doc, chatId, 'first');
    addUserMessage(doc, chatId, 'second');
    const messages = doc.data.chats[chatId].messages;
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({
      role: 'user',
      content: 'second',
    });
  });
});

describe('chatOperations: AI status and scratchpad', () => {
  it('sets and clears the AI status', () => {
    const doc = createDoc({ files: {} });
    const chatId = seedChat(doc);

    setAIStatus(doc, chatId, 'Thinking...');
    expect(doc.data.chats[chatId].aiStatus).toBe(
      'Thinking...',
    );

    setAIStatus(doc, chatId, undefined);
    expect('aiStatus' in doc.data.chats[chatId]).toBe(
      false,
    );
  });

  it('updates the scratchpad and clears it with a status', () => {
    const doc = createDoc({ files: {} });
    const chatId = seedChat(doc);

    updateAIScratchpad(doc, chatId, 'reasoning...');
    expect(doc.data.chats[chatId].aiScratchpad).toBe(
      'reasoning...',
    );

    clearAIScratchpadAndStatus(doc, chatId, 'Done');
    expect(doc.data.chats[chatId].aiStatus).toBe('Done');
    expect('aiScratchpad' in doc.data.chats[chatId]).toBe(
      false,
    );
  });

  it('finalizeAIMessage clears scratchpad and status', () => {
    const doc = createDoc({ files: {} });
    const chatId = seedChat(doc);
    setAIStatus(doc, chatId, 'Thinking...');
    updateAIScratchpad(doc, chatId, 'reasoning...');

    finalizeAIMessage(doc, chatId);
    expect('aiScratchpad' in doc.data.chats[chatId]).toBe(
      false,
    );
    expect('aiStatus' in doc.data.chats[chatId]).toBe(
      false,
    );
  });

  it('persists chat AI metadata, and ignores empty metadata', () => {
    const doc = createDoc({ files: {} });
    const chatId = seedChat(doc);

    setChatAIMetadata(doc, chatId, {});
    expect(doc.ops).toHaveLength(2); // only the two ensure ops

    setChatAIMetadata(doc, chatId, {
      baseCommitId: 'abc',
      escalationLevel: 2,
    });
    expect(doc.data.chats[chatId]).toMatchObject({
      baseCommitId: 'abc',
      escalationLevel: 2,
    });
  });
});

describe('chatOperations: AI messages', () => {
  it('creates an assistant message and returns its id', () => {
    const doc = createDoc({ files: {} });
    const chatId = seedChat(doc);
    const id = createAIMessage(doc, chatId);
    const messages = doc.data.chats[chatId].messages;
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({
      id,
      role: 'assistant',
      content: '',
    });
  });

  it('updates the content of a specific AI message', () => {
    const doc = createDoc({ files: {} });
    const chatId = seedChat(doc);
    const id = createAIMessage(doc, chatId);
    updateAIMessageContent(doc, chatId, id, 'hello');
    expect(doc.data.chats[chatId].messages[0].content).toBe(
      'hello',
    );
  });

  it('warns and does nothing when the message id is unknown', () => {
    const doc = createDoc({ files: {} });
    const chatId = seedChat(doc);
    const warn = vi
      .spyOn(console, 'warn')
      .mockImplementation(() => {});
    updateAIMessageContent(doc, chatId, 'nope', 'x');
    expect(warn).toHaveBeenCalled();
    expect(doc.data.chats[chatId].messages).toEqual([]);
  });

  it('adds diff data to an explicit AI message', () => {
    const doc = createDoc({ files: {} });
    const chatId = seedChat(doc);
    const id = createAIMessage(doc, chatId);
    addDiffToAIMessage(
      doc,
      chatId,
      { f1: 'diff' },
      'commit-1',
      id,
    );
    expect(
      doc.data.chats[chatId].messages[0],
    ).toMatchObject({
      diffData: { f1: 'diff' },
      beforeCommitId: 'commit-1',
    });
  });

  it('adds a legacy AI message and clears the AI status', () => {
    const doc = createDoc({ files: {} });
    const chatId = seedChat(doc);
    setAIStatus(doc, chatId, 'Thinking...');
    addAIMessage(doc, chatId, 'done');
    const messages = doc.data.chats[chatId].messages;
    expect(messages[0]).toMatchObject({
      role: 'assistant',
      content: 'done',
    });
    expect('aiStatus' in doc.data.chats[chatId]).toBe(
      false,
    );
  });
});

describe('chatOperations: streaming messages', () => {
  it('creates, updates, and finalizes a streaming message', () => {
    const doc = createDoc({ files: {} });
    const chatId = seedChat(doc);

    const id = createStreamingAIMessage(doc, chatId);
    let chat = doc.data.chats[chatId];
    expect(chat.isStreaming).toBe(true);
    expect(chat.messages[0]).toMatchObject({
      id,
      role: 'assistant',
      isProgressive: true,
      streamingEvents: [],
    });

    addStreamingEvent(doc, chatId, {
      type: 'text_chunk',
      content: 'hi',
    });
    chat = doc.data.chats[chatId];
    expect(chat.messages[0].streamingEvents).toEqual([
      { type: 'text_chunk', content: 'hi' },
    ]);

    updateStreamingStatus(doc, chatId, 'Editing...');
    chat = doc.data.chats[chatId];
    expect(chat.currentStatus).toBe('Editing...');
    expect(chat.isStreaming).toBe(true);

    finalizeStreamingMessage(doc, chatId);
    chat = doc.data.chats[chatId];
    expect(chat.currentStatus).toBe('Done');
    expect(chat.isStreaming).toBe(false);
    expect(chat.messages[0].isComplete).toBe(true);
  });
});

describe('chatOperations: files', () => {
  it('updates files and resolves file ids by name', () => {
    const doc = createDoc({ files: {} });
    updateFiles(doc, {
      id1: { name: 'a.js', text: 'a' },
      id2: { name: 'b.js', text: 'b' },
    });
    expect(resolveFileId('b.js', doc)).toBe('id2');
    expect(resolveFileId('missing.js', doc)).toBeNull();
  });

  it('creates a new empty file and returns its id', () => {
    const doc = createDoc({ files: {} });
    const id = createNewFile(doc, 'new.js');
    expect(doc.data.files[id]).toEqual({
      name: 'new.js',
      text: '',
    });
  });
});
