import { useMemo, useState } from 'react'
import { Sheet } from './Sheet'
import { TxButton } from './TxButton'
import { MAX_NAME_BYTES } from '@/contracts'
import { useNow } from '@/hooks/useNow'
import type { TxPhase } from '@/hooks/useJarActions'

interface Props {
  open: boolean
  phase: TxPhase
  onClose: () => void
  onCreate: (name: string, unlockTime: bigint) => Promise<boolean>
}

const PRESETS = [
  { label: '1 week', days: 7 },
  { label: '1 month', days: 30 },
  { label: '3 months', days: 90 },
  { label: '1 year', days: 365 },
]

function toLocalInput(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function CreateJarSheet({ open, phase, onClose, onCreate }: Props) {
  const [name, setName] = useState('')
  const [unlock, setUnlock] = useState('')
  const now = useNow()

  const nameBytes = useMemo(() => new TextEncoder().encode(name.trim()).length, [name])
  const unlockMs = unlock ? new Date(unlock).getTime() : NaN
  const validDate = Number.isFinite(unlockMs) && unlockMs > (now + 60) * 1000
  const validName = nameBytes > 0 && nameBytes <= MAX_NAME_BYTES

  const pickPreset = (days: number) => {
    setUnlock(toLocalInput(new Date((now + days * 86_400) * 1000)))
  }

  const submit = async () => {
    const ok = await onCreate(name.trim(), BigInt(Math.floor(unlockMs / 1000)))
    if (ok) {
      setName('')
      setUnlock('')
      onClose()
    }
  }

  return (
    <Sheet open={open} title="New jar" onClose={onClose}>
      <div className="space-y-3">
        <label className="block rounded-2xl p-4 glass-inner">
          <span className="text-xs font-semibold" style={{ color: 'var(--muted)' }}>
            Jar name
          </span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Holiday fund"
            maxLength={MAX_NAME_BYTES}
            className="mt-1 w-full bg-transparent text-lg font-medium outline-none placeholder:text-slate-300"
            style={{ color: 'var(--ink)' }}
          />
        </label>

        <div className="rounded-2xl p-4 glass-inner">
          <label className="block">
            <span className="text-xs font-semibold" style={{ color: 'var(--muted)' }}>
              Unlock date
            </span>
            <input
              type="datetime-local"
              value={unlock}
              min={toLocalInput(new Date(now * 1000))}
              onChange={(e) => setUnlock(e.target.value)}
              className="mt-1 w-full bg-transparent text-base font-medium outline-none"
              style={{ color: 'var(--ink)' }}
            />
          </label>
          <div className="mt-3 flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => pickPreset(p.days)}
                className="min-h-11 rounded-full px-4 text-xs font-semibold"
                style={{ background: 'var(--surface-strong)', border: '1px solid var(--border)', color: 'var(--ink-2)' }}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <p className="text-xs text-pretty" style={{ color: 'var(--muted)' }}>
          Funds in this jar cannot be withdrawn until the unlock date. There is no admin and no early release.
        </p>

        <TxButton phase={phase} disabled={!validName || !validDate} onClick={() => void submit()}>
          Create jar
        </TxButton>
      </div>
    </Sheet>
  )
}
