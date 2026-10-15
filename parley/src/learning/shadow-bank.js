/**
 * Built-in shadowing sentences, used when no imported audio or dialogue fits the tier.
 * Natural spoken English, read by the device voice (no pitch reference available for TTS).
 */
export const SHADOW_BANK = {
  S: [
    "I'll get back to you on that.",
    "Sorry, could you say that again?",
    "That sounds like a good plan.",
    "Let's touch base next week.",
    "I didn't catch the last part.",
    "We're running a bit late today.",
    "Can we push it to Friday?",
    "I'm not sure that adds up.",
  ],
  M: [
    "I was wondering if we could go over the numbers again.",
    "To be honest, I hadn't thought about it that way.",
    "We should probably double-check the figures before sending them.",
    "Do you mind if I jump in here for a second?",
    "It took a while, but we got there in the end.",
    "I think the main issue is that nobody owns the process.",
    "Could you walk me through how you got to that number?",
    "If it's okay with you, I'd rather keep things simple.",
  ],
  L: [
    "What I'm trying to say is that we can't keep pushing the deadline without telling the client.",
    "I see where you're coming from, but I'm not convinced it'll save us much money in the long run.",
    "We ended up missing the train, so we had to grab a taxi and still got there late.",
    "If we'd known about the delay earlier, we could have moved the meeting to the afternoon.",
    "The thing is, most of the costs are fixed, so cutting volume won't help as much as you'd think.",
    "Honestly, the hardest part of the internship was learning how to prioritise when everything felt urgent.",
    "I'd suggest we split the work between the two teams and check in again on Thursday morning.",
    "Before we sign anything, I'd like to understand exactly what's included in the monthly fee.",
  ],
};
