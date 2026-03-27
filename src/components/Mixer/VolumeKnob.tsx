/**
 * VolumeKnob.tsx — Per-deck gain rotary knob.
 * Stub for STORY-001. Full implementation in STORY-006.
 */

interface VolumeKnobProps {
  deckId: 'A' | 'B';
}

export function VolumeKnob({ deckId: _deckId }: VolumeKnobProps) {
  return <div className="volume-knob" />;
}

export default VolumeKnob;
