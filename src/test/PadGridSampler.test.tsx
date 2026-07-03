import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PadGridSampler } from '../components/Deck/PadGridSampler';
import { useSamplerStore } from '../store/samplerStore';
import * as samplerEngine from '../services/samplerEngine';

describe('PadGridSampler', () => {
  beforeEach(() => {
    useSamplerStore.setState({ slots: { A: Array(8).fill(null), B: Array(8).fill(null) } });
    vi.restoreAllMocks();
  });

  it('renders 8 empty slots by default', () => {
    render(<PadGridSampler deckId="A" />);
    expect(screen.getByRole('button', { name: /sample slot 1 on deck a: empty/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sample slot 8 on deck a: empty/i })).toBeInTheDocument();
  });

  it('dropping a valid audio file onto an empty slot loads it', () => {
    render(<PadGridSampler deckId="A" />);
    const pad = screen.getByRole('button', { name: /sample slot 3 on deck a: empty/i });
    const file = new File([new Uint8Array([1])], 'kick.wav', { type: 'audio/wav' });
    fireEvent.drop(pad, { dataTransfer: { files: [file] } });
    expect(useSamplerStore.getState().slots.A[2]?.decoding).toBe(true);
  });

  it('dropping an invalid file does not load it', () => {
    render(<PadGridSampler deckId="A" />);
    const pad = screen.getByRole('button', { name: /sample slot 1 on deck a: empty/i });
    const file = new File([new Uint8Array([1])], 'not-audio.txt', { type: 'text/plain' });
    fireEvent.drop(pad, { dataTransfer: { files: [file] } });
    expect(useSamplerStore.getState().slots.A[0]).toBeNull();
  });

  it('clicking a loaded pad triggers playback', () => {
    const playSpy = vi.spyOn(samplerEngine, 'playSample').mockImplementation(() => {});
    const buffer = { duration: 1 } as AudioBuffer;
    useSamplerStore.getState().restoreSlot('A', 4, {
      fileName: 'clap.wav', file: new File([], 'clap.wav'), buffer, decoding: false, decodeError: null,
    });
    render(<PadGridSampler deckId="A" />);
    fireEvent.click(screen.getByRole('button', { name: /sample slot 5 on deck a: clap.wav/i }));
    expect(playSpy).toHaveBeenCalledWith('A', 4, buffer);
  });

  it('right-clicking a loaded pad clears it', () => {
    const buffer = { duration: 1 } as AudioBuffer;
    useSamplerStore.getState().restoreSlot('A', 6, {
      fileName: 'hat.wav', file: new File([], 'hat.wav'), buffer, decoding: false, decodeError: null,
    });
    render(<PadGridSampler deckId="A" />);
    fireEvent.contextMenu(screen.getByRole('button', { name: /sample slot 7 on deck a: hat.wav/i }));
    expect(useSamplerStore.getState().slots.A[6]).toBeNull();
  });

  it('moving the SAMPLE VOL slider calls setSamplerVolume', () => {
    const volSpy = vi.spyOn(samplerEngine, 'setSamplerVolume').mockImplementation(() => {});
    render(<PadGridSampler deckId="A" />);
    fireEvent.change(screen.getByRole('slider', { name: /sample volume for deck a/i }), { target: { value: '60' } });
    expect(volSpy).toHaveBeenCalledWith('A', 60);
  });
});
