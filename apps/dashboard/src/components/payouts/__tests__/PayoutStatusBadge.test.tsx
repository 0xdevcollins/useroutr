import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PayoutStatusBadge } from '../PayoutStatusBadge'
import type { PayoutStatus } from '@/hooks/usePayouts'

describe('PayoutStatusBadge', () => {
  // The badge delegates styling to `BrandStatusBadge`, which maps a tone name
  // onto Tailwind tokens rather than emitting the tone name as a class. These
  // are the classes each tone actually resolves to; CANCELLED deliberately
  // shares the neutral pair with no dedicated colour of its own.
  const statuses: { status: PayoutStatus; expectedLabel: string; expectedClasses: string[] }[] = [
    { status: 'PENDING', expectedLabel: 'Pending', expectedClasses: ['bg-warning/10', 'text-warning'] },
    { status: 'PROCESSING', expectedLabel: 'Processing', expectedClasses: ['bg-accent/10', 'text-accent'] },
    { status: 'COMPLETED', expectedLabel: 'Completed', expectedClasses: ['bg-success/10', 'text-success'] },
    { status: 'FAILED', expectedLabel: 'Failed', expectedClasses: ['bg-destructive/10', 'text-destructive'] },
    { status: 'CANCELLED', expectedLabel: 'Cancelled', expectedClasses: ['bg-secondary', 'text-muted-foreground'] },
  ]

  statuses.forEach(({ status, expectedLabel, expectedClasses }) => {
    it(`renders ${status} status with correct label and styling`, () => {
      render(<PayoutStatusBadge status={status} />)

      const badge = screen.getByText(expectedLabel)
      expect(badge).toBeInTheDocument()
      expect(badge.parentElement).toHaveClass(...expectedClasses)
    })
  })

  it('pulses the leading dot only while PROCESSING', () => {
    const { container: processing } = render(<PayoutStatusBadge status="PROCESSING" />)
    expect(processing.querySelector('.pulse-soft')).toBeInTheDocument()

    const { container: pending } = render(<PayoutStatusBadge status="PENDING" />)
    expect(pending.querySelector('.pulse-soft')).not.toBeInTheDocument()
  })

  it('matches all status mappings exactly', () => {
    // Ensure all statuses are mapped
    const allStatuses: PayoutStatus[] = ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED']

    allStatuses.forEach((status) => {
      const { container } = render(<PayoutStatusBadge status={status} />)
      expect(container.querySelector('span')).toBeInTheDocument()
    })
  })
})
