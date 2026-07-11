const ZONE = "America/Denver";

function zonedParts(date, includeDate = false) {
  const options = { timeZone: ZONE, weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" };
  if (includeDate) Object.assign(options, { year: "numeric", month: "2-digit", day: "2-digit" });
  return Object.fromEntries(new Intl.DateTimeFormat("en-US", options).formatToParts(date).filter(part => part.type !== "literal").map(part => [part.type, part.value]));
}

function isWeeklyPublicationSlot(date = new Date()) {
  const parts = zonedParts(date);
  return parts.weekday === "Sat" && Number(parts.hour) === 7;
}

function isExactPublicationSlot(date) {
  const parts = zonedParts(date);
  return parts.weekday === "Sat" && Number(parts.hour) === 7 && Number(parts.minute) === 0;
}

function isCurrentPublicationWindow(publishAt, now = new Date()) {
  const publishDate = publishAt instanceof Date ? publishAt : new Date(publishAt);
  if (!Number.isFinite(publishDate.getTime()) || publishDate > now) return false;
  const age = now.getTime() - publishDate.getTime();
  return age <= 90 * 60 * 1000 && isWeeklyPublicationSlot(now);
}

function publicationPreflight(issue, config = {}) {
  const checks = [
    { key: "title", label: "Title", ok: Boolean(String(issue?.title || "").trim()), blocking: true },
    { key: "trainer", label: "Trainer name", ok: Boolean(String(issue?.trainerName || "").trim()), blocking: true },
    { key: "summary", label: "Summary", ok: Boolean(String(issue?.summary || "").trim()), blocking: true },
    { key: "article", label: "Article body", ok: Boolean(String(issue?.bodyHtml || "").trim()), blocking: true },
    { key: "hero", label: "Hero image", ok: Boolean(issue?.images?.[0]?.objectPath || issue?.images?.[0]?.url), blocking: true },
    { key: "interview", label: "Interview answers", ok: Array.isArray(issue?.interviewAnswers) && issue.interviewAnswers.length > 0, blocking: true },
    { key: "test-email", label: "Test email sent", ok: Boolean(issue?.lastTestEmailAt), blocking: true },
    { key: "not-test", label: "Not marked as a test issue", ok: issue?.isTest !== true, blocking: true },
    { key: "sender", label: "Sender credentials", ok: Boolean(config.senderConfigured), blocking: true },
    { key: "live-group", label: "Sender live group", ok: Boolean(config.liveGroupConfigured), blocking: true },
    { key: "live-enabled", label: "Live sending enabled", ok: Boolean(config.liveSendEnabled), blocking: false }
  ];
  const scheduledDate = issue?.publishAt?.toDate?.() || (issue?.publishAt ? new Date(issue.publishAt) : null);
  if (issue?.status === "scheduled" || scheduledDate) checks.splice(8, 0, { key: "slot", label: "Saturday 7:00 AM Mountain slot", ok: Boolean(scheduledDate && isExactPublicationSlot(scheduledDate)), blocking: true });
  return {
    checks,
    readyToSchedule: checks.filter(check => check.blocking).every(check => check.ok),
    readyToPublish: checks.every(check => check.ok)
  };
}

module.exports = { ZONE, isWeeklyPublicationSlot, isExactPublicationSlot, isCurrentPublicationWindow, publicationPreflight };
