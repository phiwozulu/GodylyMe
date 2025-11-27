#!/usr/bin/env node

/**
 * Generate a secure JWT secret for your application
 *
 * Usage:
 *   node generate-jwt-secret.js
 *
 * This will generate a 64-character random hexadecimal string
 * suitable for use as JWT_SECRET environment variable.
 */

const crypto = require('crypto');

const secret = crypto.randomBytes(64).toString('hex');

console.log('\n🔐 JWT Secret Generated\n');
console.log('Copy this value and add it to your Vercel environment variables as JWT_SECRET:\n');
console.log(secret);
console.log('\n📋 To add this to Vercel:');
console.log('1. Go to your Vercel project dashboard');
console.log('2. Navigate to Settings → Environment Variables');
console.log('3. Add a new variable:');
console.log('   - Name: JWT_SECRET');
console.log('   - Value: (paste the secret above)');
console.log('   - Environment: Production, Preview, Development (check all)');
console.log('\nOr use the Vercel CLI:');
console.log(`vercel env add JWT_SECRET production`);
console.log('(then paste the secret when prompted)\n');
