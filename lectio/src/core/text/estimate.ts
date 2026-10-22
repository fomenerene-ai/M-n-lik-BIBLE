// Estimation de la durée d'écoute. Une voix de synthèse lit environ 900 caractères
// par minute à vitesse 1,0 (≈ 150 mots/minute).

export const CHARS_PER_MINUTE = 900;

export function listeningMinutes(chars: number, rate = 1): number {
  return chars / (CHARS_PER_MINUTE * rate);
}

export function formatDuration(minutes: number): string {
  if (minutes < 1) return 'moins d’1 min';
  const total = Math.round(minutes);
  if (total < 60) return `${total} min`;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return m ? `${h} h ${String(m).padStart(2, '0')}` : `${h} h`;
}
