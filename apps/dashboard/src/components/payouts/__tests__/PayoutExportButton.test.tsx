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

  beforeEach(() => {
    vi.clearAllMocks()

    // Stub only the download anchor the export handler builds. Testing
    // Library's render() also goes through document.createElement and
    // document.body.appendChild to mount its container, so intercepting every
    // call — as this previously did — handed React a plain object as its root
    // and failed all five tests with "Target container is not a DOM element".
    const mockLink = {
      setAttribute: vi.fn(),
      click: vi.fn(),
      style: {} as CSSStyleDeclaration,
    } as unknown as HTMLAnchorElement

    const realCreateElement = document.createElement.bind(document)
    const realAppendChild = document.body.appendChild.bind(document.body)
    const realRemoveChild = document.body.removeChild.bind(document.body)

    vi.spyOn(document, 'createElement').mockImplementation(((
      tagName: string,
      options?: ElementCreationOptions,
    ) =>
      tagName === 'a'
        ? mockLink
        : realCreateElement(tagName, options)) as typeof document.createElement)

    vi.spyOn(document.body, 'appendChild').mockImplementation((<T extends Node>(node: T) =>
      node === (mockLink as unknown as Node)
        ? node
        : realAppendChild(node)) as typeof document.body.appendChild)

    vi.spyOn(document.body, 'removeChild').mockImplementation((<T extends Node>(node: T) =>
      node === (mockLink as unknown as Node)
        ? node
        : realRemoveChild(node)) as typeof document.body.removeChild)
  })

  afterEach(() => {
    // The spies above wrap the real DOM methods; leaving them installed would
    // stack another layer on the next beforeEach.
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
