import { useState } from 'react'
import { ConnectKitButton } from 'connectkit'
import { useAccount } from 'wagmi'
import { PiggyBank, Plus, ExternalLink, Loader2 } from 'lucide-react'
import { CreateJarSheet } from '@/components/CreateJarSheet'
import { DepositSheet } from '@/components/DepositSheet'
import { JarCard } from '@/components/JarCard'
import { useJars, type Jar } from '@/hooks/useJars'
import { useJarActions } from '@/hooks/useJarActions'
import { useNow } from '@/hooks/useNow'
import { ARC_TESTNET_ID, SAVINGS_JAR_ADDRESS, USDC_DECIMALS_ARC } from '@/contracts'
import { Amount } from '@/onchain-money'
import { buildAddressExplorerUrl } from '@/onchain-facts'

export default function App() {
  const { isConnected } = useAccount()
  const now = useNow()
  const { jars, isLoading, isError, refetch } = useJars()
  const actions = useJarActions(refetch)
  const [creating, setCreating] = useState(false)
  const [depositJar, setDepositJar] = useState<Jar | null>(null)

  const total = jars.reduce((sum, j) => sum + j.balance, 0n)

  return (
    <div className="mx-auto min-h-dvh max-w-md px-4 pb-24 pt-6">
      <header className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex size-9 items-center justify-center rounded-xl" style={{ background: 'var(--accent)' }}>
            <PiggyBank className="size-5 text-white" />
          </div>
          <span className="display text-lg font-bold">Savings Jar</span>
        </div>
        <ConnectKitButton />
      </header>

      <section className="rounded-3xl p-5 glass-card">
        <span className="text-xs font-semibold" style={{ color: 'var(--muted)' }}>
          Total saved
        </span>
        <div className="mt-2 flex items-baseline gap-1">
          <span className="display text-4xl font-bold tabular-nums">
            {isConnected ? Amount.fromRaw(total, USDC_DECIMALS_ARC).toFixed(2) : '0.00'}
          </span>
          <span className="text-lg font-medium" style={{ color: 'var(--subtle)' }}>
            USDC
          </span>
        </div>
        <p className="mt-1.5 text-xs" style={{ color: 'var(--muted)' }}>
          {isConnected ? `${jars.length} ${jars.length === 1 ? 'jar' : 'jars'} on Arc Testnet` : 'Connect a wallet to see your jars'}
        </p>
        {isConnected && (
          <button
            onClick={() => setCreating(true)}
            className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl text-sm font-semibold text-white transition-all hover:scale-[1.01] active:scale-[0.99]"
            style={{ background: 'var(--accent)' }}
          >
            <Plus className="size-4" /> New jar
          </button>
        )}
      </section>

      <main className="mt-5 space-y-4">
        {!isConnected && (
          <div className="rounded-3xl p-6 text-center glass-card">
            <p className="text-sm text-pretty" style={{ color: 'var(--ink-2)' }}>
              Lock USDC away until a date you choose. No one, including us, can release it early.
            </p>
            <div className="mt-4 flex justify-center">
              <ConnectKitButton label="Connect wallet" />
            </div>
          </div>
        )}

        {isConnected && isLoading && (
          <div className="flex justify-center py-10" style={{ color: 'var(--subtle)' }}>
            <Loader2 className="size-5 animate-spin" />
          </div>
        )}

        {isConnected && isError && (
          <p className="text-center text-sm" style={{ color: 'var(--danger)' }}>
            Could not load your jars. Retrying shortly.
          </p>
        )}

        {isConnected && !isLoading && !isError && jars.length === 0 && (
          <div className="rounded-3xl p-6 text-center glass-card">
            <p className="display text-lg font-bold">No jars yet</p>
            <p className="mt-1 text-sm text-pretty" style={{ color: 'var(--muted)' }}>
              Create a jar with a name and an unlock date, then deposit USDC into it.
            </p>
          </div>
        )}

        {jars.map((jar) => (
          <JarCard
            key={jar.id.toString()}
            jar={jar}
            now={now}
            phase={actions.phase}
            onDeposit={setDepositJar}
            onWithdraw={(j) => void actions.withdrawAll(j.id)}
          />
        ))}
      </main>

      <footer className="mt-8 text-center text-xs" style={{ color: 'var(--subtle)' }}>
        <a
          href={buildAddressExplorerUrl(ARC_TESTNET_ID, SAVINGS_JAR_ADDRESS)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1"
        >
          View contract on Arc Testnet explorer <ExternalLink className="size-3" />
        </a>
      </footer>

      <CreateJarSheet
        open={creating}
        phase={actions.phase}
        onClose={() => setCreating(false)}
        onCreate={actions.createJar}
      />
      <DepositSheet
        jar={depositJar}
        phase={actions.phase}
        onClose={() => setDepositJar(null)}
        onDeposit={actions.deposit}
      />
    </div>
  )
}
