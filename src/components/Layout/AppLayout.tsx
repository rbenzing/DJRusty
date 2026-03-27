/**
 * AppLayout.tsx — Main 3-column grid layout with skip link and live regions.
 * Stub for STORY-001. Full implementation in STORY-004.
 */
import type { ReactNode } from 'react';

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <>
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      <div id="main-content" className="app-layout">
        {children}
      </div>
      {/* Live region for accessibility announcements (STORY-014) */}
      <div aria-live="polite" aria-atomic="true" className="sr-only" id="live-region" />
    </>
  );
}

export default AppLayout;
