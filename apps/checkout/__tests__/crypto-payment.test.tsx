import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactElement } from 'react';
import { CryptoPayment } from '../components/CryptoPayment';
import { QuoteCountdown } from '../components/QuoteCountdown';

// Wallet boundaries only. The two crypto hooks are left real so they exercise
// their own query wiring against the mocked api client — `useCryptoSelect` is
// a mutation and `useCryptoStatus` is disabled until the burn is submitted, so
// neither fires on first render.
vi.mock('wagmi', () => ({
  useAccount: () => ({ address: null, isConnected: false }),
  useChainId: () => 8453,
  useSwitchChain: () => ({ switchChainAsync: vi.fn() }),
  useSendTransaction: () => ({ sendTransactionAsync: vi.fn() }),
  useWaitForTransactionReceipt: () => ({ refetch: vi.fn() }),
}));

vi.mock('@rainbow-me/rainbowkit', () => ({
  useConnectModal: () => ({ openConnectModal: vi.fn() }),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}));

vi.mock('@/lib/api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
  },
  ApiError: class ApiError extends Error {},
}));

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

const renderWithProviders = (component: ReactElement) =>
  render(
    <QueryClientProvider client={createTestQueryClient()}>
      {component}
    </QueryClientProvider>
  );

describe('CryptoPayment', () => {
  const defaultProps = {
    paymentId: 'test-payment-id',
    merchantAmount: 50,
    merchantCurrency: 'USD',
  };

  it('renders crypto payment component', () => {
    renderWithProviders(<CryptoPayment {...defaultProps} />);

    expect(screen.getByText('Pay with crypto')).toBeInTheDocument();
    expect(screen.getByText('Send USDC from')).toBeInTheDocument();
  });

  it('displays a button for every supported source chain', () => {
    renderWithProviders(<CryptoPayment {...defaultProps} />);

    // Stellar first — it is a source chain but not a CCTP one, so it sits
    // outside SUPPORTED_CHAINS and renders its own button.
    ['Stellar', 'Ethereum', 'Base', 'Arbitrum', 'Optimism', 'Avalanche'].forEach(
      (label) => {
        expect(screen.getByRole('button', { name: label })).toBeInTheDocument();
      }
    );
  });

  it('defaults to Base and does not preselect Stellar', () => {
    renderWithProviders(<CryptoPayment {...defaultProps} />);

    // Token-level, not substring: every unselected button carries
    // `hover:border-primary/40`, which a substring check would match.
    expect(screen.getByRole('button', { name: 'Base' })).toHaveClass(
      'border-primary'
    );
    expect(screen.getByRole('button', { name: 'Stellar' })).not.toHaveClass(
      'border-primary'
    );
    expect(screen.getByRole('button', { name: 'Stellar' })).toHaveClass(
      'border-border'
    );
  });

  it('shows connect wallet button when not connected', () => {
    renderWithProviders(<CryptoPayment {...defaultProps} />);

    expect(
      screen.getByRole('button', { name: /Connect wallet/ })
    ).toBeInTheDocument();
  });

  it('shows no quote until one is locked', () => {
    renderWithProviders(<CryptoPayment {...defaultProps} />);

    expect(screen.queryByText('Merchant gets')).not.toBeInTheDocument();
    expect(screen.queryByText(/Quote locked for/)).not.toBeInTheDocument();
  });
});

describe('QuoteCountdown', () => {
  it('renders countdown timer', () => {
    render(<QuoteCountdown />);

    expect(screen.getByText('Quote expires in')).toBeInTheDocument();
  });

  it('shows expired state when time is up', () => {
    const expiresAt = new Date(Date.now() - 1000).toISOString(); // 1 second ago

    render(<QuoteCountdown expiresAt={expiresAt} />);

    expect(screen.getByText('Quote expired')).toBeInTheDocument();
    expect(screen.getByText('0:00')).toBeInTheDocument();
  });

  it('calls onExpired callback when time expires', async () => {
    const onExpired = vi.fn();
    const expiresAt = new Date(Date.now() - 1000).toISOString(); // 1 second ago

    render(<QuoteCountdown expiresAt={expiresAt} onExpired={onExpired} />);

    await waitFor(() => {
      expect(onExpired).toHaveBeenCalled();
    });
  });
});
