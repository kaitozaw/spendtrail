// Rules that decide whether a news article reports a breach that affects a name on the map.
// No model: N1 checks the name, N2 checks breach words in the same sentence and negation before them.
import { normaliseName } from './names';

// Words that indicate a breach or an attack. Kept to clear signals; "vulnerability" and "outage" are left out.
const BREACH_WORDS = [
  'breach', 'breached', 'breaches', 'hack', 'hacked', 'hacker', 'hackers', 'hacking',
  'compromise', 'compromised', 'incident', 'attack', 'attacked', 'attackers', 'cyberattack',
  'ransomware', 'leak', 'leaked', 'leaks', 'stole', 'stolen', 'theft', 'unauthorised', 'unauthorized',
  'intrusion', 'exposed', 'exfiltrated', 'phishing',
];
const NEGATIONS = ['not', 'no', 'neither', 'nor', 'never', 'unaffected', 'without', 'nt'];
const NEGATION_WINDOW = 4; // words before a breach word in which a negation cancels it

export type NewsVerdict = { reports: boolean; sentence: string | null };

function words(text: string): string[] {
  return normaliseName(text.replace(/n't\b/g, ' nt')).split(' ').filter(Boolean);
}

export function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+(?=["'“A-Z0-9])/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** N1: the name appears as whole words. */
export function mentions(name: string, text: string): boolean {
  const n = words(name).join(' ');
  return n.length > 0 && ` ${words(text).join(' ')} `.includes(` ${n} `);
}

/** N2: a sentence names it and contains a breach word with no negation just before it. */
export function reportsBreach(name: string, title: string, text: string): NewsVerdict {
  for (const sentence of [title, ...splitSentences(text)]) {
    if (!mentions(name, sentence)) continue;
    const w = words(sentence);
    for (let i = 0; i < w.length; i++) {
      if (!BREACH_WORDS.includes(w[i]!)) continue;
      const before = w.slice(Math.max(0, i - NEGATION_WINDOW), i);
      if (!before.some((b) => NEGATIONS.includes(b))) return { reports: true, sentence };
    }
  }
  return { reports: false, sentence: null };
}
