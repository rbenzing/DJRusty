import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { VinylPlatter } from '../components/Deck/VinylPlatter';
import styles from '../components/Deck/VinylPlatter.module.css';

describe('VinylPlatter', () => {
  it('renders a spin marker element inside the platter', () => {
    const { container } = render(
      <VinylPlatter isPlaying={false} isBuffering={false} pitchRate={1} thumbnailUrl={null} />,
    );
    expect(container.querySelector(`.${styles.spinMarker}`)).toBeInTheDocument();
  });

  it('renders the spin marker as a child of the platter (so it inherits the platter\'s rotation transform)', () => {
    const { container } = render(
      <VinylPlatter isPlaying={false} isBuffering={false} pitchRate={1} thumbnailUrl={null} />,
    );
    const platter = container.querySelector(`.${styles.platter}`);
    const marker = container.querySelector(`.${styles.spinMarker}`);
    expect(platter).toContainElement(marker as HTMLElement);
  });

  it('does not throw when rendered mid-scratch with a rotation override', () => {
    expect(() =>
      render(
        <VinylPlatter isPlaying={false} isBuffering={false} pitchRate={1} thumbnailUrl={null} rotationOverrideDeg={57} />,
      ),
    ).not.toThrow();
  });
});
