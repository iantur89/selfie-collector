'use client'

import { useMemo, useState } from 'react'

type DatasetItem = {
  selfieId: string
  sessionId: string
  userId: string
  s3Key: string
  createdAt: string
  tags: Record<string, unknown>
}

export default function DatasetPage() {
  const [items, setItems] = useState<DatasetItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [angle, setAngle] = useState('')
  const [lighting, setLighting] = useState('')
  const [gender, setGender] = useState('')
  const [demographics, setDemographics] = useState('')
  const [selected, setSelected] = useState<DatasetItem | null>(null)

  const filters = useMemo(() => {
    return {
      angle: angle ? [angle] : undefined,
      lighting: lighting ? [lighting] : undefined,
      gender: gender ? [gender] : undefined,
      demographics: demographics ? [demographics] : undefined,
    }
  }, [angle, lighting, gender, demographics])

  async function loadData() {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/dashboard/dataset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filters,
          pagination: { page: 1, pageSize: 100 },
        }),
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error ?? 'Failed to load dataset')
      }
      setItems(data.items ?? [])
      setSelected((data.items ?? [])[0] ?? null)
    } catch (err) {
      setError(String(err))
    } finally {
      setLoading(false)
    }
  }

  async function exportCsv() {
    const response = await fetch('/api/dashboard/export', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filters,
        pagination: { page: 1, pageSize: 5000 },
        actor: 'admin',
        format: 'csv',
      }),
    })
    const csvText = await response.text()
    const blob = new Blob([csvText], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'dataset-export.csv'
    anchor.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div style={{ padding: 24 }}>
      <h1>Selfie Dataset Dashboard</h1>
      <p>Filter by angle, lighting, gender, and demographics.</p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <input placeholder="angle (e.g. high_angle)" value={angle} onChange={(e) => setAngle(e.target.value)} />
        <input placeholder="lighting (dark|normal|bright)" value={lighting} onChange={(e) => setLighting(e.target.value)} />
        <input placeholder="gender" value={gender} onChange={(e) => setGender(e.target.value)} />
        <input placeholder="demographics" value={demographics} onChange={(e) => setDemographics(e.target.value)} />
        <button onClick={loadData} disabled={loading}>
          {loading ? 'Loading...' : 'Apply Filters'}
        </button>
        <button onClick={exportCsv}>Export CSV</button>
      </div>

      {error && <p style={{ color: 'red' }}>{error}</p>}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div>
          <h2>Results ({items.length})</h2>
          <div style={{ maxHeight: 500, overflow: 'auto', border: '1px solid #ddd', borderRadius: 6 }}>
            {items.map((item) => (
              <button
                key={item.selfieId}
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  border: 0,
                  borderBottom: '1px solid #eee',
                  padding: 10,
                  background: selected?.selfieId === item.selfieId ? '#f2f2f2' : 'white',
                }}
                onClick={() => setSelected(item)}
              >
                <div><strong>{item.selfieId}</strong></div>
                <div style={{ fontSize: 12, color: '#666' }}>{item.s3Key}</div>
              </button>
            ))}
          </div>
        </div>

        <div>
          <h2>Detail</h2>
          {selected ? (
            <pre style={{ whiteSpace: 'pre-wrap', border: '1px solid #ddd', borderRadius: 6, padding: 12 }}>
              {JSON.stringify(selected, null, 2)}
            </pre>
          ) : (
            <p>No selection</p>
          )}
        </div>
      </div>
    </div>
  )
}
