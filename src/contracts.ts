import { parseAbi } from 'viem'
import { requireChain, getUsdc } from '@/onchain-facts'

export const ARC_TESTNET_ID = 5042002 as const

export const SAVINGS_JAR_ADDRESS = '0x8a204bdb8ccd8d3f23a6498574688598c2032b56' as const

export const savingsJarAbi = parseAbi([
  'function createJar(string name, uint64 unlockTime) returns (uint256 jarId)',
  'function deposit(uint256 jarId, uint256 amount)',
  'function withdraw(uint256 jarId, uint256 amount)',
  'function withdrawAll(uint256 jarId)',
  'function getJarIdsByOwner(address owner) view returns (uint256[])',
  'function getJar(uint256 jarId) view returns (address owner, string name, uint64 unlockTime, uint256 balance, bool unlocked)',
  'function timeRemaining(uint256 jarId) view returns (uint256)',
  'function jarCount() view returns (uint256)',
  'event JarCreated(uint256 indexed jarId, address indexed owner, string name, uint64 unlockTime)',
])

export const arcChain = requireChain(ARC_TESTNET_ID)

const usdc = getUsdc(ARC_TESTNET_ID)
if (!usdc) throw new Error('USDC is not registered for Arc Testnet')
export const USDC_ADDRESS = usdc.address as `0x${string}`
export const USDC_DECIMALS_ARC = usdc.decimals

export const MAX_NAME_BYTES = 64
