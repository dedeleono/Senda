# Senda DApp

### Environment Variables

Create a `.env` file with the following variables:

```bash
# Database
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/senda?schema=public"
DIRECT_URL="postgresql://postgres:postgres@localhost:5432/senda?schema=public"

# NextAuth
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-super-secret-nextauth-secret"

# Email (for auth)
EMAIL_SERVER_HOST="smtp.example.com"
EMAIL_SERVER_PORT=587
EMAIL_SERVER_USER="user@example.com"
EMAIL_SERVER_PASSWORD="your-email-password"
EMAIL_FROM="noreply@example.com"

# Solana
NEXT_PUBLIC_SOLANA_NETWORK="devnet" # or "mainnet-beta"
SOLANA_DEVNET_RPC="https://api.devnet.solana.com"
SOLANA_MAINNET_RPC="https://api.mainnet-beta.solana.com"

# Encryption for wallet private keys
ENCRYPTION_KEY="your-super-secret-encryption-key"

# Treasury wallet for collecting swap fees
NEXT_PUBLIC_TREASURY_WALLET="your-treasury-wallet-public-key"

# Application URL for redirects
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

### Features

1. **Seamless Stablecoin On-Ramp**: Users can directly on-ramp USDC/USDT via Privy, with automatic SOL-to-stablecoin conversion happening on the backend
2. **Backend Swap**: Jupiter Aggregator is used on the backend for converting SOL to USDC/USDT, completely transparent to the user
3. **Fee Collection**: Ability to enable/disable and configure swap fees that go to a treasury wallet

### Automatic Asset Conversion Flow

1. User selects their desired asset (SOL, USDC, or USDT) and amount in the UI
2. Privy handles the fiat-to-SOL on-ramp process
3. After successful funding, our backend automatically:
   - Detects if the target asset is different from SOL
   - Uses Jupiter Aggregator to swap SOL to the desired asset
   - Records both transactions in the database
   - Applies any configured fees during the swap process

### Getting Started

1. Install dependencies:
   ```
   npm install
   ```

2. Run the development server:
   ```
   npm run dev
   ```

3. Configure your Privy account:
   - Sign up at [privy.io](https://privy.io)
   - Create a new application
   - Enable "Pay with card" in the Privy Dashboard under "User management > Account funding"
   - Copy your App ID to the environment variables

### Customizing Fees

Fees are currently disabled by default, as requested. When you're ready to enable fees:

1. Edit `src/lib/solana/swap.ts`
2. Update the `DEFAULT_SWAP_CONFIG` object:
   ```typescript
   export const DEFAULT_SWAP_CONFIG: SwapConfig = {
     treasuryWalletPublicKey: process.env.NEXT_PUBLIC_TREASURY_WALLET || '',
     feePercentage: 0.5, // Adjust fee percentage (0.5 = 0.5%)
     feesEnabled: true, // Change to true to enable fees
     jupiterApiEndpoint: 'https://quote-api.jup.ag/v6',
   };
   ```

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions
are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use
the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme)
from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for
more details.
