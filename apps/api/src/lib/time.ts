/** Data local (YYYY-MM-DD) no fuso da escola — o limite diário vira à meia-noite de Macapá/Brasília. */
export function localDayKey(now: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}
