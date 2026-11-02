import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { App } from './App';

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ status: 'ok', service: 'inkmatch-api', stage: 'stage-1' }) }));
});

afterEach(() => cleanup());

test('renders the Stage 1 workspace and protects the demo font boundary', async () => {
  render(<App />);
  expect(screen.getByRole('heading', { name: /make typed words/i })).toBeInTheDocument();
  expect(screen.getByText(/demo handwriting is a temporary stage 1 renderer/i)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /equation mode/i })).toHaveAttribute('aria-pressed', 'true');
});

test('shows literal caret text when equation mode is disabled', async () => {
  render(<App />);
  const equationToggle = screen.getByRole('button', { name: /equation mode/i });
  equationToggle.click();
  expect(screen.getByText(/Try x\^2 \+ y\^2 = z\^2/)).toBeInTheDocument();
});

test('has an explicit ink-only export action', () => {
  render(<App />);
  expect(screen.getByRole('button', { name: /export ink-only pdf/i })).toBeInTheDocument();
});
