// Deterministic test-case coverage algorithm.
// Faithful port of the AI_Agents `ReviewTestCases.jsx` `computeCoverage(...)`
// engine (keyword-precision matching + IEEE 829 / ISO 29119 inspired
// non-testable filter). NO LLM call \u2014 the % is computed in pure JS so the
// result is fast, free and deterministic.

const STOP_WORDS: ReadonlySet<string> = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'is', 'are', 'was', 'were', 'be',
  'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
  'should', 'shall', 'may', 'might', 'must', 'can', 'could', 'to', 'of', 'in',
  'on', 'at', 'by', 'for', 'with', 'about', 'against', 'between', 'into',
  'through', 'during', 'before', 'after', 'above', 'below', 'from', 'up',
  'down', 'out', 'off', 'over', 'under', 'again', 'further', 'then', 'once',
  'this', 'that', 'these', 'those', 'as', 'if', 'than', 'so', 'such', 'no',
  'not', 'only', 'own', 'same', 'too', 'very', 'just', 'also', 'i', 'you',
  'he', 'she', 'it', 'we', 'they', 'them', 'their', 'his', 'her', 'its',
  'my', 'your', 'our', 'us', 'me', 'him', 'shall', 'be', 'able',
]);

// Lines matching any of these patterns are NOT counted as testable
// requirements (they are headings, story wrappers, etc.).
const NON_TESTABLE_PATTERNS: readonly RegExp[] = [
  /^(?:#+\s|=+\s|-+\s|\*+\s|\d+\.\s*$)/, // markdown / numbered headings
  /^\s*(as a|in order to|so that)\b/i,  // user-story wrappers
  /^\s*(feature|epic|story|task|sub-task|scope|out of scope|background|context)\s*[:\-]/i,
  /^\s*(notes?|references?|see also|todo|tbd|n\/a)\s*[:\-]/i,
  /^\s*[A-Z\-_ ]{3,}$/,                 // ALL-CAPS section headers
];

// Action verbs that indicate the line is talking about *behaviour* (i.e.
// something we can write a test for). Also matches conditional/permission
// verbs ("must", "should", "can", "shall", "will").
const ACTION_VERB_RE =
  /\b(login|log\s*in|sign\s*in|sign\s*up|register|enter|click|press|tap|select|choose|navigate|open|close|view|see|display|show|hide|create|add|insert|edit|update|change|delete|remove|cancel|submit|save|approve|reject|review|send|receive|upload|download|export|import|search|filter|sort|paginate|verify|validate|assert|check|confirm|ensure|allow|prevent|reject|fail|return|redirect|render|generate|calculate|compute|display|store|persist|encrypt|decrypt|authenticate|authorize|trigger|fetch|retrieve|push|pull|invoke|call|expose|prompt|message|notify|alert|warn|error|reset|complete|continue|proceed|finish|invite|share|copy|paste|drag|drop|resize|scroll|zoom|toggle|enable|disable|activate|deactivate|lock|unlock|expire|timeout|throttle|rate-?limit)\b|\b(must|should|shall|can|may|cannot|won['\u2019]?t)\b/i;

const FULL_THRESHOLD = 0.5;
const PARTIAL_THRESHOLD = 0.25;

export interface CoverageInputTestCase {
  title?: string;
  description?: string;
  preconditions?: string[];
  steps?: string[];
  expectedResult?: string;
}

export interface CoverageResult {
  percentage: number;          // 0..100
  full: number;                // # requirements fully covered
  partial: number;             // # requirements partially covered
  none: number;                // # requirements with no coverage
  total: number;               // total testable requirements found
  testCasesEvaluated: number;  // # test cases supplied / evaluated
}

export function computeCoverage(
  requirementText: string,
  testCases: CoverageInputTestCase[],
): CoverageResult {
  const requirements = extractRequirements(requirementText);
  const total = requirements.length;
  const testCasesEvaluated = testCases.length;

  if (total === 0) {
    return {
      percentage: 0,
      full: 0,
      partial: 0,
      none: 0,
      total: 0,
      testCasesEvaluated,
    };
  }

  // Pre-extract test-case keyword bags once (Title + Description only \u2014 same
  // as AI_Agents which intentionally excludes steps/expected to avoid
  // boilerplate-keyword inflation).
  const tcKeywordBags = testCases.map((tc) =>
    extractKeywords(`${tc.title ?? ''} ${tc.description ?? ''}`),
  );

  let full = 0;
  let partial = 0;
  let none = 0;

  for (const req of requirements) {
    const reqKeywords = extractKeywords(req);
    if (reqKeywords.size === 0) {
      none++;
      continue;
    }
    let bestScore = 0;
    for (const tcKeywords of tcKeywordBags) {
      const score = calcSimilarity(reqKeywords, tcKeywords);
      if (score > bestScore) bestScore = score;
      if (bestScore >= FULL_THRESHOLD) break; // can't do better than "full"
    }
    if (bestScore >= FULL_THRESHOLD) full++;
    else if (bestScore >= PARTIAL_THRESHOLD) partial++;
    else none++;
  }

  const percentage = Math.round(((full + 0.5 * partial) / total) * 100);
  return { percentage, full, partial, none, total, testCasesEvaluated };
}

// ---- internals ---------------------------------------------------------

function isTestableRequirement(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed || trimmed.length < 8) return false;
  for (const pat of NON_TESTABLE_PATTERNS) {
    if (pat.test(trimmed)) return false;
  }
  return ACTION_VERB_RE.test(trimmed);
}

function extractRequirements(text: string): string[] {
  if (!text || !text.trim()) return [];
  // Split on newlines AND bullet markers (-, *, \u2022, 1., etc.).
  const rough = text
    .split(/\r?\n|(?:^|\s)[\-\*\u2022](?:\s|$)|(?:^|\s)\d+[\.\)]\s/g)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  // Also split very long sentences containing "must|shall|should" \u2014 each
  // clause is usually one acceptance criterion.
  const split: string[] = [];
  for (const line of rough) {
    if (line.length > 220) {
      const parts = line.split(/(?<=[.!?])\s+(?=[A-Z])/);
      for (const p of parts) split.push(p);
    } else {
      split.push(line);
    }
  }

  return split.filter(isTestableRequirement);
}

function extractKeywords(text: string): Set<string> {
  if (!text) return new Set();
  const tokens = text
    .toLowerCase()
    .replace(/[^a-z0-9\s\-]/g, ' ')
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 3 && !STOP_WORDS.has(t));
  return new Set(tokens);
}

// Keyword precision: of the requirement's keywords, what fraction also
// appear in the test case's keyword bag (with stem credit of 0.8).
function calcSimilarity(reqKeywords: Set<string>, tcKeywords: Set<string>): number {
  if (reqKeywords.size === 0) return 0;
  let matched = 0;
  for (const k of reqKeywords) {
    if (tcKeywords.has(k)) {
      matched += 1;
      continue;
    }
    // Stem-match credit: anything sharing a 4-char prefix counts as 0.8.
    if (k.length >= 4) {
      const stem = k.slice(0, 4);
      let stemHit = false;
      for (const w of tcKeywords) {
        if (w.length >= 4 && w.startsWith(stem)) {
          stemHit = true;
          break;
        }
      }
      if (stemHit) matched += 0.8;
    }
  }
  return matched / reqKeywords.size;
}
