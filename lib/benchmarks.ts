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
 * outcomes across Wardvale engagements and comparable published case data —
 * used to give prospects a realistic anchor before their own data is live.
 *
 * NOTE: `vertical` is a stable lookup key used by getBenchmark() to match
 * user/query strings — keep it in English, never localize it. The
 * `replyTime*` and `topAutomation` values are i18n keys ("bm.*") resolved to
 * display text at the render site via t(). Use benchmarkLabelKey(vertical) to
 * get the i18n key for the human-visible vertical name.
 */
export const benchmarks: Benchmark[] = [
  {
    vertical: "Restaurant",
    avgMonthlySavings: 3400,
    avgHoursSaved: 48,
    replyTimeBefore: "bm.reply3to6Hours",
    replyTimeAfter: "bm.replyUnder1Min",
    topAutomation: "bm.restaurantTopAutomation",
  },
  {
    vertical: "E-commerce",
    avgMonthlySavings: 6200,
    avgHoursSaved: 72,
    replyTimeBefore: "bm.reply8to24Hours",
    replyTimeAfter: "bm.replyInstant",
    topAutomation: "bm.ecommerceTopAutomation",
  },
  {
    vertical: "Home services",
    avgMonthlySavings: 4800,
    avgHoursSaved: 61,
    replyTimeBefore: "bm.reply2to8Hours",
    replyTimeAfter: "bm.replyUnder30Sec",
    topAutomation: "bm.homeServicesTopAutomation",
  },
  {
    vertical: "Real estate",
    avgMonthlySavings: 5600,
    avgHoursSaved: 54,
    replyTimeBefore: "bm.reply1to4Hours",
    replyTimeAfter: "bm.replyUnder2Min",
    topAutomation: "bm.realEstateTopAutomation",
  },
  {
    vertical: "Dental / clinic",
    avgMonthlySavings: 5200,
    avgHoursSaved: 58,
    replyTimeBefore: "bm.reply4to12Hours",
    replyTimeAfter: "bm.replyUnder1Min",
    topAutomation: "bm.dentalTopAutomation",
  },
  {
    vertical: "Consulting",
    avgMonthlySavings: 4100,
    avgHoursSaved: 44,
    replyTimeBefore: "bm.reply1to2Days",
    replyTimeAfter: "bm.replyUnder5Min",
    topAutomation: "bm.consultingTopAutomation",
  },
  {
    vertical: "Law firm",
    avgMonthlySavings: 7400,
    avgHoursSaved: 66,
    replyTimeBefore: "bm.reply1to3Days",
    replyTimeAfter: "bm.replyUnder10Min",
    topAutomation: "bm.lawFirmTopAutomation",
  },
  {
    vertical: "Fitness",
    avgMonthlySavings: 2600,
    avgHoursSaved: 39,
    replyTimeBefore: "bm.reply3to8Hours",
    replyTimeAfter: "bm.replyUnder1Min",
    topAutomation: "bm.fitnessTopAutomation",
  },
  {
    vertical: "Med spa",
    avgMonthlySavings: 5000,
    avgHoursSaved: 52,
    replyTimeBefore: "bm.reply2to6Hours",
    replyTimeAfter: "bm.replyUnder1Min",
    topAutomation: "bm.medSpaTopAutomation",
  },
  {
    vertical: "Veterinary",
    avgMonthlySavings: 4400,
    avgHoursSaved: 50,
    replyTimeBefore: "bm.reply3to8Hours",
    replyTimeAfter: "bm.replyUnder2Min",
    topAutomation: "bm.veterinaryTopAutomation",
  },
  {
    vertical: "Auto repair",
    avgMonthlySavings: 6000,
    avgHoursSaved: 57,
    replyTimeBefore: "bm.reply2to6Hours",
    replyTimeAfter: "bm.replyUnder30Sec",
    topAutomation: "bm.autoRepairTopAutomation",
  },
  {
    vertical: "Insurance",
    avgMonthlySavings: 6500,
    avgHoursSaved: 60,
    replyTimeBefore: "bm.reply1to2Days",
    replyTimeAfter: "bm.replyUnder5Min",
    topAutomation: "bm.insuranceTopAutomation",
  },
  {
    vertical: "Property management",
    avgMonthlySavings: 4600,
    avgHoursSaved: 55,
    replyTimeBefore: "bm.reply4to12Hours",
    replyTimeAfter: "bm.replyUnder2Min",
    topAutomation: "bm.propertyMgmtTopAutomation",
  },
];

/**
 * Maps each vertical's stable English lookup value to the i18n key for its
 * human-visible name. Render sites should display the vertical via
 * t(benchmarkLabelKey(b.vertical)) rather than the raw `vertical` string.
 */
const VERTICAL_LABEL_KEYS: Record<string, string> = {
  Restaurant: "bm.verticalRestaurant",
  "E-commerce": "bm.verticalEcommerce",
  "Home services": "bm.verticalHomeServices",
  "Real estate": "bm.verticalRealEstate",
  "Dental / clinic": "bm.verticalDental",
  Consulting: "bm.verticalConsulting",
  "Law firm": "bm.verticalLawFirm",
  Fitness: "bm.verticalFitness",
  "Med spa": "bm.verticalMedSpa",
  Veterinary: "bm.verticalVeterinary",
  "Auto repair": "bm.verticalAutoRepair",
  Insurance: "bm.verticalInsurance",
  "Property management": "bm.verticalPropertyMgmt",
};

/**
 * Returns the i18n key ("bm.vertical*") for a benchmark's display name.
 * Falls back to the raw vertical string if it is not a known vertical.
 */
export function benchmarkLabelKey(vertical: string): string {
  return VERTICAL_LABEL_KEYS[vertical] ?? vertical;
}

/**
 * Look up a benchmark by vertical. Matches case-insensitively and by partial
 * contains in either direction (e.g. "dental", "law", "ecommerce").
 */
export function getBenchmark(vertical: string): Benchmark | undefined {
  const q = vertical.trim().toLowerCase();
  if (q.length < 3) return undefined; // avoid 1-2 char substring false matches
  // Prefer the most specific match (longest matching vertical) over the first
  // declared one, so "fitness studio and consulting" doesn't match "Consulting".
  let best: Benchmark | undefined;
  for (const b of benchmarks) {
    const v = b.vertical.toLowerCase();
    if ((v.includes(q) || q.includes(v)) && (!best || v.length > best.vertical.length)) best = b;
  }
  return best;
}
