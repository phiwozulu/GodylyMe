const { Client } = require('pg')

async function verifyUser() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
  })

  try {
    await client.connect()
    console.log('Connected to database')

    // Find all unverified users
    const unverifiedUsers = await client.query(
      'SELECT id, email FROM users WHERE is_verified = false'
    )

    if (unverifiedUsers.rows.length === 0) {
      console.log('✓ No unverified accounts to delete')
      return
    }

    console.log(`Found ${unverifiedUsers.rows.length} unverified accounts`)

    // Delete each unverified user and their related data
    for (const user of unverifiedUsers.rows) {
      const userIdValue = user.id

      // Delete related data first (ignore errors if tables don't exist)
      try {
        await client.query('DELETE FROM video_comments WHERE user_id = $1', [userIdValue])
      } catch (e) {}
      try {
        await client.query('DELETE FROM video_likes WHERE user_id = $1', [userIdValue])
      } catch (e) {}
      try {
        await client.query('DELETE FROM video_shares WHERE user_id = $1', [userIdValue])
      } catch (e) {}
      try {
        await client.query('DELETE FROM videos WHERE user_id = $1', [userIdValue])
      } catch (e) {}
      try {
        await client.query('DELETE FROM follows WHERE follower_id = $1 OR following_id = $1', [userIdValue])
      } catch (e) {}

      // Delete the user
      await client.query('DELETE FROM users WHERE id = $1', [userIdValue])
      console.log(`✓ Deleted unverified account: ${user.email}`)
    }

    console.log(`\n✓ Successfully deleted ${unverifiedUsers.rows.length} unverified accounts`)
  } catch (error) {
    console.error('Error:', error.message)
  } finally {
    await client.end()
  }
}

verifyUser()
