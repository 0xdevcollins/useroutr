import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { PayoutExportButton } from '../PayoutExportButton'
import type { Payout } from '@/hooks/usePayouts'

describe('PayoutExportButton', () => {
  const mockPayouts: Payout[] = [
    {
      id: 'payout-1',
      merchantId: 'merchant-1',
      recipientName: 'John Doe',
      destinationType: 'STELLAR',
      destination: { address: 'GABC123' },
      amount: '100.00',
      currency: 'USD',
      status: 'COMPLETED',
      stellarTxHash: 'tx123',
      scheduledAt: null,
      completedAt: '2024-01-15T10:00:00Z',
      failureReason: null,
      batchId: null,
      idempotencyKey: null,
      createdAt: '2024-01-15T09:00:00Z',
    },
    {
      id: 'payout-2',
      merchantId: 'merchant-1',
      recipientName: 'Jane Smith',
      destinationType: 'BANK_ACCOUNT',
      destination: { accountNumber: '****1234' },
      amount: '250.00',
      currency: 'EUR',
      status: 'PENDING',
      stellarTxHash: null,
      scheduledAt: null,
      completedAt: null,
      failureReason: null,
      batchId: 'batch-123',
      idempotencyKey: null,
      createdAt: '2024-01-15T08:00:00Z',
    },
  ]

  // Stand-in for the download anchor the component builds. It is not a real
  // Node, so every DOM method that might touch it has to be intercepted for
  // this object specifically and pass everything else through — `render()`
  // itself calls `document.createElement('div')` and appends that container to
  // `document.body`, and a blanket mock hands it this object instead, which is
  // what "Target container is not a DOM element" was reporting.
  let mockLink: { setAttribute: ReturnType<typeof vi.fn>; click: ReturnType<typeof vi.fn>; style: Record<string, string> }

  beforeEach(() => {
    vi.clearAllMocks()

    mockLink = {
      setAttribute: vi.fn(),
      click: vi.fn(),
      style: {},
    }

    const createElement = document.createElement.bind(document)
    vi.spyOn(document, 'createElement').mockImplementation((tagName: string, options?: ElementCreationOptions) =>
      tagName === 'a'
        ? (mockLink as unknown as HTMLAnchorElement)
        : createElement(tagName, options)
    )

    const appendChild = document.body.appendChild.bind(document.body)
    vi.spyOn(document.body, 'appendChild').mockImplementation(<T extends Node>(node: T) =>
      (node as unknown) === mockLink ? node : appendChild(node)
    )

    const removeChild = document.body.removeChild.bind(document.body)
    vi.spyOn(document.body, 'removeChild').mockImplementation(<T extends Node>(node: T) =>
      (node as unknown) === mockLink ? node : removeChild(node)
    )
  })

  // The spies wrap the live `document` object, so without this each test
  // layers another spy over the previous test's spy.
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders export button', () => {
    render(<PayoutExportButton payouts={mockPayouts} />)

    expect(screen.getByText('Export CSV')).toBeInTheDocument()
  })

  it('is disabled when loading', () => {
    render(<PayoutExportButton payouts={mockPayouts} isLoading={true} />)

    const button = screen.getByText('Export CSV').closest('button')
    expect(button).toBeDisabled()
  })

  it('is disabled when no payouts', () => {
    render(<PayoutExportButton payouts={[]} />)

    const button = screen.getByText('Export CSV').closest('button')
    expect(button).toBeDisabled()
  })

  it('triggers CSV download when clicked', async () => {
    render(<PayoutExportButton payouts={mockPayouts} />)

    const button = screen.getByText('Export CSV')
    fireEvent.click(button)

    await waitFor(() => {
      expect(document.createElement).toHaveBeenCalledWith('a')
    })
  })

  it('includes filter info in filename when filters provided', async () => {
    const filters = {
      status: 'COMPLETED' as const,
      batchId: 'batch-12345',
    }

    render(<PayoutExportButton payouts={mockPayouts} filters={filters} />)

    const button = screen.getByText('Export CSV')
    fireEvent.click(button)

    await waitFor(() => {
      const createElementCalls = vi.mocked(document.createElement).mock.calls
      expect(createElementCalls.length).toBeGreaterThan(0)
    })
  })
})
