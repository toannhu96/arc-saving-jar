import { useAccount, useReadContract, useReadContracts } from 'wagmi'
import { SAVINGS_JAR_ADDRESS, savingsJarAbi, ARC_TESTNET_ID } from '@/contracts'

export interface Jar {
  id: bigint
  name: string
  unlockTime: number
  balance: bigint
}

export function useJars() {
  const { address } = useAccount()

  const ids = useReadContract({
    address: SAVINGS_JAR_ADDRESS,
    abi: savingsJarAbi,
    functionName: 'getJarIdsByOwner',
    args: address ? [address] : undefined,
    chainId: ARC_TESTNET_ID,
    query: { enabled: !!address, refetchInterval: 15_000 },
  })

  const jarIds = ids.data ?? []

  const details = useReadContracts({
    contracts: jarIds.map((id) => ({
      address: SAVINGS_JAR_ADDRESS,
      abi: savingsJarAbi,
      functionName: 'getJar' as const,
      args: [id] as const,
      chainId: ARC_TESTNET_ID,
    })),
    query: { enabled: jarIds.length > 0, refetchInterval: 15_000 },
  })

  const jars: Jar[] = []
  details.data?.forEach((res, i) => {
    if (res.status !== 'success') return
    const [, name, unlockTime, balance] = res.result
    jars.push({ id: jarIds[i], name, unlockTime: Number(unlockTime), balance })
  })
  jars.reverse() // newest first

  const refetch = async () => {
    const r = await ids.refetch()
    if ((r.data?.length ?? 0) > 0) await details.refetch()
  }

  return {
    jars,
    isLoading: ids.isLoading || (jarIds.length > 0 && details.isLoading),
    isError: ids.isError || details.isError,
    refetch,
  }
}
