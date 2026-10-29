import nodemailer, { Transporter } from 'nodemailer';

let transporterPromise: Promise<Transporter> | null = null;

/**
 * Initializes or reuses the Nodemailer transporter.
 * Uses Ethereal Email for safe development/testing.
 */
export async function getEmailTransporter(): Promise<Transporter> {
  if (transporterPromise) return transporterPromise;

  transporterPromise = (async () => {
    // Check if custom Ethereal/SMTP credentials are provided in .env
    if (process.env.ETHEREAL_USER && process.env.ETHEREAL_PASS) {
      return nodemailer.createTransport({
        host: process.env.ETHEREAL_HOST || 'smtp.ethereal.email',
        port: process.env.ETHEREAL_PORT ? parseInt(process.env.ETHEREAL_PORT, 10) : 587,
        auth: {
          user: process.env.ETHEREAL_USER,
          pass: process.env.ETHEREAL_PASS,
        },
      });
    }

    // Auto-generate test account on Ethereal
    console.log('📬 Setting up Ethereal test account for email delivery...');
    const testAccount = await nodemailer.createTestAccount();
    console.log(`✅ Ethereal account ready: ${testAccount.user}`);

    return nodemailer.createTransport({
      host: testAccount.smtp.host,
      port: testAccount.smtp.port,
      secure: testAccount.smtp.secure,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    });
  })();

  return transporterPromise;
}

export interface SendEmailPayload {
  sender?: string;
  recipient: string;
  subject: string;
  body: string;
}

export interface SendEmailResult {
  messageId: string;
  previewUrl: string | false;
}

/**
 * Sends an email via Nodemailer using Ethereal.
 * Returns the message ID and web preview URL.
 */
export async function sendEmail({
  sender,
  recipient,
  subject,
  body,
}: SendEmailPayload): Promise<SendEmailResult> {
  const transporter = await getEmailTransporter();
  const fromAddress = sender
    ? `"${sender}" <scheduler@ethereal.email>`
    : '"Email Scheduler" <scheduler@ethereal.email>';

  const info = await transporter.sendMail({
    from: fromAddress,
    to: recipient,
    subject,
    text: body,
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eaeaea; border-radius: 8px;">
        <h2 style="color: #2563eb; margin-top: 0;">${subject}</h2>
        <div style="background-color: #f8fafc; padding: 15px; border-radius: 6px; margin: 15px 0;">
          <p style="white-space: pre-wrap; margin: 0;">${body}</p>
        </div>
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
        <p style="font-size: 12px; color: #64748b; margin: 0;">
          Sender: <strong>${sender || 'default'}</strong> | Dispatched via <strong>Email Scheduler Backend</strong>
        </p>
      </div>
    `,
  });

  const previewUrl = nodemailer.getTestMessageUrl(info);

  console.log(`====================================================`);
  console.log(`✉️ Email Dispatched to: ${recipient}`);
  console.log(`👤 Sender: ${sender || 'default-sender'}`);
  console.log(`🆔 Message ID: ${info.messageId}`);
  if (previewUrl) {
    console.log(`🔗 Ethereal Preview URL: ${previewUrl}`);
  }
  console.log(`====================================================`);

  return {
    messageId: info.messageId,
    previewUrl,
  };
}
