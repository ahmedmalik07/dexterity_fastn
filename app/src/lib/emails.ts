/** Stage emails (T1-T5). Short, warm, human — no corporate filler. */

import { optional } from "./env";

export type Stage = "Applied" | "Shortlisted" | "Interview" | "Offer" | "Rejected";

export type Email = { subject: string; body: string };

const firstNameOf = (name: string) => name.trim().split(/\s+/)[0] || "there";

export function emailForStage(stage: Stage, name: string, jobTitle: string): Email | null {
  const hi = `Hi ${firstNameOf(name)},`;
  const sign = ["", "Best,", "The hiring team"].join("\n");

  switch (stage) {
    // T1 is sent on arrival by the apply route, not by a stage change.
    case "Applied":
      return {
        subject: `We received your application — ${jobTitle}`,
        body: [
          hi,
          "",
          `Thanks for applying for ${jobTitle}. We have your application and your CV.`,
          "",
          "We read every application ourselves, and we will get back to you either way — yes or no.",
          sign,
        ].join("\n"),
      };

    case "Shortlisted":
      return {
        subject: `You have been shortlisted — ${jobTitle}`,
        body: [
          hi,
          "",
          `Good news: you have been shortlisted for ${jobTitle}.`,
          "",
          "We liked what we saw in your CV. Someone from the team will reach out shortly with next steps.",
          sign,
        ].join("\n"),
      };

    case "Interview": {
      const booking = optional("INTERVIEW_BOOKING_URL");
      return {
        subject: `Interview invitation — ${jobTitle}`,
        body: [
          hi,
          "",
          `We would like to interview you for ${jobTitle}.`,
          "",
          booking
            ? `Pick a slot that suits you here: ${booking}`
            : "We will follow up with a few times that could work.",
          "",
          "If none of the times work, just reply to this email and we will find another.",
          sign,
        ].join("\n"),
      };
    }

    case "Offer":
      return {
        subject: `Offer — ${jobTitle}`,
        body: [
          hi,
          "",
          `Congratulations. We would like to offer you the ${jobTitle} role.`,
          "",
          "Someone from HR will call you shortly to talk through the details.",
          sign,
        ].join("\n"),
      };

    case "Rejected":
      return {
        subject: `Update on your application — ${jobTitle}`,
        body: [
          hi,
          "",
          `Thank you for applying for ${jobTitle} and for the time you put into it.`,
          "",
          "We are not moving forward with your application this time. This was a decision about fit for this specific role, and it is not a verdict on your ability.",
          "",
          "We would genuinely welcome an application from you for a future opening.",
          sign,
        ].join("\n"),
      };

    default:
      return null;
  }
}
