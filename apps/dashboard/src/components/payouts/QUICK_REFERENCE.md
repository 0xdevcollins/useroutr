# Payout Form - Quick Reference

## 🚀 30-Second Integration

```tsx
import { CreatePayoutForm } from '@/components/payouts';
import { useState } from 'react';

export default function Page() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)}>New Payout</button>
      <CreatePayoutForm open={open} onOpenChange={setOpen} />
    </>
  );
}
```

## 📚 File Locations

| File | Purpose |
|------|---------|
| `CreatePayoutForm.tsx` | Main form component |
| `PayoutDestinationFields.tsx` | Destination-specific fields |
| `PayoutConfirmationModal.tsx` | Confirmation modal |
| `FeeEstimator.tsx` | Fee calculation |
| `payout.validation.ts` | Zod schemas & validators |

## 🎯 Supported Destination Types

### Bank Account
```json
{
  "type": "BANK_ACCOUNT",
  "accountNumber": "123456789",
  "routingNumber": "021000021",
  "country": "US"
}
```

### Mobile Money
```json
{
  "type": "MOBILE_MONEY",
  "phoneNumber": "+233500000000",
  "provider": "MTN",
  "country": "GH"
}
```

### Crypto Wallet
```json
{
  "type": "CRYPTO_WALLET",
  "address": "0x742d35Cc6634C0532925a3b844Bc9e7595f42e57",
  "network": "ethereum",
  "asset": "USDC"
}
```

### Stellar
```json
{
  "type": "STELLAR",
  "address": "GBNQKWJ27OF7YVPXL2SRLQSNSYQY76FMT5PVEQ3BNWLHGSPGTWDCDM5N",
  "asset": "native"
}
```

## ✅ Validation

### Using Validators
```typescript
import { validatePayout } from '@/lib/validation/payout.validation';

const result = validatePayout(data);
if (result.success) {
  // Valid - submit data
} else {
  // Invalid - show errors
  result.error.errors.forEach(e => console.error(e.message));
}
```

### Specific Validators
```typescript
validateBankAccount(data)
validateMobileMoney(data)
validateCryptoWallet(data)
validateStellar(data)
validateRecipient(data)
```

## 🧪 Testing

### Run Tests
```bash
npm test -- CreatePayoutForm
npm test -- payout.validation
```

### Test Coverage
- 25+ component tests
- 15+ integration tests
- 50+ validation tests

## 🎨 Customization

### Add Currency
```typescript
// In CreatePayoutForm.tsx
const CURRENCIES = [
  ..., 
  "YOUR_CURRENCY"
];
```

### Add Provider
```typescript
// In PayoutDestinationFields.tsx
const PROVIDERS = [
  ...,
  { code: "YOUR_PROVIDER", name: "Your Provider" }
];
```

## 🔗 API Endpoints Required

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/v1/payouts` | Create payout |
| GET | `/api/v1/recipients` | List recipients |
| GET | `/api/v1/quotes/estimate-fee` | Get fee estimate |

## 🎯 Props

```typescript
interface CreatePayoutFormProps {
  open: boolean;              // Dialog visibility
  onOpenChange: (open: boolean) => void;  // Close/open handler
  onSuccess?: () => void;     // Success callback (optional)
}
```

## 📊 Features Checklist

- ✅ Existing recipient selection
- ✅ New recipient creation
- ✅ 4 destination types
- ✅ Dynamic field rendering
- ✅ Amount & currency input
- ✅ Live fee estimation
- ✅ Full validation
- ✅ Confirmation modal
- ✅ Error handling
- ✅ Mobile responsive (375px)
- ✅ Keyboard accessible
- ✅ Screen reader compatible

## 🚨 Common Issues & Fixes

| Issue | Solution |
|-------|----------|
| Form not submitting | Check all required fields are filled |
| Fee not showing | Verify fee endpoint exists |
| Validation errors hidden | Check error display JSX |
| Mobile layout broken | Check viewport meta tag |

## 📖 Documentation Files

| File | Use For |
|------|---------|
| `PAYOUT_FORM_README.md` | Overview & quick start |
| `IMPLEMENTATION_GUIDE.md` | Detailed reference |
| `ACCESSIBILITY_CHECKLIST.md` | A11y compliance |
| `QUICK_REFERENCE.md` | This file - cheat sheet |

## 🎓 Examples

### Complete Integration
```tsx
import { CreatePayoutForm } from '@/components/payouts';
import { usePayouts } from '@/hooks/usePayouts';
import { Button } from '@/components/ui/button';
import { useState } from 'react';

export function PayoutsPage() {
  const [open, setOpen] = useState(false);
  const { refetch } = usePayouts();

  return (
    <div>
      <Button onClick={() => setOpen(true)}>
        New Payout
      </Button>
      <CreatePayoutForm
        open={open}
        onOpenChange={setOpen}
        onSuccess={() => refetch()}
      />
    </div>
  );
}
```

### Custom Error Handler
```tsx
const handleSuccess = () => {
  console.log('Payout created successfully');
  // Refresh data, show toast, redirect, etc.
};

<CreatePayoutForm
  open={open}
  onOpenChange={setOpen}
  onSuccess={handleSuccess}
/>
```

## 🔐 Security Tips

- ✅ Always validate on backend
- ✅ Use HTTPS in production
- ✅ Never expose private keys
- ✅ Validate addresses on backend
- ✅ Implement rate limiting

## ⚡ Performance Notes

- Bundle: 15-20kb gzipped
- Form render: <50ms
- Validation: <5ms
- Fee fetch: 500ms debounce

## 📞 Getting Help

1. Check `IMPLEMENTATION_GUIDE.md` for detailed docs
2. Review tests in `__tests__/` folder for examples
3. Check browser console for error messages
4. Verify API endpoints are responding

## 🎨 Styling

Uses Tailwind CSS with shadcn/ui. Customize via:

```tsx
// Component uses these classes
className="max-w-2xl max-h-[90vh]"  // Dialog size
className="text-sm text-destructive"  // Error text
className="grid grid-cols-2 gap-3"  // Responsive grid
```

## 🌍 Supported Locales

Currently English-only. For i18n:

1. Extract strings to i18n file
2. Use translation keys in component
3. Translate destination type/provider labels

## 📱 Mobile Support

- ✅ 375px minimum (iPhone SE)
- ✅ Touch-friendly (44x44px targets)
- ✅ No horizontal scroll
- ✅ Readable text
- ✅ Keyboard accessible
- ✅ Voice input ready

## 🎯 Next Steps

1. **Import** component in your page
2. **Test** with `npm test`
3. **Customize** currencies/providers
4. **Deploy** to production
5. **Monitor** form submissions

## 📝 TypeScript Types

```typescript
import type { 
  CreatePayoutDto,
  CreatePayoutFormProps 
} from '@/components/payouts';

import type { 
  DestType, 
  Recipient 
} from '@useroutr/types';
```

## 🎊 You're Ready!

That's all you need to integrate the payout form. Happy shipping! 🚀

---

**Need more?** See full documentation in component folder.
