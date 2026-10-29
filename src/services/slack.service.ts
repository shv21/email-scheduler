export interface SlackAlertDetails {
  sender: string;
  emailId: string;
  limit: number;
  retryAfterSeconds: number;
}

/**
 * Dispatches a Slack notification when a sender hits the hourly rate limit.
 * If SLACK_WEBHOOK_URL is configured in .env, sends HTTP POST to Slack.
 * Also prints structured log banner to terminal.
 */
export async function sendSlackRateLimitAlert(details: {
  sender: string;
  emailId: string;
  limit: number;
  retryAfterSeconds: number;
}): Promise<void> {
  const { sender, emailId, limit, retryAfterSeconds } = details;
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;

  console.log(`\n🚨 ===================== [SLACK ALERT TRIGGERED] =====================`);
  console.log(`🚨 Event: Hourly Rate Limit Hit`);
  console.log(`🚨 Sender: ${sender}`);
  console.log(`🚨 Configured Limit: ${limit} email(s) per hour`);
  console.log(`🚨 Email ID: ${emailId}`);
  console.log(`🚨 Action: Job rescheduled to retry in ${retryAfterSeconds} seconds`);
  console.log(`🚨 Deduplication: Triggered exactly ONCE for this hour window`);
  console.log(`🚨 ====================================================================\n`);

  if (!webhookUrl) {
    console.log(`ℹ️ [Slack Service] No SLACK_WEBHOOK_URL configured in .env. Alert logged to console.`);
    return;
  }

  try {
    const payload = {
      text: `🚨 *Email Scheduler Rate Limit Alert*: Sender \`${sender}\` has hit the hourly rate limit.`,
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: '🚨 Email Scheduler: Rate Limit Exceeded',
            emoji: true,
          },
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: `*Sender:*\n\`${sender}\``,
            },
            {
              type: 'mrkdwn',
              text: `*Hourly Limit:*\n${limit} email(s)/hour`,
            },
            {
              type: 'mrkdwn',
              text: `*Email ID:*\n\`${emailId}\``,
            },
            {
              type: 'mrkdwn',
              text: `*Next Attempt:*\nIn ~${Math.ceil(retryAfterSeconds / 60)} minutes (${retryAfterSeconds}s)`,
            },
          ],
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: '⚠️ Job was *rescheduled* (not dropped). This alert triggers only *once* per hourly window.',
            },
          ],
        },
      ],
    };

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (response.ok) {
      console.log(`✅ [Slack Service] Alert successfully posted to Slack channel.`);
    } else {
      console.warn(`⚠️ [Slack Service] Slack webhook returned status ${response.status}: ${await response.text()}`);
    }
  } catch (err: unknown) {
    console.error(`❌ [Slack Service] Failed to send Slack alert:`, err instanceof Error ? err.message : err);
  }
}
