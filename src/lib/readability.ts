/**
 * Flesch-Kincaid Grade Level scoring.
 * Returns a US school grade level (e.g. 5.2 means a 5th grader can understand it).
 */

function countSyllables(word: string): number {
  const w = word.toLowerCase().replace(/[^a-z]/g, "");
  if (w.length <= 2) return 1;

  let count = 0;
  const vowels = "aeiouy";
  let prevVowel = false;

  for (let i = 0; i < w.length; i++) {
    const isVowel = vowels.includes(w[i]);
    if (isVowel && !prevVowel) count++;
    prevVowel = isVowel;
  }

  // Silent e
  if (w.endsWith("e") && count > 1) count--;
  // Words like "le" at the end
  if (w.endsWith("le") && w.length > 2 && !vowels.includes(w[w.length - 3])) count++;

  return Math.max(count, 1);
}

export function fleschKincaidGradeLevel(text: string): number {
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const words = text.split(/\s+/).filter(w => w.replace(/[^a-zA-Z]/g, "").length > 0);

  if (sentences.length === 0 || words.length === 0) return 0;

  const totalSyllables = words.reduce((sum, w) => sum + countSyllables(w), 0);
  const avgWordsPerSentence = words.length / sentences.length;
  const avgSyllablesPerWord = totalSyllables / words.length;

  // Flesch-Kincaid Grade Level formula
  const grade = 0.39 * avgWordsPerSentence + 11.8 * avgSyllablesPerWord - 15.59;
  return Math.max(0, Math.round(grade * 10) / 10);
}

export function readabilityLabel(grade: number): string {
  if (grade <= 5) return "Very Easy";
  if (grade <= 8) return "Easy";
  if (grade <= 12) return "Moderate";
  return "Complex";
}
