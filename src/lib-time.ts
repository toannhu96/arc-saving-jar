export interface Countdown {
  days: number
  hours: number
  minutes: number
  seconds: number
}

export function splitCountdown(totalSeconds: number): Countdown {
  const s = Math.max(0, Math.floor(totalSeconds))
  return {
    days: Math.floor(s / 86400),
    hours: Math.floor((s % 86400) / 3600),
    minutes: Math.floor((s % 3600) / 60),
    seconds: s % 60,
  }
}

export function formatUnlockDate(unix: number): string {
  return new Date(unix * 1000).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}
