/**
 * SettingsModal.test.tsx — Phase 4: headphone output-device picker.
 *
 * Focused on the NEW device-picker behavior only; the modal's pre-existing
 * Master Volume / crossfader-curve / About sections are not covered here.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SettingsModal } from '../components/Auth/SettingsModal';
import { useSettingsStore } from '../store/settingsStore';

vi.mock('../services/cueEngine', () => ({
  cueEngine: {
    isOutputDeviceSelectionSupported: vi.fn(),
    setHeadphoneMix: vi.fn(),
    setHeadphoneDeviceId: vi.fn().mockResolvedValue(undefined),
  },
}));

import { cueEngine } from '../services/cueEngine';

const mockGetUserMedia = vi.fn();
const mockEnumerateDevices = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  useSettingsStore.setState({
    isSettingsOpen: false,
    headphoneDeviceId: null,
    availableOutputDevices: [],
    outputDeviceLabelsUnlocked: false,
  });
  Object.defineProperty(navigator, 'mediaDevices', {
    value: { getUserMedia: mockGetUserMedia, enumerateDevices: mockEnumerateDevices },
    configurable: true,
  });
  mockEnumerateDevices.mockResolvedValue([
    { deviceId: 'd1', label: 'Speakers', kind: 'audiooutput', groupId: 'g1' },
    { deviceId: 'd2', label: 'Headphones', kind: 'audiooutput', groupId: 'g2' },
    { deviceId: 'm1', label: 'Microphone', kind: 'audioinput', groupId: 'g3' },
  ]);
  mockGetUserMedia.mockResolvedValue({ getTracks: () => [{ stop: vi.fn() }] });
});

describe('SettingsModal — device picker (supported browser)', () => {
  beforeEach(() => {
    vi.mocked(cueEngine.isOutputDeviceSelectionSupported).mockReturnValue(true);
  });

  it('shows the device select populated with audiooutput devices only, once open', async () => {
    useSettingsStore.setState({ isSettingsOpen: true });
    render(<SettingsModal />);

    await waitFor(() => {
      expect(screen.getByLabelText('Headphone Output')).toBeInTheDocument();
    });
    expect(screen.getByText('Speakers')).toBeInTheDocument();
    expect(screen.getByText('Headphones')).toBeInTheDocument();
    expect(screen.queryByText('Microphone')).not.toBeInTheDocument();
  });

  it('requests mic permission once to unlock labels, then marks it unlocked', async () => {
    useSettingsStore.setState({ isSettingsOpen: true });
    render(<SettingsModal />);

    await waitFor(() => expect(mockGetUserMedia).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(useSettingsStore.getState().outputDeviceLabelsUnlocked).toBe(true));
  });

  it('falls back to enumerating without persisting a permission denial', async () => {
    mockGetUserMedia.mockRejectedValue(new Error('denied'));
    useSettingsStore.setState({ isSettingsOpen: true });
    render(<SettingsModal />);

    await waitFor(() => {
      expect(screen.getByText('Speakers')).toBeInTheDocument();
    });
    expect(useSettingsStore.getState().outputDeviceLabelsUnlocked).toBe(false);
  });

  it('calls setHeadphoneDeviceId when a device is selected', async () => {
    useSettingsStore.setState({ isSettingsOpen: true });
    render(<SettingsModal />);

    await waitFor(() => screen.getByLabelText('Headphone Output'));
    fireEvent.change(screen.getByLabelText('Headphone Output'), { target: { value: 'd2' } });
    expect(useSettingsStore.getState().headphoneDeviceId).toBe('d2');
  });
});

describe('SettingsModal — device picker (unsupported browser)', () => {
  beforeEach(() => {
    vi.mocked(cueEngine.isOutputDeviceSelectionSupported).mockReturnValue(false);
  });

  it('shows the fallback note instead of a select', () => {
    useSettingsStore.setState({ isSettingsOpen: true });
    render(<SettingsModal />);

    expect(screen.queryByLabelText('Headphone Output')).not.toBeInTheDocument();
    expect(screen.getByText(/not supported in this browser/i)).toBeInTheDocument();
  });

  it('never calls getUserMedia when unsupported', () => {
    useSettingsStore.setState({ isSettingsOpen: true });
    render(<SettingsModal />);
    expect(mockGetUserMedia).not.toHaveBeenCalled();
  });
});
