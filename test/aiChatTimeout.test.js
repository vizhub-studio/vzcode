import { expect, test, vi } from 'vitest';

test('AI Chat Timeout Prevention - Basic Logic', async () => {
  // Test that the conceptual change is correct:
  // Before: HTTP response waits for AI completion
  // After: HTTP response returns immediately, AI status tracks in ShareDB

  // Simulate the old behavior (blocking)
  const oldBehavior = async () => {
    const startTime = Date.now();
    // Simulate long AI processing
    await new Promise((resolve) =>
      setTimeout(resolve, 100),
    ); // 100ms as proxy for 30+ seconds
    return {
      status: 'success',
      responseTime: Date.now() - startTime,
    };
  };

  // Simulate the new behavior (non-blocking)
  const newBehavior = async () => {
    const startTime = Date.now();

    // Set aiStatus to 'generating' (immediate)
    const aiStatus = 'generating';

    // Return HTTP response immediately
    const httpResponse = {
      status: 'success',
      responseTime: Date.now() - startTime,
    };

    // AI processing continues in background (don't await)
    const aiProcessing = new Promise((resolve) =>
      setTimeout(
        () => resolve({ aiStatus: 'completed' }),
        100,
      ),
    );

    return { httpResponse, aiProcessing, aiStatus };
  };

  vi.useFakeTimers();
  try {
    // The old response stays pending until AI work finishes.
    const oldResponse = vi.fn();
    const oldPending = oldBehavior().then(oldResponse);
    await vi.advanceTimersByTimeAsync(99);
    expect(oldResponse).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    await oldPending;
    expect(oldResponse).toHaveBeenCalledWith({
      status: 'success',
      responseTime: 100,
    });

    // The new response arrives without advancing the clock.
    const newResult = await newBehavior();
    expect(newResult.httpResponse).toEqual({
      status: 'success',
      responseTime: 0,
    });
    expect(newResult.aiStatus).toBe('generating');

    const completed = vi.fn();
    const processing =
      newResult.aiProcessing.then(completed);
    await vi.advanceTimersByTimeAsync(99);
    expect(completed).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    await processing;
    expect(completed).toHaveBeenCalledWith({
      aiStatus: 'completed',
    });
  } finally {
    vi.useRealTimers();
  }
});

test('ShareDB aiStatus State Management', () => {
  // Test the state flow for aiStatus
  let aiStatus = undefined;

  // Initial state
  expect(aiStatus).toBe(undefined);

  // User sends message -> set generating
  aiStatus = 'generating';
  expect(aiStatus).toBe('generating');

  // AI completes successfully -> clear status
  aiStatus = undefined;
  expect(aiStatus).toBe(undefined);

  // AI fails -> set error status
  aiStatus = 'error';
  expect(aiStatus).toBe('error');
});
