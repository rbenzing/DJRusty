import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { HeadphoneMixKnob } from '../components/Mixer/HeadphoneMixKnob';
import { useSettingsStore } from '../store/settingsStore';

vi.mock('../services/cueEngine', () => ({
  cueEngine: {
    setHeadphoneMix: vi.fn(),
    setHeadphoneDeviceId: vi.fn().mockResolvedValue(undefined),
  },
}));

describe('HeadphoneMixKnob', () => {
  beforeEach(() => {
    useSettingsStore.setState({ headphoneMix: 0.5 });
  });

  it('renders the current headphoneMix value as a slider', () => {
    render(<HeadphoneMixKnob />);
    expect(screen.getByRole('slider', { name: /cue\/mix/i })).toHaveAttribute('aria-valuenow', '0.5');
  });

  it('calls setHeadphoneMix when dragged', () => {
    render(<HeadphoneMixKnob />);
    const slider = screen.getByRole('slider', { name: /cue\/mix/i });
    fireEvent.change(slider, { target: { value: '0.8' } });
    expect(useSettingsStore.getState().headphoneMix).toBe(0.8);
  });

  it('shows "Full CUE" label near 0', () => {
    useSettingsStore.setState({ headphoneMix: 0 });
    render(<HeadphoneMixKnob />);
    expect(screen.getByRole('slider', { name: /cue\/mix/i })).toHaveAttribute('aria-valuetext', 'Full CUE');
  });

  it('shows "Full program" label near 1', () => {
    useSettingsStore.setState({ headphoneMix: 1 });
    render(<HeadphoneMixKnob />);
    expect(screen.getByRole('slider', { name: /cue\/mix/i })).toHaveAttribute('aria-valuetext', 'Full program');
  });
});
