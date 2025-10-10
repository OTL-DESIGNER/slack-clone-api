import nodemailer from 'nodemailer'
import sgMail from '@sendgrid/mail'

export default async function sendEmail(
  to: string,
  subject: string,
  html?: string,
  text?: string,
) {
  try {
    let transporter

    // Use Ethereal Email only when SendGrid API key is not provided
    if (!process.env.SENDGRID_API_KEY) {
      // Create Ethereal test account
      const testAccount = await nodemailer.createTestAccount()

      transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
      })

      const info = await transporter.sendMail({
        from: testAccount.user,
        to,
        subject,
        html,
        text,
      })

      // Log the preview URL for development
      console.log('📧 Email sent via Ethereal (test mode)')
      console.log('📧 Preview URL:', nodemailer.getTestMessageUrl(info))
      console.log('📧 Verification code can be viewed at the preview URL above')
    } else {
      // Use SendGrid for real email delivery
      sgMail.setApiKey(process.env.SENDGRID_API_KEY)

      const msg = {
        to,
        from: process.env.SMTP_USERNAME || 'noreply@ontoplocal.com',
        subject,
        html,
        text,
      }

      await sgMail.send(msg)
      console.log('📧 Email sent successfully via SendGrid to:', to)
    }
  } catch (error) {
    console.log('❌ Email sending failed:', error)
  }
}
