type MotifShape = "triangle" | "circle" | "square";

type HomeThemeMotifProps = {
  shape: MotifShape;
  className?: string;
};

const marks = [
  { x: 28, y: 28, size: 18, rotate: -12, opacity: 0.24 },
  { x: 92, y: 54, size: 9, rotate: 18, opacity: 0.36 },
  { x: 158, y: 27, size: 25, rotate: 9, opacity: 0.19 },
  { x: 226, y: 72, size: 12, rotate: -28, opacity: 0.31 },

  { x: 52, y: 132, size: 28, rotate: 24, opacity: 0.18 },
  { x: 124, y: 112, size: 11, rotate: -8, opacity: 0.28 },
  { x: 192, y: 148, size: 17, rotate: 34, opacity: 0.23 },
  { x: 258, y: 128, size: 8, rotate: 12, opacity: 0.35 },

  { x: 18, y: 198, size: 10, rotate: 38, opacity: 0.29 },
  { x: 104, y: 202, size: 20, rotate: -18, opacity: 0.21 },
  { x: 170, y: 188, size: 7, rotate: 5, opacity: 0.34 },
  { x: 246, y: 208, size: 24, rotate: 17, opacity: 0.17 },
];

export default function HomeThemeMotif({
  shape,
  className = "",
}: HomeThemeMotifProps) {
  const patternId = `home-theme-motif-${shape}`;

  return (
    <svg
      aria-hidden="true"
      className={className}
      width="100%"
      height="100%"
      fill="none"
    >
      <defs>
        <pattern
          id={patternId}
          width="280"
          height="230"
          patternUnits="userSpaceOnUse"
        >
          {marks.map((mark, index) => {
            const half = mark.size / 2;

            return (
              <g
                key={index}
                opacity={mark.opacity}
                transform={`rotate(${mark.rotate} ${mark.x} ${mark.y})`}
                stroke="currentColor"
                strokeWidth="1.1"
              >
                {shape === "triangle" && (
                  <path
                    d={`
                      M ${mark.x} ${mark.y - half}
                      L ${mark.x + half} ${mark.y + half}
                      L ${mark.x - half} ${mark.y + half}
                      Z
                    `}
                  />
                )}

                {shape === "circle" && (
                  <circle
                    cx={mark.x}
                    cy={mark.y}
                    r={half}
                  />
                )}

                {shape === "square" && (
                  <rect
                    x={mark.x - half}
                    y={mark.y - half}
                    width={mark.size}
                    height={mark.size}
                  />
                )}
              </g>
            );
          })}
        </pattern>
      </defs>

      <rect
        width="100%"
        height="100%"
        fill={`url(#${patternId})`}
      />
    </svg>
  );
}