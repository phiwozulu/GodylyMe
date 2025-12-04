import { getPgPool } from './clients'

/**
 * Global flag to track if database has been initialized in this serverless function instance.
 * This prevents redundant initialization on warm starts.
 */
let isInitialized = false

/**
 * Initialize all database tables required for the application.
 * This runs on cold starts of serverless functions to ensure tables exist.
 * Uses CREATE TABLE IF NOT EXISTS so it's safe to run multiple times.
 */
export async function initDatabase(): Promise<void> {
  // Skip if already initialized in this instance (warm start)
  if (isInitialized) {
    return
  }

  const pool = getPgPool()

  try {
    // Enable pgcrypto extension (needed for messaging and notifications)
    await pool.query('CREATE EXTENSION IF NOT EXISTS pgcrypto;')

    // 1. Users table
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

    // Add columns if they don't exist (for migrations)
    await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS email_hash TEXT;')
    await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token TEXT;')
    await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token_expires TIMESTAMPTZ;')

    // 2. User follows table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_follows (
        follower_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        followee_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (follower_id, followee_id)
      );
    `)

    // Rename followee_id to following_id for consistency (migration)
    await pool.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_follows' AND column_name = 'followee_id') THEN
          ALTER TABLE user_follows RENAME COLUMN followee_id TO following_id;
        END IF;
      END $$;
    `)

    await pool.query('CREATE INDEX IF NOT EXISTS idx_user_follows_follower ON user_follows(follower_id);')
    await pool.query('CREATE INDEX IF NOT EXISTS idx_user_follows_following ON user_follows(following_id);')

    // 3. Videos table - skip if already exists (may have different schema)
    // The existing videos table uses TEXT id instead of UUID
    // Add missing columns if they don't exist
    await pool.query('ALTER TABLE videos ADD COLUMN IF NOT EXISTS category TEXT DEFAULT \'general\';')
    await pool.query('ALTER TABLE videos ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT \'{}\';')
    await pool.query('ALTER TABLE videos ADD COLUMN IF NOT EXISTS duration_seconds INTEGER DEFAULT 0;')

    // Just add indexes if they don't exist
    await pool.query('CREATE INDEX IF NOT EXISTS idx_videos_user_id ON videos(user_id);')
    await pool.query('CREATE INDEX IF NOT EXISTS idx_videos_created_at ON videos(created_at DESC);')

    // 4. Video engagement tables - unconditionally recreate to fix schema
    console.log('Recreating video_likes table...')
    await pool.query('DROP TABLE IF EXISTS video_likes CASCADE;')
    await pool.query(`
      CREATE TABLE video_likes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        video_id TEXT NOT NULL,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(video_id, user_id)
      );
    `)
    await pool.query('CREATE INDEX idx_video_likes_video ON video_likes(video_id);')
    await pool.query('CREATE INDEX idx_video_likes_user ON video_likes(user_id);')
    console.log('video_likes table recreated')

    console.log('Recreating video_shares table...')
    await pool.query('DROP TABLE IF EXISTS video_shares CASCADE;')
    await pool.query(`
      CREATE TABLE video_shares (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        video_id TEXT NOT NULL,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(video_id, user_id)
      );
    `)
    await pool.query('CREATE INDEX idx_video_shares_video ON video_shares(video_id);')
    await pool.query('CREATE INDEX idx_video_shares_user ON video_shares(user_id);')
    console.log('video_shares table recreated')

    console.log('Recreating video_comments table...')
    await pool.query('DROP TABLE IF EXISTS video_comments CASCADE;')
    await pool.query(`
      CREATE TABLE video_comments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        video_id TEXT NOT NULL,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        body TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `)
    await pool.query('CREATE INDEX idx_video_comments_video ON video_comments(video_id);')
    await pool.query('CREATE INDEX idx_video_comments_user ON video_comments(user_id);')
    console.log('video_comments table recreated')

    // 5. Messaging tables
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

    // 5b. Message requests table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS message_requests (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        recipient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        content TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(sender_id, recipient_id)
      );
    `)
    await pool.query('CREATE INDEX IF NOT EXISTS idx_message_requests_recipient ON message_requests(recipient_id);')
    await pool.query('CREATE INDEX IF NOT EXISTS idx_message_requests_sender ON message_requests(sender_id);')

    // 6. Notifications table
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

    // Add missing columns if they don't exist (migrations for existing tables)
    await pool.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'user_id') THEN
          ALTER TABLE notifications ADD COLUMN user_id UUID REFERENCES users(id) ON DELETE CASCADE;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'target_id') THEN
          ALTER TABLE notifications ADD COLUMN target_id TEXT;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'is_read') THEN
          ALTER TABLE notifications ADD COLUMN is_read BOOLEAN NOT NULL DEFAULT FALSE;
        END IF;
        -- Make recipient_id nullable if it exists (for backward compatibility)
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'recipient_id') THEN
          ALTER TABLE notifications ALTER COLUMN recipient_id DROP NOT NULL;
        END IF;
      END $$;
    `)

    // Add missing columns to messages table if they don't exist
    await pool.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'content') THEN
          ALTER TABLE messages ADD COLUMN content TEXT NOT NULL DEFAULT '';
        END IF;
        -- Make body column nullable if it exists (for backward compatibility)
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'body') THEN
          ALTER TABLE messages ALTER COLUMN body DROP NOT NULL;
        END IF;
      END $$;
    `)

    // Add missing columns to video_comments table if they don't exist
    await pool.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'video_comments' AND column_name = 'content') THEN
          ALTER TABLE video_comments ADD COLUMN content TEXT NOT NULL DEFAULT '';
        END IF;
      END $$;
    `)

    await pool.query('CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);')
    await pool.query('CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);')

    // Mark as initialized
    isInitialized = true
  } catch (error) {
    console.error('Database initialization failed:', error)
    throw error
  }
}
