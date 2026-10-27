# Savings Jar

A USDC savings jar on Arc Testnet. Create a jar with a name and an unlock date, deposit USDC into it, and withdraw only after the unlock date. There is no admin and no early release. Each jar shows its balance and a live countdown to unlock.

Built with [Arc Studio](https://studio.arc.io)

## Tech stack
- Solidity (OpenZeppelin SafeERC20 and ReentrancyGuard), Foundry
- React, TypeScript, Vite, Tailwind CSS
- wagmi, viem, ConnectKit

## Development
Prerequisites: Bun, Foundry, and a browser wallet connected to Arc Testnet.

Install: `bun install`

Environment variables: None.

Run the app: `bun run dev`

Build the app: `bun run build`

Check lint and types: `bun run check`

Test the contract: `forge test`
