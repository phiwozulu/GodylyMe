// Database initialization script
// Run this ONCE to create all required database tables
// Usage: node init-database.js

const { Pool } = require('pg')

// Get database URL from environment or use the one from your .env
let databaseUrl = process.env.DATABASE_URL || 'postgres://postgres:TRcvMYUvzEs-2-7YR-gb@postgresql-godlyme-u57058.vm.elestio.app:25432/postgres?sslmode=require'

// Remove sslmode from URL (we'll handle it via config)
databaseUrl = databaseUrl.replace(/[?&]sslmode=[^&]*/g, '')

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: {
    rejectUnauthorized: false
  }
})

async function initializeDatabase() {
  console.log('🚀 Starting database initialization...')

  try {
    // Enable pgcrypto extension
    console.log('  ➜ Creating pgcrypto extension...')
    await pool.query('CREATE EXTENSION IF NOT EXISTS pgcrypto;')

    // 1. Users table
    console.log('  ➜ Creating users table...')
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY,
        handle TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        church TEXT,
        country TEXT,
        photo_url TEXT,
        is_verified BOOLEAN NOT NULL DEFAULT FALSE,
        verification_token TEXT,
        verification_token_expires TIMESTAMPTZ,
        email_hash TEXT,
        reset_token TEXT,
        reset_token_expires TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `)

    // 2. User follows table
    console.log('  ➜ Creating user_follows table...')
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_follows (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        follower_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        following_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(follower_id, following_id)
      );
    `)
    await pool.query('CREATE INDEX IF NOT EXISTS idx_user_follows_follower ON user_follows(follower_id);')
    await pool.query('CREATE INDEX IF NOT EXISTS idx_user_follows_following ON user_follows(following_id);')

    // 3. Videos table
    console.log('  ➜ Creating videos table...')
    await pool.query(`
      CREATE TABLE IF NOT EXISTS videos (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        description TEXT,
        video_url TEXT NOT NULL,
        thumbnail_url TEXT,
        duration INTEGER,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `)
    await pool.query('CREATE INDEX IF NOT EXISTS idx_videos_user_id ON videos(user_id);')
    await pool.query('CREATE INDEX IF NOT EXISTS idx_videos_created_at ON videos(created_at DESC);')

    // 4. Video engagement tables
    console.log('  ➜ Creating video engagement tables...')
    await pool.query(`
      CREATE TABLE IF NOT EXISTS video_likes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        video_id UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(video_id, user_id)
      );
    `)
    await pool.query('CREATE INDEX IF NOT EXISTS idx_video_likes_video ON video_likes(video_id);')
    await pool.query('CREATE INDEX IF NOT EXISTS idx_video_likes_user ON video_likes(user_id);')

    await pool.query(`
      CREATE TABLE IF NOT EXISTS video_comments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        video_id UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        content TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `)
    await pool.query('CREATE INDEX IF NOT EXISTS idx_video_comments_video ON video_comments(video_id);')

    await pool.query(`
      CREATE TABLE IF NOT EXISTS video_shares (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        video_id UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(video_id, user_id)
      );
    `)

    // 5. Messaging tables
    console.log('  ➜ Creating messaging tables...')
    await pool.query(`
      CREATE TABLE IF NOT EXISTS message_threads (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `)

    await pool.query(`
      CREATE TABLE IF NOT EXISTS thread_participants (
        thread_id UUID NOT NULL REFERENCES message_threads(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        PRIMARY KEY (thread_id, user_id)
      );
    `)
    await pool.query('CREATE INDEX IF NOT EXISTS idx_thread_participants_user ON thread_participants(user_id);')

    await pool.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        thread_id UUID NOT NULL REFERENCES message_threads(id) ON DELETE CASCADE,
        sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        content TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `)
    await pool.query('CREATE INDEX IF NOT EXISTS idx_messages_thread ON messages(thread_id);')

    // 6. Notifications table
    console.log('  ➜ Creating notifications table...')
    await pool.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        type TEXT NOT NULL,
        actor_id UUID REFERENCES users(id) ON DELETE CASCADE,
        target_id UUID,
        is_read BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `)
    await pool.query('CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);')
    await pool.query('CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);')

    console.log('✅ Database initialization complete!')
    console.log('   All tables and indexes have been created.')

  } catch (error) {
    console.error('❌ Database initialization failed:', error)
    process.exit(1)
  } finally {
    await pool.end()
  }
}

initializeDatabase()
