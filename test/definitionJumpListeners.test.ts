import { describe, expect, it, vi } from 'vitest';
import { createDefinitionJumpListeners } from '../src/client/definitionJumpListeners';

describe('definition jump listeners', () => {
  it('installs once, arms one click, and fully stops on Ctrl release', () => {
    const target = new EventTarget();
    const hover = vi.fn();
    const click = vi.fn();
    const listeners = createDefinitionJumpListeners(target, hover, click);
    listeners.start();
    listeners.start();
    listeners.armClick();
    listeners.armClick();
    target.dispatchEvent(new Event('mouseover'));
    target.dispatchEvent(new Event('mousedown'));
    target.dispatchEvent(new Event('mousedown'));
    expect(hover).toHaveBeenCalledTimes(1);
    expect(click).toHaveBeenCalledTimes(1);
    listeners.stop();
    target.dispatchEvent(new Event('mouseover'));
    target.dispatchEvent(new Event('mousedown'));
    expect(hover).toHaveBeenCalledTimes(1);
    expect(click).toHaveBeenCalledTimes(1);
  });

  it('isolates two editors and removes an armed click on teardown', () => {
    const target = new EventTarget();
    const a = vi.fn();
    const b = vi.fn();
    const first = createDefinitionJumpListeners(target, vi.fn(), a);
    const second = createDefinitionJumpListeners(target, vi.fn(), b);
    first.start();
    second.start();
    first.armClick();
    second.armClick();
    first.stop(); // unmount first editor
    target.dispatchEvent(new Event('mousedown'));
    expect(a).not.toHaveBeenCalled();
    expect(b).toHaveBeenCalledTimes(1);
    second.stop();
    second.armClick();
    second.stop(); // cleanup also removes a pending mouse listener
    target.dispatchEvent(new Event('mousedown'));
    expect(b).toHaveBeenCalledTimes(1);
  });
});
