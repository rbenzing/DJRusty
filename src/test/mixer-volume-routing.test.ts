/**
 * mixer-volume-routing.test.ts — Regression lock for the crossfader → deck volume seam.
 *
 * Verifies that actions on mixerStore propagate computed volumes into deckStore.
 * Uses relative (greater/less) assertions so the test is robust to the exact
 * equal-power curve and master-volume scaling.
 *
 * Real API used:
 *   - useMixerStore: setCrossfaderPosition, setChannelFaderA, setChannelFaderB
 *   - useMixerStore state: crossfaderPosition, channelFaderA, channelFaderB
 *   - useSettingsStore: masterVolume field (reset via setState)
 *   - useDeckStore: decks.A.volume, decks.B.volume
 *   - Crossfader convention: 0.0 = full A, 1.0 = full B
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useMixerStore } from '../store/mixerStore';
import { useDeckStore } from '../store/deckStore';
import { useSettingsStore } from '../store/settingsStore';

describe('crossfader → deck volume routing', () => {
  beforeEach(() => {
    // Ensure master volume is at full so scaling doesn't suppress either deck
    useSettingsStore.setState({ masterVolume: 100 });
    // Reset mixer to known state: both channel faders at max, crossfader centred
    useMixerStore.setState({
      channelFaderA: 100,
      channelFaderB: 100,
      crossfaderPosition: 0.5,
    });
  });

  it('hard-A (0.0) → deck A volume > deck B volume', () => {
    useMixerStore.getState().setCrossfaderPosition(0);
    const { A, B } = useDeckStore.getState().decks;
    expect(A.volume).toBeGreaterThan(B.volume);
  });

  it('hard-B (1.0) → deck B volume > deck A volume', () => {
    useMixerStore.getState().setCrossfaderPosition(1);
    const { A, B } = useDeckStore.getState().decks;
    expect(B.volume).toBeGreaterThan(A.volume);
  });

  it('hard-A (0.0) → A.volume > B.volume; hard-B (1.0) → B.volume > A.volume (combined)', () => {
    useMixerStore.getState().setCrossfaderPosition(0);
    let { A, B } = useDeckStore.getState().decks;
    expect(A.volume).toBeGreaterThan(B.volume);

    useMixerStore.getState().setCrossfaderPosition(1);
    ({ A, B } = useDeckStore.getState().decks);
    expect(B.volume).toBeGreaterThan(A.volume);
  });

  it('lowering channel fader A reduces deck A volume', () => {
    useMixerStore.getState().setCrossfaderPosition(0.5);
    useMixerStore.getState().setChannelFaderA(100);
    const high = useDeckStore.getState().decks.A.volume;

    useMixerStore.getState().setChannelFaderA(20);
    const low = useDeckStore.getState().decks.A.volume;

    expect(low).toBeLessThan(high);
  });

  it('lowering channel fader B reduces deck B volume', () => {
    useMixerStore.getState().setCrossfaderPosition(0.5);
    useMixerStore.getState().setChannelFaderB(100);
    const high = useDeckStore.getState().decks.B.volume;

    useMixerStore.getState().setChannelFaderB(20);
    const low = useDeckStore.getState().decks.B.volume;

    expect(low).toBeLessThan(high);
  });

  it('channel fader A changes do not affect deck B volume', () => {
    useMixerStore.getState().setCrossfaderPosition(0.5);
    useMixerStore.getState().setChannelFaderB(100);
    const bBefore = useDeckStore.getState().decks.B.volume;

    useMixerStore.getState().setChannelFaderA(10);
    const bAfter = useDeckStore.getState().decks.B.volume;

    expect(bAfter).toBe(bBefore);
  });

  it('channel fader B changes do not affect deck A volume', () => {
    useMixerStore.getState().setCrossfaderPosition(0.5);
    useMixerStore.getState().setChannelFaderA(100);
    const aBefore = useDeckStore.getState().decks.A.volume;

    useMixerStore.getState().setChannelFaderB(10);
    const aAfter = useDeckStore.getState().decks.A.volume;

    expect(aAfter).toBe(aBefore);
  });
});
