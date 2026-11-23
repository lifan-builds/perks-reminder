import { cn } from '@/lib/utils';

interface GuillocheRosetteProps {
  className?: string;
  rings?: number;
  petals?: number;
  seed?: number;
}

function ringPath(ring: number, petals: number, seed: number): string {
  const base = 70 + ring * 13;
  const amplitude = 16 + ring * 1.6;
  const phase = ring * 0.19 + seed;
  const steps = 360;
  let path = '';
  for (let step = 0; step <= steps; step += 1) {
    const angle = (step / steps) * Math.PI * 2;
    const radius = base + amplitude * Math.sin(petals * angle + phase) + 5 * Math.cos(3 * petals * angle - phase);
    const x = 300 + radius * Math.cos(angle);
    const y = 300 + radius * Math.sin(angle);
    path += `${step === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`;
  }
  return `${path}Z`;
}

/** Procedural security-printing rosette; strokes inherit `currentColor`. */
export default function GuillocheRosette({ className, rings = 16, petals = 11, seed = 0 }: GuillocheRosetteProps) {
  return (
    <svg viewBox="0 0 600 600" aria-hidden="true" focusable="false" className={cn('pointer-events-none', className)}>
      <g fill="none" stroke="currentColor" strokeWidth="0.8">
        {Array.from({ length: rings }, (_, ring) => (
          <path key={ring} d={ringPath(ring, petals, seed)} opacity={ring % 4 === 0 ? 0.9 : 0.42} />
        ))}
        <circle cx="300" cy="300" r="58" opacity="0.5" />
        <circle cx="300" cy="300" r="290" opacity="0.35" strokeDasharray="1 3" />
      </g>
    </svg>
  );
}
