import { Lock, LockOpen, Plus } from 'lucide-react'
import { TokenUSDC } from '@web3icons/react'
import { TxButton } from './TxButton'
import { USDC_DECIMALS_ARC } from '@/contracts'
import { Amount } from '@/onchain-money'
import { formatUnlockDate, splitCountdown } from '@/lib-time'
import type { Jar } from '@/hooks/useJars'
import type { TxPhase } from '@/hooks/useJarActions'

interface Props {
  jar: Jar
  now: number
  phase: TxPhase
  onDeposit: (jar: Jar) => void
  onWithdraw: (jar: Jar) => void
}

function Unit({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex-1 rounded-xl px-2 py-2 text-center glass-inner">
      <div className="display text-xl font-bold tabular-nums" style={{ color: 'var(--ink)' }}>
        {String(value).padStart(2, '0')}
      </div>
      <div className="text-[10px] font-semibold uppercase tracking-[0.08em]" style={{ color: 'var(--subtle)' }}>
        {label}
      </div>
    </div>
  )
}

export function JarCard({ jar, now, phase, onDeposit, onWithdraw }: Props) {
  const remaining = jar.unlockTime - now
  const unlocked = remaining <= 0
  const cd = splitCountdown(remaining)
  const balance = Amount.fromRaw(jar.balance, USDC_DECIMALS_ARC).toFixed(2)

  return (
    <article className="rounded-3xl p-5 glass-card">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="display truncate text-lg font-bold" style={{ color: 'var(--ink)' }}>
            {jar.name}
          </h3>
          <p className="text-xs" style={{ color: 'var(--muted)' }}>
            Unlocks {formatUnlockDate(jar.unlockTime)}
          </p>
        </div>
        <span
          className="flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold"
          style={{
            background: unlocked ? 'rgba(26,128,71,0.12)' : 'var(--surface-muted)',
            color: unlocked ? 'var(--success)' : 'var(--ink-2)',
          }}
        >
          {unlocked ? <LockOpen className="size-3" /> : <Lock className="size-3" />}
          {unlocked ? 'Unlocked' : 'Locked'}
        </span>
      </div>

      <div className="mt-4 flex items-baseline gap-2">
        <span className="display text-4xl font-bold tabular-nums" style={{ color: 'var(--ink)' }}>
          {balance}
        </span>
        <span className="flex items-center gap-1 text-base font-medium" style={{ color: 'var(--subtle)' }}>
          <TokenUSDC variant="branded" size={16} /> USDC
        </span>
      </div>

      {!unlocked && (
        <div className="mt-4 flex gap-2" aria-label="Time until unlock">
          <Unit value={cd.days} label="Days" />
          <Unit value={cd.hours} label="Hrs" />
          <Unit value={cd.minutes} label="Min" />
          <Unit value={cd.seconds} label="Sec" />
        </div>
      )}

      <div className="mt-4 flex gap-2">
        <button
          onClick={() => onDeposit(jar)}
          className="flex min-h-12 flex-1 items-center justify-center gap-1.5 rounded-2xl text-sm font-semibold"
          style={{ background: 'var(--surface-strong)', border: '1px solid var(--border-strong)', color: 'var(--ink)' }}
        >
          <Plus className="size-4" /> Deposit
        </button>
        <div className="flex-1">
          <TxButton phase={phase} disabled={!unlocked || jar.balance === 0n} onClick={() => onWithdraw(jar)}>
            Withdraw
          </TxButton>
        </div>
      </div>
      {!unlocked && (
        <p className="mt-2 text-center text-xs" style={{ color: 'var(--muted)' }}>
          Withdrawals open when the countdown ends.
        </p>
      )}
    </article>
  )
}
