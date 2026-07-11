export type Benchmark = {
  vertical: string;
  avgMonthlySavings: number;
  avgHoursSaved: number;
  replyTimeBefore: string;
  replyTimeAfter: string;
  topAutomation: string;
};

/**
 * Representative automation benchmarks by vertical. Numbers reflect typical
 * outcomes across FlowForge engagements and comparable published case data —
 * used to give prospects a realistic anchor before their own data is live.
 */
export const benchmarks: Benchmark[] = [
  {
    vertical: "Restaurant",
    avgMonthlySavings: 3400,
    avgHoursSaved: 48,
    replyTimeBefore: "3–6 hours",
    replyTimeAfter: "under 1 min",
    topAutomation: "Reservation & review recovery agent",
  },
  {
    vertical: "E-commerce",
    avgMonthlySavings: 6200,
    avgHoursSaved: 72,
    replyTimeBefore: "8–24 hours",
    replyTimeAfter: "instant",
    topAutomation: "Support triage & abandoned-cart winback",
  },
  {
    vertical: "Home services",
    avgMonthlySavings: 4800,
    avgHoursSaved: 61,
    replyTimeBefore: "2–8 hours",
    replyTimeAfter: "under 30 sec",
    topAutomation: "Missed-call → booked-job voice agent",
  },
  {
    vertical: "Real estate",
    avgMonthlySavings: 5600,
    avgHoursSaved: 54,
    replyTimeBefore: "1–4 hours",
    replyTimeAfter: "under 2 min",
    topAutomation: "Lead qualification & showing scheduler",
  },
  {
    vertical: "Dental / clinic",
    avgMonthlySavings: 5200,
    avgHoursSaved: 58,
    replyTimeBefore: "4–12 hours",
    replyTimeAfter: "under 1 min",
    topAutomation: "AI receptionist with rebooking & recalls",
  },
  {
    vertical: "Consulting",
    avgMonthlySavings: 4100,
    avgHoursSaved: 44,
    replyTimeBefore: "1–2 days",
    replyTimeAfter: "under 5 min",
    topAutomation: "Proposal drafting & follow-up sequences",
  },
  {
    vertical: "Law firm",
    avgMonthlySavings: 7400,
    avgHoursSaved: 66,
    replyTimeBefore: "1–3 days",
    replyTimeAfter: "under 10 min",
    topAutomation: "Intake screening & client onboarding",
  },
  {
    vertical: "Fitness",
    avgMonthlySavings: 2600,
    avgHoursSaved: 39,
    replyTimeBefore: "3–8 hours",
    replyTimeAfter: "under 1 min",
    topAutomation: "Trial-to-member nurture & no-show winback",
  },
  {
    vertical: "Med spa",
    avgMonthlySavings: 5000,
    avgHoursSaved: 52,
    replyTimeBefore: "2–6 hours",
    replyTimeAfter: "under 1 min",
    topAutomation: "Booking, cancellation-fill & rebooking agent",
  },
  {
    vertical: "Veterinary",
    avgMonthlySavings: 4400,
    avgHoursSaved: 50,
    replyTimeBefore: "3–8 hours",
    replyTimeAfter: "under 2 min",
    topAutomation: "Appointment reminders & vaccine recalls",
  },
  {
    vertical: "Auto repair",
    avgMonthlySavings: 6000,
    avgHoursSaved: 57,
    replyTimeBefore: "2–6 hours",
    replyTimeAfter: "under 30 sec",
    topAutomation: "Service scheduling & missed-call recovery",
  },
  {
    vertical: "Insurance",
    avgMonthlySavings: 6500,
    avgHoursSaved: 60,
    replyTimeBefore: "1–2 days",
    replyTimeAfter: "under 5 min",
    topAutomation: "Lead qualification & renewal chasing",
  },
  {
    vertical: "Property management",
    avgMonthlySavings: 4600,
    avgHoursSaved: 55,
    replyTimeBefore: "4–12 hours",
    replyTimeAfter: "under 2 min",
    topAutomation: "Maintenance triage & tenant comms",
  },
];

/**
 * Look up a benchmark by vertical. Matches case-insensitively and by partial
 * contains in either direction (e.g. "dental", "law", "ecommerce").
 */
export function getBenchmark(vertical: string): Benchmark | undefined {
  const q = vertical.trim().toLowerCase();
  if (!q) return undefined;
  return benchmarks.find((b) => {
    const v = b.vertical.toLowerCase();
    return v.includes(q) || q.includes(v);
  });
}
