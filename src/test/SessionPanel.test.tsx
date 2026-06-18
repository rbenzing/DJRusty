import { it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SessionPanel } from '../components/Session/SessionPanel';

vi.mock('../services/sessionStore', () => ({
  saveSession: vi.fn().mockResolvedValue(undefined),
  loadSession: vi.fn().mockResolvedValue(undefined),
  deleteSession: vi.fn().mockResolvedValue(undefined),
  listSessions: vi.fn().mockResolvedValue([
    { name: 'Friday Night', savedAt: 1000000, trackCount: 3 },
  ]),
}));

beforeEach(() => { vi.clearAllMocks(); });

it('shows the saved session list and a save form', async () => {
  render(<SessionPanel />);
  await waitFor(() => expect(screen.getByText('Friday Night')).toBeInTheDocument());
  expect(screen.getByPlaceholderText(/session name/i)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument();
});

it('Save button calls saveSession with the input name', async () => {
  const { saveSession } = await import('../services/sessionStore');
  render(<SessionPanel />);
  fireEvent.change(screen.getByPlaceholderText(/session name/i), { target: { value: 'My Set' } });
  fireEvent.click(screen.getByRole('button', { name: /save/i }));
  await waitFor(() => expect(saveSession).toHaveBeenCalledWith('My Set'));
});
