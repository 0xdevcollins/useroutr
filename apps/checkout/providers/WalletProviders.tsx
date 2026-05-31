"use client";

import { useState } from "react";
import { WagmiProvider, http } from "wagmi";
import {
  mainnet,
  sepolia,
  arbitrum,
  arbitrumSepolia,
  optimism,
  optimismSepolia,
  base,
  baseSepolia,
  avalanche,
  avalancheFuji,
} from "wagmi/chains";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RainbowKitProvider, getDefaultConfig } from "@rainbow-me/rainbowkit";

// Chain list matches the enabled CCTP V2 EVM domains in
// apps/api/src/modules/cctp/domains.ts. If a chain isn't listed here, the
// network switcher won't offer it and the burn flow on the API will reject
// `select-crypto` with a "not enabled" error — both layers stay in sync.
//
// Testnet variants are included because the API picks chain ids based on
// STELLAR_NETWORK (testnet → sepolia variants, mainnet → mainnet). The
// frontend doesn't know which side the API is on; including both lets
// RainbowKit's switcher offer whichever the customer's wallet is on.
const config = getDefaultConfig({
  appName: "Useroutr Checkout",
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? "placeholder",
  chains: [
    mainnet,
    sepolia,
    arbitrum,
    arbitrumSepolia,
    optimism,
    optimismSepolia,
    base,
    baseSepolia,
    avalanche,
    avalancheFuji,
  ],
  ssr: true,
  transports: {
    [mainnet.id]: http(),
    [sepolia.id]: http(),
    [arbitrum.id]: http(),
    [arbitrumSepolia.id]: http(),
    [optimism.id]: http(),
    [optimismSepolia.id]: http(),
    [base.id]: http(),
    [baseSepolia.id]: http(),
    [avalanche.id]: http(),
    [avalancheFuji.id]: http(),
  },
});

export function WalletProviders({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider>{children}</RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
