const { Pool } = require('pg')

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
})

async function checkSchema() {
  try {
    // Check notifications table
    const result = await pool.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'notifications'
      ORDER BY ordinal_position
    `)

    console.log('Notifications table columns:')
    console.log(JSON.stringify(result.rows, null, 2))

    // Check if table exists
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'notifications'
      )
    `)
    console.log('\nTable exists:', tableCheck.rows[0].exists)

  } catch (error) {
    console.error('Error:', error.message)
  } finally {
    await pool.end()
  }
}

checkSchema()
