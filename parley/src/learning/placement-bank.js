/**
 * Built-in listening clips for the placement test, of increasing difficulty (level scale 1 to 10).
 * Read by the device voices at natural speed. Original sentences written for this app.
 */
export const PLACEMENT_CLIPS = [
  {
    difficulty: 2,
    units: [{ speaker: 'A', text: "Hi, it's Tom. I'm running about ten minutes late, so go ahead and start without me. I'll grab a coffee on the way." }],
    question: 'What is Tom going to do?',
    options: ['Cancel the meeting', 'Arrive a little late', 'Start the meeting himself', 'Buy lunch for everyone'],
    answer: 'Arrive a little late',
  },
  {
    difficulty: 4,
    units: [{ speaker: 'B', text: "So the plan was to fly out on Friday, but the airline moved us to Saturday morning. We lose a night at the hotel, but at least they're not charging us for the change." }],
    question: 'What happened to their trip?',
    options: ['The hotel was cancelled', 'Their flight was moved to Saturday', 'They had to pay a fee', 'They decided to drive'],
    answer: 'Their flight was moved to Saturday',
  },
  {
    difficulty: 6,
    units: [
      { speaker: 'A', text: 'Did you manage to get the figures over to finance?' },
      { speaker: 'B', text: "Not yet. Half the invoices still haven't come in, and I'm not sending anything until it all adds up." },
    ],
    question: 'Why has the second speaker not sent the figures?',
    options: ['Finance has not asked for them', 'Some invoices are still missing', 'The figures were already sent', 'The deadline was moved'],
    answer: 'Some invoices are still missing',
  },
  {
    difficulty: 8,
    units: [{ speaker: 'B', text: "Honestly, I wouldn't read too much into last quarter. Sure, sales were up, but that was mostly down to one big one-off order, and once you strip that out, we're pretty much where we were a year ago." }],
    question: 'What does the speaker think about last quarter?',
    options: ['Sales grew steadily all year', 'The growth came from one exceptional order', 'The company lost a big client', 'Next quarter will be even better'],
    answer: 'The growth came from one exceptional order',
  },
];

/**
 * Listening level from placement answers alone (used without an API key): weighted by difficulty.
 * @param {{correct: boolean, difficulty: number}[]} results
 * @returns {number} 1..10
 */
export function listeningFromResults(results) {
  let level = 2.5;
  for (const r of [...results].sort((a, b) => a.difficulty - b.difficulty)) {
    if (r.correct) level = Math.max(level, r.difficulty + 1);
  }
  const wrongBelow = results.filter((r) => !r.correct && r.difficulty < level - 1).length;
  return Math.max(1, Math.min(10, level - wrongBelow));
}
