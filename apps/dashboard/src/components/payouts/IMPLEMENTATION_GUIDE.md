# Payout Form Implementation Guide

## Overview

The CreatePayoutForm component is a comprehensive, production-ready form for creating payouts with support for multiple destination types (bank accounts, mobile money, crypto wallets, and Stellar addresses).

## Architecture

### Component Structure

```
CreatePayoutForm (Main Component)
├── Recipient Selection (Tabs)
│   ├── Existing Recipients (RecipientSelect)
│   └── New Recipient
│       ├── Recipient Name Input
│       ├── Destination Type Selector
│       └── Destination Fields (Dynamic)
├── Payment Details
│   ├── Amount Input
│   ├── Currency Selector
│   └── FeeEstimator (Async)
└── Confirmation Modal (PayoutConfirmationModal)
```

### Supporting Components

- **PayoutDestinationFields.tsx**: Renders destination-specific input fields
  - `BankDestinationFields`: Bank account details
  - `MobileMoneyDestinationFields`: Mobile money details
  - `CryptoDestinationFields`: Crypto wallet details
  - `StellarDestinationFields`: Stellar address details

- **PayoutConfirmationModal.tsx**: Displays confirmation before final submission
  - Shows summary of all details
  - Displays fee estimate
  - Warning message about irreversibility

- **FeeEstimator.tsx**: Fetches and displays fee estimates
  - Debounced API calls (500ms)
  - Fallback estimates on error
  - Loading state handling

## Usage

### Basic Usage

```tsx
import { CreatePayoutForm } from '@/components/payouts/CreatePayoutForm';

export function PayoutsPage() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)}>New Payout</Button>
      <CreatePayoutForm 
        open={open} 
        onOpenChange={setOpen}
        onSuccess={() => {
          // Optional: perform actions after successful payout
          console.log('Payout created successfully');
        }}
      />
    </>
  );
}
```

### Integration with Page

```tsx
import { CreatePayoutForm } from '@/components/payouts/CreatePayoutForm';
import { PayoutsTable } from '@/components/payouts/PayoutsTable';
import { usePayouts } from '@/hooks/usePayouts';

export default function PayoutsPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const { data: payouts, refetch } = usePayouts();

  const handlePayoutSuccess = () => {
    refetch();
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Payouts</h1>
        <Button onClick={() => setDialogOpen(true)}>
          New Payout
        </Button>
      </div>

      <PayoutsTable payouts={payouts?.data || []} />

      <CreatePayoutForm
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSuccess={handlePayoutSuccess}
      />
    </div>
  );
}
```

## State Management

### Form State Structure

```typescript
interface FormState {
  // Recipient selection
  recipientType: 'existing' | 'new';
  existingRecipientId: string;
  recipientName: string;

  // Destination
  destinationType: DestType;
  bankAccount: { /* fields */ };
  mobileMoney: { /* fields */ };
  crypto: { /* fields */ };
  stellar: { /* fields */ };

  // Payment
  amount: string;
  currency: string;

  // Management
  saveAsDefault: boolean;
  recipientAlias: string;
}
```

### State Transitions

1. **Initial**: Empty form with default values
2. **User Input**: Updates specific sections without full re-renders
3. **Validation**: Error state added for invalid fields
4. **Confirmation**: Show summary modal
5. **Submission**: Pending state during API call
6. **Reset**: Clear form after success

## Validation

### Zod Schemas

All validation uses Zod for type-safe runtime validation:

```typescript
// Import validation schemas
import { CreatePayoutSchema, validatePayout } from '@/lib/validation/payout.validation';

// Validate complete payout
const result = validatePayout(payoutData);
if (!result.success) {
  // Handle errors
}
```

### Real-time Validation

- **On blur**: For field-level validation
- **On submit**: For full form validation
- **On field change**: Clear error for that field

### Error Display

Errors are displayed inline below the field:

```tsx
{errors.amount && (
  <p className="text-sm text-destructive mt-1">
    {errors.amount}
  </p>
)}
```

## API Integration

### Endpoints Used

1. **Create Payout**
   ```
   POST /api/v1/payouts
   Body: CreatePayoutDto
   Response: Payout
   ```

2. **Get Recipients**
   ```
   GET /api/v1/recipients
   Response: { data: Recipient[] }
   ```

3. **Estimate Fee** (Optional)
   ```
   GET /api/v1/quotes/estimate-fee
   Query: amount, currency, destinationType
   Response: FeeResponse
   ```

### Request/Response Examples

**Create Payout Request:**
```json
{
  "recipientName": "John Doe",
  "destinationType": "BANK_ACCOUNT",
  "destination": {
    "type": "BANK_ACCOUNT",
    "accountNumber": "123456789",
    "routingNumber": "021000021",
    "country": "US"
  },
  "amount": "100.50",
  "currency": "USD"
}
```

**Fee Estimate Response:**
```json
{
  "amount": "100.00",
  "currency": "USD",
  "fee": "0.50",
  "total": "100.50",
  "conversionRate": "1.0",
  "feePercentage": 0.5
}
```

## Customization

### Styling

Component uses Tailwind CSS with shadcn/ui components. Customize via:

1. **Tailwind config**: Global theme changes
2. **CSS variables**: Dark mode support (already configured)
3. **Inline className**: Component-level adjustments

### Adding New Destination Types

1. Add type to `DestType` enum in `@useroutr/types`
2. Create field component in `PayoutDestinationFields.tsx`
3. Add Zod schema in `payout.validation.ts`
4. Update form switch statement in `CreatePayoutForm.tsx`
5. Add to confirmation display in `PayoutConfirmationModal.tsx`

### Custom Currencies

Update `CURRENCIES` constant in `CreatePayoutForm.tsx`:

```typescript
const CURRENCIES = [
  'USD', 'EUR', 'GBP', 'CAD',
  'USDC', 'USDT', // Add custom
];
```

### Custom Providers/Networks

Update provider/network lists in destination field components:

```typescript
const PROVIDERS = [
  { code: 'MTN', name: 'MTN' },
  { code: 'CUSTOM', name: 'Custom Provider' }, // Add
];
```

## Testing

### Running Tests

```bash
# Unit tests
npm test -- CreatePayoutForm.test.tsx

# Integration tests
npm test -- CreatePayoutForm.integration.test.tsx

# Validation tests
npm test -- payout.validation.test.ts

# All tests
npm test
```

### Test Coverage

- **Unit Tests**: Component rendering, field switching, validation
- **Integration Tests**: Complete user flows for each destination type
- **Validation Tests**: All Zod schemas and edge cases
- **Accessibility Tests**: ARIA attributes, keyboard navigation

### Key Test Scenarios

1. **Form field switching**: Verify fields change based on destination type
2. **Validation**: Ensure all required fields are validated
3. **API submission**: Verify correct payload sent to backend
4. **Error handling**: Graceful handling of API errors
5. **Mobile responsiveness**: Layout works at 375px

## Performance Considerations

### Optimization Strategies

1. **Debounced Fee Estimation**
   ```typescript
   const debounceTimer = setTimeout(fetchFeeEstimate, 500);
   ```

2. **Memoized Destination Fields**
   - Consider wrapping destination field components with React.memo for large forms

3. **Lazy Dialog Content**
   - Dialog content only renders when open

4. **Event Batching**
   - Form updates batch React renders via event handlers

### Bundle Size Impact

- Main component: ~8kb (minified)
- Validation schemas: ~3kb
- Total estimated: ~15-20kb gzipped

## Security Considerations

### Input Validation

- **Client-side**: Zod schemas catch common errors
- **Server-side**: API must validate all inputs
- **Type safety**: TypeScript prevents type-related issues

### Sensitive Data

- **Phone numbers**: Masked in confirmation preview
- **Wallet addresses**: Truncated in display
- **No storage**: Form data cleared after submission
- **HTTPS only**: API calls must use HTTPS

### CSRF Protection

- Include CSRF token from auth context (already handled by auth interceptor)
- POST requests include proper headers

## Troubleshooting

### Common Issues

**1. Form not submitting**
- Check network tab for API errors
- Verify all required fields are filled
- Check browser console for validation errors

**2. Fee estimate not loading**
- Check if fee endpoint is accessible
- Verify currency/amount values are valid
- Check if fallback fee calculation is working

**3. Validation errors not showing**
- Ensure error state is being set
- Check if error display JSX is correct
- Verify field IDs match error keys

**4. Confirmation modal not appearing**
- Check if validation passes (console should show)
- Verify `showConfirmation` state is true
- Check modal component rendering

### Debug Tips

```typescript
// Add debug logging
console.log('Form state:', form);
console.log('Validation errors:', errors);
console.log('Fee estimate:', feeEstimate);
console.log('API response:', response);
```

## Monitoring & Analytics

### Events to Track

1. **Form opened**: User initiates payout creation
2. **Destination type selected**: Which type is most common?
3. **Payout submitted**: Conversion tracking
4. **Validation errors**: Which fields cause issues?
5. **API errors**: Which errors are most common?

### Implementation Example

```typescript
const handlePreviewClick = () => {
  if (validateForm()) {
    // Track form submission attempt
    analytics.track('payout_form_preview', {
      destinationType: form.destinationType,
      amount: form.amount,
      currency: form.currency,
    });
    setShowConfirmation(true);
  }
};

const handleConfirmSubmit = () => {
  startTransition(async () => {
    try {
      const response = await fetch(...);
      // Track successful submission
      analytics.track('payout_created', {
        amount: form.amount,
        currency: form.currency,
      });
    } catch (error) {
      // Track errors
      analytics.track('payout_error', {
        error: error.message,
      });
    }
  });
};
```

## Future Enhancements

### Planned Features

1. **Bulk Payouts**: Support multiple payouts in one submission
2. **Scheduled Payouts**: Set future delivery dates
3. **Recurring Payouts**: Automatic periodic payouts
4. **Draft Payouts**: Save incomplete forms
5. **Payout Templates**: Pre-fill common recipients
6. **Multi-currency Support**: Real-time currency conversion
7. **Advanced Validation**: BIC/IBAN validation
8. **Webhook Notifications**: Real-time status updates

### Technical Debt

- [ ] Extract validation to shared library
- [ ] Create generic dynamic field renderer
- [ ] Implement state management with Zustand
- [ ] Add form persistence to localStorage
- [ ] Migrate to React Hook Form if needed

## Migration Guide

### From Old Payout Flow (if exists)

If migrating from simpler form:

```tsx
// Old code
<SimplePayoutDialog />

// New code
<CreatePayoutForm 
  open={open}
  onOpenChange={setOpen}
  onSuccess={() => refetch()}
/>
```

Key differences:
- Supports new recipient creation
- Dynamic destination fields
- Confirmation step
- Better validation

## Support & Contribution

### Reporting Issues

Include:
- React version
- Browser/OS
- Steps to reproduce
- Expected vs actual behavior
- Console errors

### Contributing

1. Create feature branch: `git checkout -b feature/payout-enhancement`
2. Add tests for changes
3. Update documentation
4. Submit PR with description

## References

- [Zod Documentation](https://zod.dev/)
- [React Hook Form](https://react-hook-form.com/) (if migrating)
- [shadcn/ui Components](https://ui.shadcn.com/)
- [Useroutr API Docs](../../../docs/api/)
- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
