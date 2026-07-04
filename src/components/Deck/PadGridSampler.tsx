/**
 * PadGridSampler.tsx — SAMPLER pad-mode panel, rendered inside PadGrid.
 *
 * 8 one-shot sample slots in a 2x4 grid, plus a SAMPLE VOL slider for this
 * deck's dedicated gain bus (independent of the channel fader/crossfader,
 * still scaled by MASTER — see samplerEngine.ts). Empty slots accept a
 * dropped file or open a file picker on click; loaded slots trigger
 * playback on click and clear on right-click. Slots are deck-scoped, not
 * track-scoped — this reads samplerStore, entirely separate from deckStore,
 * so loadTrack/clearTrack never touch them.
 *
 * File-type/size validation happens here (mirroring FileImportZone's own
 * validate-then-delegate pattern) — samplerStore.loadFile always attempts
 * to decode whatever it's given.
 */
import { useEffect, useRef, useState } from 'react';
import type { DragEvent } from 'react';
import { useSamplerStore } from '../../store/samplerStore';
import { playSample, setSamplerVolume, getSamplerVolume } from '../../services/samplerEngine';
import styles from './PadGridSampler.module.css';

const SLOT_COUNT = 8;
const MAX_FILE_SIZE_BYTES = 500 * 1024 * 1024; // 500 MB, matches FileImportZone
const REJECTED_FLASH_MS = 2000;

interface PadGridSamplerProps {
  deckId: 'A' | 'B';
}

function isAudioType(type: string): boolean {
  return type.startsWith('audio/');
}

export function PadGridSampler({ deckId }: PadGridSamplerProps) {
  const slots = useSamplerStore((s) => s.slots[deckId]);
  const [volume, setVolume] = useState(() => getSamplerVolume(deckId));
  const [dragoverIndex, setDragoverIndex] = useState<number | null>(null);
  const [rejectedIndex, setRejectedIndex] = useState<number | null>(null);
  const pendingSlotIndex = useRef<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const rejectedTimerRef = useRef<number | null>(null);

  // Cancel any pending "rejected file" flash timer on unmount to prevent a
  // setState call on an unmounted component (mirrors HotCueButton.tsx/TapTempo.tsx).
  useEffect(() => {
    return () => {
      if (rejectedTimerRef.current !== null) {
        clearTimeout(rejectedTimerRef.current);
        rejectedTimerRef.current = null;
      }
    };
  }, []);

  function acceptFile(slotIndex: number, file: File): void {
    if (!isAudioType(file.type) || file.size > MAX_FILE_SIZE_BYTES) {
      setRejectedIndex(slotIndex);
      if (rejectedTimerRef.current !== null) clearTimeout(rejectedTimerRef.current);
      rejectedTimerRef.current = window.setTimeout(() => {
        setRejectedIndex((cur) => (cur === slotIndex ? null : cur));
        rejectedTimerRef.current = null;
      }, REJECTED_FLASH_MS);
      return;
    }
    setRejectedIndex(null);
    void useSamplerStore.getState().loadFile(deckId, slotIndex, file);
  }

  function handlePadClick(slotIndex: number): void {
    const slot = slots[slotIndex];
    if (slot?.buffer) {
      playSample(deckId, slotIndex, slot.buffer);
      return;
    }
    if (!slot) {
      pendingSlotIndex.current = slotIndex;
      inputRef.current?.click();
    }
  }

  function handlePadContextMenu(e: React.MouseEvent, slotIndex: number): void {
    e.preventDefault();
    if (slots[slotIndex]) {
      useSamplerStore.getState().clearSlot(deckId, slotIndex);
    }
  }

  function handleDrop(e: DragEvent<HTMLButtonElement>, slotIndex: number): void {
    e.preventDefault();
    setDragoverIndex(null);
    const file = e.dataTransfer.files[0];
    if (file) acceptFile(slotIndex, file);
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>): void {
    const file = e.target.files?.[0];
    const slotIndex = pendingSlotIndex.current;
    if (file && slotIndex !== null) acceptFile(slotIndex, file);
    e.target.value = '';
    pendingSlotIndex.current = null;
  }

  function handleVolumeChange(e: React.ChangeEvent<HTMLInputElement>): void {
    const v = Number(e.target.value);
    setVolume(v);
    setSamplerVolume(deckId, v);
  }

  return (
    <div className={styles.wrapper}>
      <input
        ref={inputRef}
        type="file"
        accept=".mp3,.wav,.flac,.ogg,.m4a,.aac,audio/*"
        className={styles.hiddenInput}
        onChange={handleInputChange}
        aria-hidden="true"
        tabIndex={-1}
      />
      <div className={styles.volumeRow}>
        <span className={styles.volumeLabel}>SAMPLE VOL</span>
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={volume}
          onChange={handleVolumeChange}
          aria-label={`Sample volume for Deck ${deckId}`}
        />
      </div>
      <div className={styles.pads}>
        {Array.from({ length: SLOT_COUNT }, (_, index) => {
          const slot = slots[index];
          const isEmpty = !slot;
          const isDecoding = slot?.decoding ?? false;
          const hasError = !!slot?.decodeError;
          const isLoaded = !!slot?.buffer;
          const isDragover = dragoverIndex === index;
          const isRejected = rejectedIndex === index;

          const label = isEmpty
            ? `Sample slot ${index + 1} on Deck ${deckId}: empty. Click or drop a file to load.`
            : isDecoding
              ? `Sample slot ${index + 1} on Deck ${deckId}: decoding ${slot.fileName}.`
              : hasError
                ? `Sample slot ${index + 1} on Deck ${deckId}: failed to decode ${slot.fileName}.`
                : `Sample slot ${index + 1} on Deck ${deckId}: ${slot.fileName}. Click to play, right-click to clear.`;

          return (
            <button
              key={index}
              type="button"
              className={[
                styles.pad,
                isLoaded ? styles.padLoaded : '',
                (hasError || isRejected) ? styles.padError : '',
                isDragover ? styles.padDragover : '',
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={() => handlePadClick(index)}
              onContextMenu={(e) => handlePadContextMenu(e, index)}
              onDragOver={(e) => { e.preventDefault(); setDragoverIndex(index); }}
              onDragLeave={() => setDragoverIndex((cur) => (cur === index ? null : cur))}
              onDrop={(e) => handleDrop(e, index)}
              aria-label={label}
              title={label}
            >
              {isDecoding ? '…' : hasError ? '⚠' : isEmpty ? `${index + 1}` : slot.fileName}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default PadGridSampler;
