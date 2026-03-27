/**
 * RotaryKnob.tsx — Reusable rotary knob: role=slider, drag/scroll interaction.
 * Stub for STORY-001. Full implementation in STORY-012.
 */

interface RotaryKnobProps {
  /** Current value within the range [min, max]. */
  value: number;
  /** Minimum value. Default: -12. */
  min?: number;
  /** Maximum value. Default: 12. */
  max?: number;
  /** Accessible label for the control. */
  label: string;
  /** Size in pixels (width = height). Default: 40. */
  size?: number;
  /** Called when the value changes. */
  onChange: (value: number) => void;
}

export function RotaryKnob({ value, min = -12, max = 12, label, size = 40, onChange: _onChange }: RotaryKnobProps) {
  // Angle range: -135deg to +135deg
  const range = max - min;
  const normalised = (value - min) / range;
  const angle = normalised * 270 - 135;

  return (
    <div
      role="slider"
      aria-label={label}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-valuetext={`${value} dB`}
      tabIndex={0}
      className="rotary-knob"
      style={{ width: size, height: size }}
    >
      <div
        className="rotary-knob__indicator"
        style={{ transform: `rotate(${angle}deg) translateY(-12px)` }}
      />
    </div>
  );
}

export default RotaryKnob;
