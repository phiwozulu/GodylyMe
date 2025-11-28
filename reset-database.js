const { Pool } = require('pg')

let databaseUrl = process.env.DATABASE_URL || 'postgres://postgres:TRcvMYUvzEs-2-7YR-gb@postgresql-godlyme-u57058.vm.elestio.app:25432/postgres?sslmode=require'
databaseUrl = databaseUrl.replace(/[?&]sslmode=[^&]*/g, '')

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: { rejectUnauthorized: false }
})

async function resetDatabase() {
  console.log('🗑️  Dropping all tables...')
  try {
    await pool.query('DROP TABLE IF EXISTS notifications CASCADE;')
    await pool.query('DROP TABLE IF EXISTS messages CASCADE;')
    await pool.query('DROP TABLE IF EXISTS thread_participants CASCADE;')
    await pool.query('DROP TABLE IF EXISTS message_threads CASCADE;')
    await pool.query('DROP TABLE IF EXISTS video_shares CASCADE;')
    await pool.query('DROP TABLE IF EXISTS video_comments CASCADE;')
    await pool.query('DROP TABLE IF EXISTS video_likes CASCADE;')
    await pool.query('DROP TABLE IF EXISTS videos CASCADE;')
    await pool.query('DROP TABLE IF NOT EXISTS user_follows CASCADE;')
    await pool.query('DROP TABLE IF EXISTS users CASCADE;')
    console.log('✅ All tables dropped. Now run: node init-database.js')
  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await pool.end()
  }
}

resetDatabase()
