// From https://github.com/vizhub-core/vizhub/commit/6ca078935b9771dc6e05a6065bcfd522a4724dcf
import { useEffect, useState } from 'react';
import './AIAssistWidget/style.scss';

// const minRadius = 4;
// const maxRadius = 10;
// const numDots = 8;
// const wheelRadius = 40;
// const round = (number) => Math.floor(number * 100) / 100;
// const dots = [];
// for (let i = 0; i < numDots; i++) {
//   const angle = (i / numDots) * Math.PI * 2;
//   dots.push({
//     x: round(Math.cos(angle) * wheelRadius),
//     y: round(Math.sin(angle) * wheelRadius),
//     r: round(
//       minRadius +
//         (i / (numDots - 1)) * (maxRadius - minRadius),
//     ),
//   });
// }
// console.log(JSON.stringify(dots));

// Hardcoded to avoid the computation.
const dots = [
  { x: 40, y: 0, r: 4 },
  { x: 28.28, y: 28.28, r: 4.85 },
  { x: 0, y: 40, r: 5.71 },
  { x: -28.29, y: 28.28, r: 6.57 },
  { x: -40, y: 0, r: 7.42 },
  { x: -28.29, y: -28.29, r: 8.28 },
  { x: -0.01, y: -40, r: 9.14 },
  { x: 28.28, y: -28.29, r: 10 },
];

// From https://bl.ocks.org/curran/685fa8300650c4324d571c6b0ecc55de
// And vizhub-v2/packages/neoFrontend/src/LoadingScreen/index.js
export const Spinner = ({
  height = 40,
  fill = 'currentcolor',
  fadeIn = true,
}) => {
  const [show, setShow] = useState(false);

  // Avoid SSR of all the SVG elements.
  useEffect(() => {
    setShow(true);
  }, []);

  return (
    show && (
      <div
        className={`vz-spinner${fadeIn ? ' fade-in' : ''}`}
      >
        <svg
          height={height}
          viewBox="0 0 100 100"
          style={{ opacity: 1 }}
        >
          <g transform="translate(50, 50)" fill={fill}>
            <g className="vz-spinner-dots">
              {dots.map(({ x, y, r }, i) => (
                <circle
                  key={i}
                  cx={x}
                  cy={y}
                  r={r}
                ></circle>
              ))}
            </g>
          </g>
        </svg>
      </div>
    )
  );
};
