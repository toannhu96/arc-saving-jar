import { useCallback, useState } from 'react'
import { erc20Abi } from 'viem'
import { useAccount, usePublicClient, useSwitchChain, useWriteContract } from 'wagmi'
import { toast } from 'sonner'
import { ARC_TESTNET_ID, SAVINGS_JAR_ADDRESS, USDC_ADDRESS, savingsJarAbi } from '@/contracts'
import { buildTxExplorerUrl } from '@/onchain-facts'

export type TxPhase = 'idle' | 'wallet' | 'confirming'

export function parseTxError(error: unknown): string | null {
  const err = error as { code?: number; message?: string; shortMessage?: string }
  const msg = `${err?.shortMessage ?? ''} ${err?.message ?? ''}`.toLowerCase()
  if (err?.code === 4001 || msg.includes('user rejected') || msg.includes('user denied')) return null
  if (msg.includes('stilllocked')) return 'This jar is still locked.'
  if (msg.includes('insufficient funds') || msg.includes('exceeds balance')) {
    return 'Insufficient balance for this transaction.'
  }
  if (msg.includes('network') || msg.includes('timeout')) return 'Network issue. Check your connection and retry.'
  if (msg.includes('reverted')) return 'Transaction failed. Please check the details and try again.'
  return 'Something went wrong. Please try again.'
}

export function useJarActions(onDone: () => void | Promise<void>) {
  const { address, chainId } = useAccount()
  const { switchChainAsync } = useSwitchChain()
  const { writeContractAsync } = useWriteContract()
  const publicClient = usePublicClient({ chainId: ARC_TESTNET_ID })
  const [phase, setPhase] = useState<TxPhase>('idle')
  const [lastTx, setLastTx] = useState<string | null>(null)

  const run = useCallback(
    async (label: string, fn: () => Promise<`0x${string}`>) => {
      try {
        if (chainId !== ARC_TESTNET_ID) await switchChainAsync({ chainId: ARC_TESTNET_ID })
        setPhase('wallet')
        const hash = await fn()
        setPhase('confirming')
        const receipt = await publicClient!.waitForTransactionReceipt({ hash })
        if (receipt.status !== 'success') throw new Error('Transaction reverted')
        setLastTx(hash)
        toast.success(label, {
          action: { label: 'View', onClick: () => window.open(buildTxExplorerUrl(ARC_TESTNET_ID, hash), '_blank') },
        })
        await onDone()
        return true
      } catch (e) {
        const message = parseTxError(e)
        if (message) toast.error(message)
        return false
      } finally {
        setPhase('idle')
      }
    },
    [chainId, switchChainAsync, publicClient, onDone],
  )

  const createJar = useCallback(
    (name: string, unlockTime: bigint) =>
      run('Jar created', () =>
        writeContractAsync({
          address: SAVINGS_JAR_ADDRESS,
          abi: savingsJarAbi,
          functionName: 'createJar',
          args: [name, unlockTime],
          chainId: ARC_TESTNET_ID,
        }),
      ),
    [run, writeContractAsync],
  )

  const deposit = useCallback(
    async (jarId: bigint, amount: bigint) => {
      if (!address || !publicClient) return false
      // Approve first if the current allowance does not cover the deposit.
      const allowance = await publicClient.readContract({
        address: USDC_ADDRESS,
        abi: erc20Abi,
        functionName: 'allowance',
        args: [address, SAVINGS_JAR_ADDRESS],
      })
      if (allowance < amount) {
        const ok = await run('USDC approved', () =>
          writeContractAsync({
            address: USDC_ADDRESS,
            abi: erc20Abi,
            functionName: 'approve',
            args: [SAVINGS_JAR_ADDRESS, amount],
            chainId: ARC_TESTNET_ID,
          }),
        )
        if (!ok) return false
      }
      return run('Deposit confirmed', () =>
        writeContractAsync({
          address: SAVINGS_JAR_ADDRESS,
          abi: savingsJarAbi,
          functionName: 'deposit',
          args: [jarId, amount],
          chainId: ARC_TESTNET_ID,
        }),
      )
    },
    [address, publicClient, run, writeContractAsync],
  )

  const withdrawAll = useCallback(
    (jarId: bigint) =>
      run('Withdrawal confirmed', () =>
        writeContractAsync({
          address: SAVINGS_JAR_ADDRESS,
          abi: savingsJarAbi,
          functionName: 'withdrawAll',
          args: [jarId],
          chainId: ARC_TESTNET_ID,
        }),
      ),
    [run, writeContractAsync],
  )

  return { phase, lastTx, createJar, deposit, withdrawAll, isBusy: phase !== 'idle' }
}
