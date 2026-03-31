import { useEffect, useRef, useState, type ReactNode } from 'react'

interface FlashValueProps {
  readonly value: number
  readonly children: ReactNode
  readonly className?: string
}

export function FlashValue({ value, children, className = '' }: FlashValueProps) {
  const previousValueRef = useRef<number>(value)
  const [flashClass, setFlashClass] = useState('')

  useEffect(() => {
    const previousValue = previousValueRef.current
    if (previousValue === value) return

    const direction = value > previousValue ? 'flash-positive' : 'flash-negative'
    setFlashClass(direction)
    previousValueRef.current = value

    const timer = setTimeout(() => {
      setFlashClass('')
    }, 600)

    return () => clearTimeout(timer)
  }, [value])

  return (
    <span className={`${flashClass} ${className}`.trim()}>
      {children}
    </span>
  )
}
