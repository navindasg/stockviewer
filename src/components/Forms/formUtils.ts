export function getMaxDateTimeLocal(): string {
  const now = new Date()
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
  return local.toISOString().slice(0, 16)
}

export function toLocalDateTimeString(date: Date): string {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
  return local.toISOString().slice(0, 16)
}

export function getNowLocalDateTimeString(): string {
  return toLocalDateTimeString(new Date())
}

export function formatPrice(price: number): string {
  return price.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })
}

export const INPUT_CLASS =
  'w-full px-3 py-2 rounded-md font-mono text-sm tabular-nums bg-sv-surface border border-sv-border text-sv-text placeholder:text-sv-text-muted focus:outline-none focus:border-sv-accent focus:ring-1 focus:ring-sv-accent'

export const INPUT_CLASS_NO_MONO =
  'w-full px-3 py-2 rounded-md text-sm bg-sv-surface border border-sv-border text-sv-text focus:outline-none focus:border-sv-accent focus:ring-1 focus:ring-sv-accent'

export const TEXTAREA_CLASS =
  'w-full px-3 py-2 rounded-md text-sm bg-sv-surface border border-sv-border text-sv-text placeholder:text-sv-text-muted focus:outline-none focus:border-sv-accent focus:ring-1 focus:ring-sv-accent resize-none'
