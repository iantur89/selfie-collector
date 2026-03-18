'use client'

import { useEffect, useMemo, useState } from 'react'

type UserSessionItem = {
  sessionId: string
  updatedAt: string | null
  activeAgentId: string | null
  userId: string | null
  telegramUserId: string | null
  workflowStage: string | null
  verificationStatus: string | null
  name: string | null
  selfieCount: number | null
}

type UserSessionDetail = {
  sessionId: string
  activeAgentId: string | null
  state: Record<string, unknown> | null
  rawSession: Record<string, unknown> | null
  datasetRecords: Array<Record<string, unknown>>
}

export default function AdminUsersPage() {
  const [items, setItems] = useState<UserSessionItem[]>([])
  const [selectedSessionId, setSelectedSessionId] = useState<string>('')
  const [selectedDetail, setSelectedDetail] = useState<UserSessionDetail | null>(null)
  const [query, setQuery] = useState('')
  const [loadingList, setLoadingList] = useState(false)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [actor, setActor] = useState('admin')

  const selectedItem = useMemo(
    () => items.find((item) => item.sessionId === selectedSessionId) ?? null,
    [items, selectedSessionId],
  )

  async function loadUsers(nextQuery = query) {
    setLoadingList(true)
    setError(null)
    try {
      const response = await fetch(`/api/dashboard/users?q=${encodeURIComponent(nextQuery)}`)
      const data = await response.json()
      if (!response.ok) throw new Error(data.error ?? 'Failed to load users')
      const nextItems = (data.items ?? []) as UserSessionItem[]
      setItems(nextItems)
      if (!nextItems.length) {
        setSelectedSessionId('')
        setSelectedDetail(null)
      } else if (!nextItems.some((item) => item.sessionId === selectedSessionId)) {
        setSelectedSessionId(nextItems[0].sessionId)
      }
    } catch (err) {
      setError(String(err))
    } finally {
      setLoadingList(false)
    }
  }

  async function loadDetail(sessionId: string) {
    if (!sessionId) return
    setLoadingDetail(true)
    setError(null)
    try {
      const response = await fetch(`/api/dashboard/users/${encodeURIComponent(sessionId)}`)
      const data = await response.json()
      if (!response.ok) throw new Error(data.error ?? 'Failed to load user detail')
      setSelectedDetail(data as UserSessionDetail)
    } catch (err) {
      setError(String(err))
    } finally {
      setLoadingDetail(false)
    }
  }

  async function resetUser() {
    if (!selectedItem) return
    const confirmed = window.confirm(
      `Reset ${selectedItem.sessionId}? This will delete chat session data and dataset rows tied to this session.`,
    )
    if (!confirmed) return

    setResetting(true)
    setError(null)
    try {
      const response = await fetch('/api/dashboard/users/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: selectedItem.sessionId,
          actor,
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error ?? 'Failed to reset user')
      await loadUsers()
      setSelectedDetail(null)
    } catch (err) {
      setError(String(err))
    } finally {
      setResetting(false)
    }
  }

  useEffect(() => {
    loadUsers('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (selectedSessionId) {
      void loadDetail(selectedSessionId)
    }
  }, [selectedSessionId])

  return (
    <div style={{ padding: 24 }}>
      <h1>Admin User Dashboard</h1>
      <p>View Telegram user session data and reset a user session when needed.</p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <input
          placeholder="Search by session ID, user ID, or name"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          style={{ minWidth: 280 }}
        />
        <button onClick={() => loadUsers()} disabled={loadingList}>
          {loadingList ? 'Loading...' : 'Search'}
        </button>
        <button onClick={() => loadUsers('')} disabled={loadingList}>
          Refresh
        </button>
        <input
          placeholder="actor for audit logs"
          value={actor}
          onChange={(event) => setActor(event.target.value)}
          style={{ minWidth: 180 }}
        />
      </div>

      {error ? <p style={{ color: 'red' }}>{error}</p> : null}

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 420px) 1fr', gap: 16 }}>
        <section>
          <h2>Users ({items.length})</h2>
          <div style={{ border: '1px solid #ddd', borderRadius: 6, maxHeight: 600, overflow: 'auto' }}>
            {items.map((item) => (
              <button
                key={item.sessionId}
                onClick={() => setSelectedSessionId(item.sessionId)}
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  border: 0,
                  borderBottom: '1px solid #eee',
                  background: selectedSessionId === item.sessionId ? '#f2f2f2' : 'white',
                  padding: 10,
                  cursor: 'pointer',
                }}
              >
                <div>
                  <strong>{item.sessionId}</strong>
                </div>
                <div style={{ fontSize: 12, color: '#555' }}>
                  user={item.userId ?? 'n/a'} stage={item.workflowStage ?? 'n/a'} verification=
                  {item.verificationStatus ?? 'n/a'}
                </div>
                <div style={{ fontSize: 12, color: '#777' }}>updated={item.updatedAt ?? 'n/a'}</div>
              </button>
            ))}
            {!items.length ? <p style={{ padding: 10, color: '#666' }}>No user sessions found.</p> : null}
          </div>
        </section>

        <section>
          <h2>User Detail</h2>
          {!selectedItem ? (
            <p>Select a user session.</p>
          ) : (
            <div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                <button onClick={() => loadDetail(selectedItem.sessionId)} disabled={loadingDetail}>
                  {loadingDetail ? 'Loading...' : 'Reload Detail'}
                </button>
                <button
                  onClick={resetUser}
                  disabled={resetting}
                  style={{ background: '#7f1d1d', color: 'white', border: 0, borderRadius: 4, padding: '8px 12px' }}
                >
                  {resetting ? 'Resetting...' : 'Reset User Session'}
                </button>
              </div>
              <pre style={{ border: '1px solid #ddd', borderRadius: 6, padding: 12, whiteSpace: 'pre-wrap' }}>
                {JSON.stringify(selectedDetail, null, 2)}
              </pre>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
