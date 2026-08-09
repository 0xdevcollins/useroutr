import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PayoutStatusBadge } from '../PayoutStatusBadge'
import type { PayoutStatus } from '@/hooks/usePayouts'

describe('PayoutStatusBadge', () => {
  // The badge renders through BrandStatusBadge, which maps a `tone` onto
  // Tailwind utility classes rather than emitting the tone name itself. These
  // are the classes the tone map in components/brand/StatusBadge.tsx assigns —
  // asserting them is what keeps each status visually distinct from the others.
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

  it('matches all status mappings exactly', () => {
    // Ensure all statuses are mapped
    const allStatuses: PayoutStatus[] = ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED']

    allStatuses.forEach((status) => {
      const { container } = render(<PayoutStatusBadge status={status} />)
      expect(container.querySelector('span')).toBeInTheDocument()
    })
  })
})
