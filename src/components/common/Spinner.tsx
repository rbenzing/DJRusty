/**
 * Spinner.tsx — CSS animated loading indicator.
 * Stub for STORY-001. Full implementation in STORY-004.
 */

interface SpinnerProps {
  label?: string;
}

export function Spinner({ label = 'Loading...' }: SpinnerProps) {
  return (
    <div className="spinner" role="status" aria-label={label}>
      <span className="sr-only">{label}</span>
    </div>
  );
}

export default Spinner;
