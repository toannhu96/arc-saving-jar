import { Loader2 } from 'lucide-react'
import type { ReactNode } from 'react'
import type { TxPhase } from '@/hooks/useJarActions'

interface TxButtonProps {
  phase: TxPhase
  disabled?: boolean
  onClick: () => void
  children: ReactNode
}

export function TxButton({ phase, disabled, onClick, children }: TxButtonProps) {
  return (
    <button
      disabled={disabled || phase !== 'idle'}
      onClick={onClick}
      className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-semibold text-white transition-all hover:scale-[1.01] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40"
      style={{ background: 'var(--accent)' }}
    >
      {phase === 'wallet' ? (
        <>
          <Loader2 className="size-4 animate-spin" /> Confirm in wallet...
        </>
      ) : phase === 'confirming' ? (
        <>
          <Loader2 className="size-4 animate-spin" /> Confirming...
        </>
      ) : (
        children
      )}
    </button>
  )
}
