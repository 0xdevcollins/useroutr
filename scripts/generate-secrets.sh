#!/usr/bin/env bash
# Secret generation script for Useroutr
# Generates secure random values for critical secrets
# Usage: ./scripts/generate-secrets.sh

set -e

echo "# Useroutr Secret Generation - $(date)"
echo "# Copy the output values to your .env file"
echo ""

# Check if openssl is available
if ! command -v openssl &> /dev/null; then
    echo "Error: openssl is required but not installed." >&2
    echo "Install it using your package manager:" >&2
    echo "  macOS: brew install openssl" >&2
    echo "  Ubuntu/Debian: sudo apt-get install openssl" >&2
    echo "  CentOS/RHEL: sudo yum install openssl" >&2
    exit 1
fi

# JWT secret (64 bytes = 512 bits, base64 encoded)
echo "JWT_SECRET=$(openssl rand -base64 64)"

# API key salt (32 bytes = 256 bits, base64 encoded)
echo "API_KEY_SALT=$(openssl rand -base64 32)"

# Bank session encryption key (32 bytes for AES-256)
echo "BANK_SESSION_ENCRYPTION_KEY=$(openssl rand -base64 32)"

# Bank webhook secret
echo "BANK_WEBHOOK_SECRET=$(openssl rand -base64 32)"

# Placeholder for other secrets that need manual setup
echo ""
echo "# Note: The following secrets require manual setup:"
echo "# STELLAR_RELAY_KEYPAIR_SECRET='S...'  # Generate via stellar-cli: stellar key generate"
echo "# EVM_RELAY_PRIVATE_KEY='0x...'        # Generate via ethers.js or wallet"
echo "# CIRCLE_API_KEY='your-circle-api-key' # Obtain from Circle developer portal"
echo "# STRIPE_SECRET_KEY='sk_test_...'      # Obtain from Stripe dashboard"
echo "# STRIPE_WEBHOOK_SECRET='whsec_...'    # Obtain from Stripe webhook settings"
echo "# RESEND_API_KEY='re_...'              # Obtain from Resend dashboard"
echo "# CLOUDINARY_API_SECRET='...'          # Obtain from Cloudinary dashboard"