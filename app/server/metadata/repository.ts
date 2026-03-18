import { Pool } from 'pg'
import { TagSelfieOutputSchema } from '../../contracts/tools'
import { env } from '../config/env'

export interface DatasetRecord {
  selfieId: string
  sessionId: string
  userId: string
  s3Key: string
  verificationStatus: string
  consented: boolean
  paid: boolean
  tags: ReturnType<typeof TagSelfieOutputSchema.parse>['tags'] | null
  confidence: number | null
  modelName: string | null
  modelVersion: string | null
  createdAt: string
}

const memoryRecords = new Map<string, DatasetRecord>()
const memoryAudit: Array<{ action: string; actor: string; metadata: Record<string, unknown>; createdAt: string }> = []

const pool = env.postgresUrl
  ? new Pool({
      connectionString: env.postgresUrl,
      ssl: env.postgresUrl.includes('localhost') ? false : { rejectUnauthorized: false },
    })
  : null

export async function upsertDatasetRecord(record: DatasetRecord): Promise<void> {
  if (!pool) {
    memoryRecords.set(record.selfieId, record)
    return
  }

  await pool.query(
    `
      INSERT INTO dataset_records (
        selfie_id, session_id, user_id, s3_key, verification_status,
        consented, paid, tags, confidence, model_name, model_version, created_at
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10,$11,$12::timestamptz)
      ON CONFLICT (selfie_id)
      DO UPDATE SET
        session_id = EXCLUDED.session_id,
        user_id = EXCLUDED.user_id,
        s3_key = EXCLUDED.s3_key,
        verification_status = EXCLUDED.verification_status,
        consented = EXCLUDED.consented,
        paid = EXCLUDED.paid,
        tags = EXCLUDED.tags,
        confidence = EXCLUDED.confidence,
        model_name = EXCLUDED.model_name,
        model_version = EXCLUDED.model_version,
        created_at = EXCLUDED.created_at
    `,
    [
      record.selfieId,
      record.sessionId,
      record.userId,
      record.s3Key,
      record.verificationStatus,
      record.consented,
      record.paid,
      JSON.stringify(record.tags ?? {}),
      record.confidence,
      record.modelName,
      record.modelVersion,
      record.createdAt,
    ],
  )
}

type DatasetFilters = {
  angle?: string[]
  lighting?: string[]
  gender?: string[]
  demographics?: string[]
  verified?: boolean
  consented?: boolean
  paid?: boolean
}

export async function queryDataset(filters: DatasetFilters, page: number, pageSize: number) {
  if (!pool) {
    let values = Array.from(memoryRecords.values())
    values = values.filter((record) => {
      if (typeof filters.verified === 'boolean') {
        const isVerified = record.verificationStatus === 'verified'
        if (isVerified !== filters.verified) return false
      }
      if (typeof filters.consented === 'boolean' && record.consented !== filters.consented) return false
      if (typeof filters.paid === 'boolean' && record.paid !== filters.paid) return false
      if (filters.angle?.length && (!record.tags || !filters.angle.includes(record.tags.angle))) return false
      if (filters.lighting?.length && (!record.tags || !filters.lighting.includes(record.tags.lighting))) return false
      if (filters.gender?.length && (!record.tags || !filters.gender.includes(record.tags.gender))) return false
      if (
        filters.demographics?.length &&
        (!record.tags || !record.tags.demographics.some((item: string) => filters.demographics?.includes(item)))
      ) {
        return false
      }
      return true
    })

    const start = (page - 1) * pageSize
    return { total: values.length, items: values.slice(start, start + pageSize) }
  }

  const values: unknown[] = []
  const conditions: string[] = []

  if (typeof filters.verified === 'boolean') {
    values.push(filters.verified ? 'verified' : 'pending')
    conditions.push(`verification_status = $${values.length}`)
  }
  if (typeof filters.consented === 'boolean') {
    values.push(filters.consented)
    conditions.push(`consented = $${values.length}`)
  }
  if (typeof filters.paid === 'boolean') {
    values.push(filters.paid)
    conditions.push(`paid = $${values.length}`)
  }
  if (filters.angle?.length) {
    values.push(filters.angle)
    conditions.push(`tags ->> 'angle' = ANY($${values.length}::text[])`)
  }
  if (filters.lighting?.length) {
    values.push(filters.lighting)
    conditions.push(`tags ->> 'lighting' = ANY($${values.length}::text[])`)
  }
  if (filters.gender?.length) {
    values.push(filters.gender)
    conditions.push(`tags ->> 'gender' = ANY($${values.length}::text[])`)
  }
  if (filters.demographics?.length) {
    values.push(filters.demographics)
    conditions.push(`(tags -> 'demographics') ?| $${values.length}::text[]`)
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
  values.push(pageSize)
  values.push((page - 1) * pageSize)

  const dataQuery = `
    SELECT selfie_id, session_id, user_id, s3_key, verification_status, consented, paid, tags, confidence, model_name, model_version, created_at
    FROM dataset_records
    ${whereClause}
    ORDER BY created_at DESC
    LIMIT $${values.length - 1}
    OFFSET $${values.length}
  `

  const countQuery = `SELECT COUNT(*)::int AS total FROM dataset_records ${whereClause}`
  const countValues = values.slice(0, values.length - 2)

  const [dataRes, countRes] = await Promise.all([pool.query(dataQuery, values), pool.query(countQuery, countValues)])
  return {
    total: countRes.rows[0]?.total ?? 0,
    items: dataRes.rows.map((row) => ({
      selfieId: row.selfie_id,
      sessionId: row.session_id,
      userId: row.user_id,
      s3Key: row.s3_key,
      verificationStatus: row.verification_status,
      consented: row.consented,
      paid: row.paid,
      tags: row.tags,
      confidence: row.confidence,
      modelName: row.model_name,
      modelVersion: row.model_version,
      createdAt: row.created_at,
    })),
  }
}

export async function recordAuditLog(action: string, actor: string, metadata: Record<string, unknown>) {
  const createdAt = new Date().toISOString()
  if (!pool) {
    memoryAudit.push({ action, actor, metadata, createdAt })
    return
  }

  await pool.query(
    `
      INSERT INTO audit_logs (action, actor, metadata, created_at)
      VALUES ($1, $2, $3::jsonb, $4::timestamptz)
    `,
    [action, actor, JSON.stringify(metadata), createdAt],
  )
}

export async function listDatasetRecordsBySession(sessionId: string): Promise<DatasetRecord[]> {
  if (!pool) {
    return Array.from(memoryRecords.values()).filter((record) => record.sessionId === sessionId)
  }

  const result = await pool.query(
    `
      SELECT selfie_id, session_id, user_id, s3_key, verification_status, consented, paid, tags, confidence, model_name, model_version, created_at
      FROM dataset_records
      WHERE session_id = $1
      ORDER BY created_at DESC
    `,
    [sessionId],
  )

  return result.rows.map((row) => ({
    selfieId: row.selfie_id,
    sessionId: row.session_id,
    userId: row.user_id,
    s3Key: row.s3_key,
    verificationStatus: row.verification_status,
    consented: row.consented,
    paid: row.paid,
    tags: row.tags,
    confidence: row.confidence,
    modelName: row.model_name,
    modelVersion: row.model_version,
    createdAt: row.created_at,
  }))
}

export async function deleteDatasetRecordsBySession(sessionId: string): Promise<number> {
  if (!pool) {
    let deleted = 0
    for (const [key, value] of memoryRecords.entries()) {
      if (value.sessionId === sessionId) {
        memoryRecords.delete(key)
        deleted += 1
      }
    }
    return deleted
  }

  const result = await pool.query(
    `
      DELETE FROM dataset_records
      WHERE session_id = $1
    `,
    [sessionId],
  )
  return result.rowCount ?? 0
}
