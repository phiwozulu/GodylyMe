import type { VercelRequest, VercelResponse } from '@vercel/node'
import { compose, cors, errorHandler } from './_lib/serverless'
import { sendEmail } from './_lib/emailService'

async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  const { email } = req.body

  if (!email) {
    return res.status(400).json({ message: 'Email is required' })
  }

  try {
    // Log environment variables (without showing sensitive data)
    const smtpConfig = {
      host: process.env.SMTP_HOST ? '✓ Set' : '✗ Missing',
      port: process.env.SMTP_PORT ? '✓ Set' : '✗ Missing',
      user: process.env.SMTP_USER ? '✓ Set' : '✗ Missing',
      pass: process.env.SMTP_PASS ? '✓ Set' : '✗ Missing',
      from: process.env.EMAIL_FROM ? '✓ Set' : '✗ Missing',
    }

    console.log('SMTP Configuration:', smtpConfig)

    await sendEmail({
      to: email,
      subject: 'Test Email from Godlyme',
      html: '<h1>Test Email</h1><p>If you received this, email sending is working!</p>',
      text: 'Test Email - If you received this, email sending is working!',
    })

    res.json({
      message: 'Test email sent successfully',
      config: smtpConfig
    })
  } catch (error) {
    console.error('Email sending error:', error)
    res.status(500).json({
      message: 'Failed to send email',
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    })
  }
}

export default compose(cors, errorHandler)(handler)
