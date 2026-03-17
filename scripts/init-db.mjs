import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const schemaPath = path.join(__dirname, '..', 'infra', 'sql', 'schema.sql')
const connectionString = process.env.POSTGRES_URL

if (!connectionString) {
  console.error('POSTGRES_URL is required.')
  process.exit(1)
}

const schemaSql = await fs.readFile(schemaPath, 'utf8')
const pool = new pg.Pool({
  connectionString,
  ssl: connectionString.includes('localhost') ? false : { rejectUnauthorized: false },
})

try {
  await pool.query(schemaSql)
  console.log('Database schema initialized.')
} finally {
  await pool.end()
}
