/** Pure AI chat behavior shared by the built-in session and unit tests. */
export const shouldReuseChatId = (
  options?: Record<string, string>,
): boolean =>
  options?.isRetry === 'true' || options?.isUndo === 'true';

export const userMessageHistory = (
  messages?: ReadonlyArray<{
    role: string;
    content: string;
  }> | null,
): string[] =>
  messages
    ? messages
        .filter((message) => message.role === 'user')
        .map((message) => message.content)
    : [];
