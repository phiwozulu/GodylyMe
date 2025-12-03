const nodemailer = require('nodemailer');

// SMTP configuration from .env.vercel
const config = {
  host: 'smtp.hostinger.com',
  port: 587,
  secure: false, // true for 465, false for other ports
  auth: {
    user: 'verification@godlyme.com',
    pass: 'BoboandPhiwoRock2025!',
  },
};

console.log('Testing SMTP connection...');
console.log('Host:', config.host);
console.log('Port:', config.port);
console.log('User:', config.auth.user);

const transporter = nodemailer.createTransport(config);

// Verify connection
transporter.verify((error, success) => {
  if (error) {
    console.error('\n❌ SMTP Connection Failed:');
    console.error(error.message);
    console.error('\nFull error:', error);
  } else {
    console.log('\n✅ SMTP Server is ready to send emails');

    // Try sending a test email
    console.log('\nSending test email...');
    transporter.sendMail({
      from: '"Godly Me Verification" <verification@godlyme.com>',
      to: 'bohlaleshasha04@gmail.com',
      subject: 'Test Email from Godlyme',
      text: 'If you receive this, SMTP is working correctly!',
      html: '<h1>Test Email</h1><p>If you receive this, SMTP is working correctly!</p>',
    }, (err, info) => {
      if (err) {
        console.error('\n❌ Failed to send email:');
        console.error(err.message);
        console.error('\nFull error:', err);
      } else {
        console.log('\n✅ Email sent successfully!');
        console.log('Message ID:', info.messageId);
        console.log('Response:', info.response);
      }
      process.exit(err ? 1 : 0);
    });
  }
});
