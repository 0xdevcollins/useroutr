#!/usr/bin/env bash
# Secret generation script for Useroutr.
# Prints secure random values for the secrets the API validates at startup.
# Usage: ./scripts/generate-secrets.sh >> .env   (or copy values manually)

set -euo pipefail

if ! command -v openssl >/dev/null 2>&1; then
    echo "Error: openssl is required but not installed." >&2
    echo "Install it using your package manager:" >&2
    echo "  macOS: brew install openssl" >&2
    echo "  Ubuntu/Debian: sudo apt-get install openssl" >&2
    echo "  CentOS/RHEL: sudo yum install openssl" >&2
    exit 1
fi

# openssl wraps base64 output at 64 columns; strip newlines so every value
# stays on a single line and is safe to paste into a .env file.
rand_base64() {
    openssl rand -base64 "$1" | tr -d '\n'
}

echo "# Useroutr generated secrets - $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "# Copy these values into your .env file. Never commit them."
echo ""

# JWT signing secret (64 bytes = 512 bits)
echo "JWT_SECRET=\"$(rand_base64 64)\""

# Bank session encryption key (32 bytes for AES-256)
echo "BANK_SESSION_ENCRYPTION_KEY=\"$(rand_base64 32)\""

# Bank webhook verification secret
echo "BANK_WEBHOOK_SECRET=\"$(rand_base64 32)\""

echo ""
echo "# The following secrets cannot be generated locally and need manual setup:"
echo "# STELLAR_RELAY_KEYPAIR_SECRET='S...'  # Generate via stellar-cli: stellar keys generate"
echo "# EVM_RELAY_PRIVATE_KEY='0x...'        # Generate via ethers.js or a wallet"
echo "# CIRCLE_API_KEY='...'                 # Circle developer portal"
echo "# STRIPE_SECRET_KEY='sk_...'           # Stripe dashboard"
echo "# STRIPE_WEBHOOK_SECRET='whsec_...'    # Stripe webhook settings"
echo "# RESEND_API_KEY='re_...'              # Resend dashboard"
echo "# CLOUDINARY_API_SECRET='...'          # Cloudinary dashboard"
