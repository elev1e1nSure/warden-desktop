import { useMemo } from "react";

type StarLayerProps = {
  className: string;
  count: number;
  size: number;
  blur: number;
  speed: string;
  opacity: number;
  seed: number;
};

function makeRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function buildStarShadow(count: number, size: number, blur: number, seed: number) {
  const rand = makeRandom(seed);
  const max = 2000;
  const stars: string[] = [];

  for (let i = 0; i < count; i += 1) {
    const x = Math.floor(rand() * max);
    const y = Math.floor(rand() * max);
    const alpha = (0.7 + rand() * 0.3).toFixed(2);
    stars.push(`${x}px ${y}px ${blur}px rgba(255, 255, 255, ${alpha})`);
  }

  return {
    boxShadow: stars.join(", "),
    width: `${size}px`,
    height: `${size}px`,
  };
}

function StarLayer({ className, count, size, blur, speed, opacity, seed }: StarLayerProps) {
  const starStyle = useMemo(
    () => buildStarShadow(count, size, blur, seed),
    [count, seed, size, blur],
  );

  return (
    <div className={`starfield-layer ${className}`} style={{ opacity, animationDuration: speed }}>
      <div className="starfield-sprite" style={starStyle} />
      <div className="starfield-sprite starfield-sprite-copy" style={starStyle} />
    </div>
  );
}

export default function StarfieldBackdrop() {
  return (
    <div className="starfield-backdrop" aria-hidden="true">
      <StarLayer
        className="starfield-layer-sm"
        count={320}
        size={1.5}
        blur={0.5}
        speed="50s"
        opacity={1.0}
        seed={11}
      />
      <StarLayer
        className="starfield-layer-md"
        count={120}
        size={2.5}
        blur={1.0}
        speed="100s"
        opacity={0.9}
        seed={29}
      />
      <StarLayer
        className="starfield-layer-lg"
        count={50}
        size={4}
        blur={2.0}
        speed="150s"
        opacity={0.8}
        seed={53}
      />
    </div>
  );
}
