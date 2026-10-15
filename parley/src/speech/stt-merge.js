/**
 * Pure helpers for speech recognition results.
 */

/**
 * Merges recognition result transcripts into one text. Some Android Chrome versions return
 * cumulative finals ("I was", "I was in charge", ...): a result that starts with the previous one
 * replaces it instead of being appended.
 * @param {{transcript: string, isFinal: boolean}[]} results
 * @returns {{finalText: string, interim: string}}
 */
export function mergeResults(results) {
  const finals = [];
  let interim = '';
  for (const r of results) {
    const t = r.transcript.trim();
    if (!t) continue;
    if (!r.isFinal) { interim = t; continue; }
    const prev = finals[finals.length - 1];
    if (prev && t.toLowerCase().startsWith(prev.toLowerCase())) finals[finals.length - 1] = t;
    else if (!(prev && prev.toLowerCase().endsWith(t.toLowerCase()))) finals.push(t);
  }
  const finalText = finals.join(' ');
  if (interim && finalText && interim.toLowerCase().startsWith(finalText.toLowerCase())) interim = interim.slice(finalText.length).trim();
  return { finalText, interim };
}
