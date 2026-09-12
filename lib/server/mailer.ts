/**
 * Outbound email for booking announcements.
 *
 * Uses Resend's HTTP API when RESEND_API_KEY and MAIL_FROM are set — chosen
 * because it is one fetch call, so the app needs no SMTP dependency and works
 * on serverless runtimes. With no key configured the message is logged instead
 * of dropped, so the flow is still testable and the API still reports honestly
 * whether anything was actually delivered.
 *
 * Recipients go in BCC: a class roster should not leak to the whole class.
 */
export type MailDelivery = "sent" | "logged" | "skipped" | "failed";

export type MailResult = {
  delivery: MailDelivery;
  detail?: string;
};

export type MailMessage = {
  recipients: string[];
  subject: string;
  text: string;
};

export function isMailConfigured(): boolean {
  return Boolean(
    process.env.RESEND_API_KEY?.trim() &&
      process.env.MAIL_FROM?.trim().replace(/^["']|["']$/g, ""),
  );
}

export async function sendMail(message: MailMessage): Promise<MailResult> {
  const recipients = Array.from(
    new Set(message.recipients.map((r) => r.trim().toLowerCase()).filter(Boolean)),
  );

  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.MAIL_FROM?.trim().replace(/^["']|["']$/g, "");
  if (!apiKey || !from) {
    console.info(
      `[studyspace] email not configured; would have sent "${message.subject}" to ${recipients.length} recipient(s)`,
    );
    return {
      delivery: "logged",
      detail: recipients.length
        ? `Resend is not configured; set RESEND_API_KEY and MAIL_FROM to email ${recipients.length} classmate(s)`
        : "Resend is not configured; set RESEND_API_KEY and MAIL_FROM to deliver booking announcements",
    };
  }

  if (recipients.length === 0) {
    return { delivery: "skipped", detail: "no classmates with an email for this course yet" };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [from],
        bcc: recipients,
        subject: message.subject,
        text: message.text,
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      return {
        delivery: "failed",
        detail: `mail provider returned ${res.status}: ${body.slice(0, 200)}`,
      };
    }
    return { delivery: "sent" };
  } catch (error) {
    return {
      delivery: "failed",
      detail: error instanceof Error ? error.message : "mail request failed",
    };
  }
}

/** Loose check that keeps obvious junk out of the subscriber list. */
export function isEmailish(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim());
}
