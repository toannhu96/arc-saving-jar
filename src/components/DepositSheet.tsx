import { useState } from 'react'
import { erc20Abi } from 'viem'
import { useAccount, useReadContract } from 'wagmi'
import { Sheet } from './Sheet'
import { TxButton } from './TxButton'
import { ARC_TESTNET_ID, USDC_ADDRESS, USDC_DECIMALS_ARC } from '@/contracts'
import { Amount, formatUsdc, parseUsdc } from '@/onchain-money'
import type { Jar } from '@/hooks/useJars'
import type { TxPhase } from '@/hooks/useJarActions'

interface Props {
  jar: Jar | null
  phase: TxPhase
  onClose: () => void
  onDeposit: (jarId: bigint, amount: bigint) => Promise<boolean>
}

const QUICK = ['5', '10', '25', '100']

export function DepositSheet({ jar, phase, onClose, onDeposit }: Props) {
  const { address } = useAccount()
  const [amount, setAmount] = useState('')

  const balance = useReadContract({
    address: USDC_ADDRESS,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId: ARC_TESTNET_ID,
    query: { enabled: !!address && !!jar },
  })

  let raw = 0n
  try {
    raw = amount ? parseUsdc(amount) : 0n
  } catch {
    raw = 0n
  }
  const walletBalance = balance.data
  const formattedBalance =
    walletBalance !== undefined ? Amount.fromRaw(walletBalance, USDC_DECIMALS_ARC).toFixed(2) : null
  const insufficient = walletBalance !== undefined && raw > walletBalance

  const submit = async () => {
    if (!jar) return
    const ok = await onDeposit(jar.id, raw)
    if (ok) {
      setAmount('')
      onClose()
    }
  }

  return (
    <Sheet open={!!jar} title={jar ? `Deposit to ${jar.name}` : 'Deposit'} onClose={onClose}>
      <div className="space-y-3">
        <div className="rounded-2xl p-4 glass-inner">
          <input
            inputMode="decimal"
            value={amount}
            onChange={(e) => {
              const v = e.target.value.replace(/[^0-9.]/g, '')
              if (v === '' || /^\d*\.?\d{0,6}$/.test(v)) setAmount(v)
            }}
            placeholder="0.00"
            className="display w-full bg-transparent text-4xl font-bold tabular-nums outline-none placeholder:text-slate-300"
            style={{ color: 'var(--ink)' }}
          />
          <div className="mt-2 flex items-center justify-between">
            <span className="text-xs" style={{ color: 'var(--subtle)' }}>
              USDC
            </span>
            <button
              disabled={walletBalance === undefined}
              onClick={() => walletBalance !== undefined && setAmount(formatUsdc(walletBalance))}
              className="min-h-11 text-xs font-semibold tabular-nums disabled:opacity-40"
              style={{ color: 'var(--accent-hover)' }}
            >
              {formattedBalance ? `Balance: ${formattedBalance} · Max` : 'Balance unavailable'}
            </button>
          </div>
        </div>

        <div className="flex gap-2">
          {QUICK.map((q) => (
            <button
              key={q}
              onClick={() => setAmount(q)}
              className="min-h-11 flex-1 rounded-full text-xs font-semibold tabular-nums"
              style={{ background: 'var(--surface-strong)', border: '1px solid var(--border)', color: 'var(--ink-2)' }}
            >
              ${q}
            </button>
          ))}
        </div>

        {insufficient && (
          <p className="text-xs" style={{ color: 'var(--danger)' }}>
            Not enough USDC. Use "Get test USDC" in the Arc Studio sidebar to top up.
          </p>
        )}

        <TxButton phase={phase} disabled={raw === 0n || insufficient} onClick={() => void submit()}>
          Deposit
        </TxButton>
        <p className="text-center text-xs" style={{ color: 'var(--muted)' }}>
          The first deposit asks for a USDC approval, then the deposit.
        </p>
      </div>
    </Sheet>
  )
}
