import "server-only";

import { Resend } from "resend";
import { serverEnv } from "@/lib/env/server";

let resendClient: Resend | null = null;

function getResend(): Resend | null {
  if (!serverEnv.resendApiKey || !serverEnv.resendFromEmail) {
    return null;
  }
  if (!resendClient) {
    resendClient = new Resend(serverEnv.resendApiKey);
  }
  return resendClient;
}

interface TaskEmailParams {
  to: string;
  subject: string;
  taskTitle: string;
  message: string;
}

export async function sendTaskNotification(
  params: TaskEmailParams
): Promise<void> {
  const resend = getResend();
  if (!resend) {
    console.warn("Resend not configured; skipping task email notification.");
    return;
  }

  const { error } = await resend.emails.send({
    from: serverEnv.resendFromEmail,
    to: params.to,
    subject: params.subject,
    html: `
      <h2>${params.subject}</h2>
      <p><strong>Task:</strong> ${params.taskTitle}</p>
      <p>${params.message}</p>
    `,
  });

  if (error) {
    console.error("Failed to send task email:", error);
  }
}

interface LeadEmailParams {
  to: string;
  subject: string;
  leadName: string;
  message: string;
}

export async function sendLeadNotification(
  params: LeadEmailParams
): Promise<void> {
  const resend = getResend();
  if (!resend) {
    console.warn("Resend not configured; skipping lead email notification.");
    return;
  }

  const { error } = await resend.emails.send({
    from: serverEnv.resendFromEmail,
    to: params.to,
    subject: params.subject,
    html: `
      <h2>${params.subject}</h2>
      <p><strong>Lead:</strong> ${params.leadName}</p>
      <p>${params.message}</p>
    `,
  });

  if (error) {
    console.error("Failed to send lead email:", error);
  }
}
