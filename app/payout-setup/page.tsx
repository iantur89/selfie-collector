'use client'

import { Suspense, useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Box, Button, CircularProgress, TextField, Typography } from '@mui/material'

function PayoutSetupForm() {
  const searchParams = useSearchParams()
  const sessionId = searchParams.get('sessionId') ?? ''

  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error' | 'invalid_link'>('idle')
  const [message, setMessage] = useState<string | null>(null)

  const checkLink = useCallback(async () => {
    if (!sessionId.trim()) {
      setStatus('invalid_link')
      setMessage('Missing session. Use the link from the bot.')
      return
    }
    setStatus('loading')
    setMessage(null)
    try {
      const res = await fetch(`/api/payout-setup?sessionId=${encodeURIComponent(sessionId)}`)
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setStatus('error')
        setMessage(data?.error ?? 'This link is invalid or expired.')
        return
      }
      if (data.alreadyComplete) {
        setStatus('success')
        setMessage('Payout is already set up. Return to Telegram to continue.')
        return
      }
      setStatus('idle')
    } catch {
      setStatus('error')
      setMessage('Could not verify link. Try again.')
    }
  }, [sessionId])

  useEffect(() => {
    if (sessionId) checkLink()
    else {
      setStatus('invalid_link')
      setMessage('Missing session. Use the link from the bot.')
    }
  }, [sessionId, checkLink])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim() || status === 'loading') return
    setStatus('loading')
    setMessage(null)
    try {
      const res = await fetch('/api/payout-setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, payoutEmail: email.trim() }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setStatus('error')
        setMessage(data?.error ?? 'Something went wrong.')
        return
      }
      setStatus('success')
      setMessage('Payout email saved. Return to Telegram to continue.')
    } catch {
      setStatus('error')
      setMessage('Request failed. Try again.')
    }
  }

  const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        p: 2,
        bgcolor: 'background.default',
      }}
    >
      <Box
        component="main"
        sx={{
          maxWidth: 420,
          width: '100%',
          border: 1,
          borderColor: 'divider',
          borderRadius: 3,
          p: 4,
          bgcolor: 'background.paper',
        }}
      >
        <Typography variant="h5" fontWeight="bold" gutterBottom>
          Payout setup
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Enter the PayPal email where you want to receive payments.
        </Typography>

        {status === 'invalid_link' && (
          <Typography color="error" sx={{ mb: 2 }}>
            {message}
          </Typography>
        )}

        {status === 'loading' && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, py: 2 }}>
            <CircularProgress size={24} />
            <Typography color="text.secondary">{message ?? 'Checking…'}</Typography>
          </Box>
        )}

        {status === 'idle' && (
          <Box component="form" onSubmit={handleSubmit}>
            <TextField
              fullWidth
              label="PayPal email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              error={email.length > 0 && !isValidEmail}
              helperText={email.length > 0 && !isValidEmail ? 'Enter a valid email' : undefined}
              autoComplete="email"
              sx={{ mb: 2 }}
            />
            <Button type="submit" variant="contained" fullWidth disabled={!isValidEmail}>
              Save and continue
            </Button>
          </Box>
        )}

        {(status === 'success' || status === 'error') && (
          <>
            <Typography color={status === 'success' ? 'success.main' : 'error'} sx={{ mb: 2 }}>
              {message}
            </Typography>
            {status === 'success' && (
              <Typography variant="body2" color="text.secondary">
                You can close this tab and return to the bot.
              </Typography>
            )}
          </>
        )}
      </Box>
    </Box>
  )
}

export default function PayoutSetupPage() {
  return (
    <Suspense fallback={
      <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', p: 2, bgcolor: 'background.default' }}>
        <CircularProgress />
      </Box>
    }>
      <PayoutSetupForm />
    </Suspense>
  )
}
