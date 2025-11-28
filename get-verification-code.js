const { Pool } = require('pg')

let databaseUrl = process.env.DATABASE_URL || 'postgres://postgres:TRcvMYUvzEs-2-7YR-gb@postgresql-godlyme-u57058.vm.elestio.app:25432/postgres?sslmode=require'
databaseUrl = databaseUrl.replace(/[?&]sslmode=[^&]*/g, '')

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: { rejectUnauthorized: false }
})

async function getCode() {
  try {
    const result = await pool.query('SELECT email, verification_token FROM users WHERE email = $1', ['test@example.com'])
    if (result.rows[0]) {
      console.log('Verification Code:', result.rows[0].verification_token)
    } else {
      console.log('User not found')
    }
  } catch (error) {
    console.error('Error:', error)
  } finally {
    await pool.end()
  }
}

getCode()
