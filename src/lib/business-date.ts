export const BUSINESS_TZ = "Asia/Yangon";

/** Calendar date (YYYY-MM-DD) in Myanmar business timezone. */
export function getBusinessDateString(d = new Date()): string {
  return d.toLocaleDateString("en-CA", { timeZone: BUSINESS_TZ });
}

/** UTC instants for the start/end of a business calendar day in Yangon. */
export function yangonDayBounds(dateStr: string) {
  return {
    start: new Date(`${dateStr}T00:00:00+06:30`),
    end: new Date(`${dateStr}T23:59:59.999+06:30`),
  };
}
