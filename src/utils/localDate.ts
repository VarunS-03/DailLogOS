/** Formats a Date as the user's local calendar day, never its UTC day. */
export function getLocalDateId(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Adds calendar days without converting a local calendar date through UTC. */
export function addDaysToDateId(dateId: string, offset: number): string {
  const [year, month, day] = dateId.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + offset);
  return getLocalDateId(date);
}
