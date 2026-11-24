import {
  Decoration,
  EditorView,
  ViewPlugin,
  WidgetType,
} from '@codemirror/view';
import { InteractRule } from '@replit/codemirror-interact';

let rotationOrigin: { x: number; y: number } = null;
// Set rotation to the angle between the x-axis and a line
// from the word "rotate" to the mouse pointer (while dragging).
// The rotation is in range (-180,180]
export const rotateWidget = (
  onInteract?: () => void,
): InteractRule => ({
  regexp: /rotate\(-?\d*\.?\d*\)/g,
  cursor: 'move',
  onDragStart(text, setText, e) {
    rotationOrigin = { x: e.clientX, y: e.clientY };
  },

  onDrag(text, setText, e) {
    if (rotationOrigin == null) return;
    const rotationDegree = Math.round(
      (Math.atan2(
        rotationOrigin.y - e.clientY,
        e.clientX - rotationOrigin.x,
      ) *
        180) /
        Math.PI,
    );
    //Calculate the angle between the x axis and a line from where the user first clicks to the current location of the mouse.
    setText(`rotate(${rotationDegree})`);
    const updateDragEvent = new CustomEvent(
      'updateRotateDrag',
      { detail: rotationDegree },
    );

    document.dispatchEvent(updateDragEvent);

    if (onInteract) onInteract();
  },
  onDragEnd() {
    rotationOrigin = null;
  },
});

export const rotationIndicator = ViewPlugin.fromClass(
  class {
    view: EditorView;
    textPosition?: number;
    rotation: number;
    constructor(view) {
      this.view = view;
      this.textPosition = null;
      this.rotation = 0;

      document.addEventListener(
        'updateRotateDrag',
        (event: Event) => {
          const e = event as CustomEvent<number>;
          this.textPosition = this.view.posAtCoords(
            rotationOrigin,
            false,
          );

          this.rotation = e.detail;
        },
      );
    }
  },
  {
    decorations: (v) => {
      if (rotationOrigin === null) {
        return Decoration.none;
      }
      return Decoration.set([
        {
          from: v.textPosition,
          to: v.textPosition,
          value: Decoration.widget({
            side: -1,
            widget: new RotationCircle(v.rotation),
          }),
        },
      ]);
    },
  },
);

class RotationCircle extends WidgetType {
  angle: number;
  constructor(angle: number) {
    super();
    this.angle = angle;
  }

  toDOM(_view: EditorView): HTMLElement {
    const parent = document.createElement('div');

    parent.setAttribute('style', 'width:20px;height:20px');
    parent.className = 'color-circle-parent';
    const svg = document.createElementNS(
      'http://www.w3.org/2000/svg',
      'svg',
    );
    const colorCircle = document.createElementNS(
      'http://www.w3.org/2000/svg',
      'circle',
    );
    colorCircle.setAttributeNS(null, 'fill', '#808080');
    colorCircle.setAttributeNS(null, 'r', '5');
    colorCircle.setAttributeNS(null, 'cx', '5');
    colorCircle.setAttributeNS(null, 'cy', '5');

    const indicatorLine = document.createElementNS(
      'http://www.w3.org/2000/svg',
      'line',
    );
    indicatorLine.setAttributeNS(null, 'x1', '10');
    indicatorLine.setAttributeNS(null, 'x2', '5');
    indicatorLine.setAttributeNS(null, 'y1', '5');
    indicatorLine.setAttributeNS(null, 'y2', '5');
    indicatorLine.setAttributeNS(null, 'stroke', 'black');
    indicatorLine.setAttributeNS(
      null,
      'transform',
      `rotate(${360 - this.angle},5,5)`,
    );

    svg.setAttributeNS(null, 'viewBox', '0 0 10 10');
    svg.setAttributeNS(null, 'width', '20');
    svg.setAttributeNS(null, 'height', '20');

    svg.appendChild(colorCircle);
    svg.appendChild(indicatorLine);

    parent.appendChild(svg);
    return parent;
  }
  ignoreEvent() {
    return false;
  }
}
