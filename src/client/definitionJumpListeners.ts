/**
 * An editor owns the temporary Ctrl-hover and Ctrl-click listeners.
 * Keeping their lifecycle together prevents stale DOM handlers when panes
 * switch or VZCode is unmounted.
 */
export function createDefinitionJumpListeners(
  target: EventTarget,
  onHover: (event: MouseEvent) => void,
  onClick: (event: MouseEvent) => void,
) {
  let hovering = false;
  let armed = false;

  const hoverListener: EventListener = (event) => {
    onHover(event as MouseEvent);
  };
  const clickListener: EventListener = (event) => {
    armed = false;
    target.removeEventListener('mousedown', clickListener);
    onClick(event as MouseEvent);
  };

  return {
    start() {
      if (hovering) return;
      hovering = true;
      target.addEventListener('mouseover', hoverListener);
    },
    armClick() {
      if (armed) return;
      armed = true;
      target.addEventListener('mousedown', clickListener);
    },
    stop() {
      hovering = false;
      armed = false;
      target.removeEventListener('mouseover', hoverListener);
      target.removeEventListener('mousedown', clickListener);
    },
  };
}
