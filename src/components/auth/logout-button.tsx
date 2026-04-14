'use client'

import { useRouter } from 'next/navigation'
import { useTransition } from 'react'

type LogoutButtonProps = {
  className?: string
}

export default function LogoutButton({ className = '' }: LogoutButtonProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function handleLogout() {
    startTransition(async () => {
      try {
        await fetch('/api/auth/logout', {
          method: 'POST',
        })
      } finally {
        router.replace('/login')
        router.refresh()
      }
    })
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={isPending}
      className={className}
    >
      {isPending ? 'Вихід...' : 'Вийти'}
    </button>
  )
}
