export function getPrescribedSetCount(target: string): number {
  const match = /^\s*(\d{1,2})\s*(?:×|x|\*)/i.exec(target);
  if (!match) return 1;

  return Math.min(10, Math.max(1, Number(match[1])));
}
