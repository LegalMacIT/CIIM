"use server";

import { auth, currentUser } from "@clerk/nextjs/server";
import { Resend } from "resend";
import { createServiceClient } from "@/lib/supabase";
import { resolveCustomerId } from "./_customer";

function toICSDate(dateStr: string, timeStr: string): string {
  const d = dateStr.replace(/-/g, "");
  const [h, m] = timeStr.split(":");
  return `${d}T${h.padStart(2, "0")}${m.padStart(2, "0")}00`;
}

function addHoursToICSDate(dateStr: string, timeStr: string, hours: number): string {
  const [h, m] = timeStr.split(":").map(Number);
  const totalMins = h * 60 + m + hours * 60;
  const newH = Math.floor(totalMins / 60) % 24;
  const newM = totalMins % 60;
  const extraDays = Math.floor(totalMins / (24 * 60));

  let newDate = dateStr;
  if (extraDays > 0) {
    const d = new Date(dateStr + "T12:00:00");
    d.setDate(d.getDate() + extraDays);
    newDate = d.toISOString().split("T")[0];
  }

  return toICSDate(newDate, `${String(newH).padStart(2, "0")}:${String(newM).padStart(2, "0")}`);
}

function buildICS(summary: string, description: string, startDate: string, startTime: string): string {
  const dtStart = toICSDate(startDate, startTime);
  const dtEnd = addHoursToICSDate(startDate, startTime, 3);
  const uid = `${Date.now()}@ciim.carmconsulting.com`;
  const dtstamp = new Date().toISOString().replace(/[-:.]/g, "").slice(0, 15) + "Z";

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//CARM Consulting Inc//CIIM//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:REQUEST",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${dtstamp}`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `SUMMARY:${summary}`,
    `DESCRIPTION:${description}`,
    "ORGANIZER;CN=Hector Cruz:mailto:hcruz@carmconsulting.com",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}

export async function sendCalendarInvite(adminCustomerId?: string): Promise<{ error?: string }> {
  const { userId } = await auth();
  if (!userId) return { error: "Unauthenticated" };

  const clerkUser = await currentUser();
  const userEmail = clerkUser?.emailAddresses?.[0]?.emailAddress;
  if (!userEmail) return { error: "No email address found for your account" };

  let customerId: string | null;
  if (adminCustomerId) {
    if ((clerkUser?.publicMetadata as { role?: string })?.role !== "admin") {
      return { error: "Unauthorized" };
    }
    customerId = adminCustomerId;
  } else {
    customerId = await resolveCustomerId(userId);
  }
  if (!customerId) return { error: "Client record not found" };

  const supabase = createServiceClient();
  const { data: rows } = await supabase
    .from("form_values")
    .select("field_key, field_value")
    .eq("customer_id", customerId)
    .in("field_key", ["final_trans_date", "final_trans_hour", "firm_company_nickname"]);

  const vals: Record<string, string> = {};
  for (const row of rows ?? []) vals[row.field_key] = row.field_value ?? "";

  const date = vals["final_trans_date"];
  const time = vals["final_trans_hour"];
  const nickname = vals["firm_company_nickname"] || "Your Firm";

  if (!date || !time) return { error: "Final Transition Date and Time must be set before sending an invitation" };

  const summary = `${nickname} - iManage C2C Final Transition`;
  const description = "This event is a placeholder on your calendar. You may forward this event to iManage C2C project team members.";
  const ics = buildICS(summary, description, date, time);

  const resend = new Resend(process.env.RESEND_API_KEY);
  const { error } = await resend.emails.send({
    from: "Hector Cruz <hcruz@carmconsulting.com>",
    to: [userEmail],
    subject: "iManage C2C Final Transition",
    text: description,
    attachments: [
      {
        filename: "invite.ics",
        content: Buffer.from(ics),
      },
    ],
  });

  if (error) return { error: error.message };
  return {};
}
