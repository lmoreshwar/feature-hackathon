/**
 * Shared heuristics for the `automationFeasible` flag.
 *
 * Used by:
 * - the LLM generator (when the model omits the field, or when it
 *   over-conservatively returns `false` on a clearly-automatable case),
 * - the bulk "Re-evaluate automation flags" endpoint that retroactively
 *   fixes existing test cases stored in the DB.
 *
 * Rule of thumb: default to `true`. Only mark `false` when the test case
 * carries an explicit manual-only signal (visual inspection, look-and-feel,
 * exploratory, real-world physical action, etc.).
 */

/** Phrases that mean a test case really is manual / non-automatable. */
export const MANUAL_ONLY_PATTERN =
  /\[ui[- ]?cosmetic\]|look[- ]and[- ]feel|cosmetic|visual review|exploratory|usability|by eye|by inspection|human judgement|human judgment|subjective|aesthetic/i;

/** Categories whose test cases are by definition automation candidates. */
export const AUTOMATION_CATEGORY_PATTERN =
  /\[(positive|negative|boundary|security|validation|functional|e2e|smoke|regression)\]/i;

export interface AutomationInferenceInput {
  description?: string;
  tags?: string[];
}

export interface AutomationOverrideInput {
  description?: string;
  expectedResult?: string;
  steps?: string[];
  tags?: string[];
}

/**
 * Default-true heuristic. Returns `false` only when the description / tags
 * contain an explicit manual-only signal.
 */
export const inferAutomationFeasible = (
  input: AutomationInferenceInput,
): boolean => {
  const text = `${input.description ?? ''} ${(input.tags ?? []).join(' ')}`;
  return !MANUAL_ONLY_PATTERN.test(text);
};

/**
 * Decides whether to flip an existing `automationFeasible: false` to
 * `true`. We only override when the case carries an automation-friendly
 * category tag AND has no manual-only signals AND has at least 2 steps
 * (so there's actually something to script).
 */
export const shouldOverrideToAutomation = (
  input: AutomationOverrideInput,
): boolean => {
  const corpus = [
    input.description ?? '',
    input.expectedResult ?? '',
    (input.steps ?? []).join(' '),
    (input.tags ?? []).join(' '),
  ].join(' ');

  if (MANUAL_ONLY_PATTERN.test(corpus)) return false;
  if (!AUTOMATION_CATEGORY_PATTERN.test(corpus)) return false;
  if ((input.steps?.length ?? 0) < 2) return false;
  return true;
};

/**
 * Re-evaluates an existing test case's `automationFeasible` flag using the
 * same default-true logic the generator uses. Returns the recommended
 * value plus a short reason string for logging / UI.
 */
export const reevaluateAutomationFeasible = (input: {
  description?: string;
  expectedResult?: string;
  steps?: string[];
  tags?: string[];
  currentValue?: boolean;
}): { value: boolean; reason: string } => {
  const corpus = [
    input.description ?? '',
    input.expectedResult ?? '',
    (input.steps ?? []).join(' '),
    (input.tags ?? []).join(' '),
  ].join(' ');

  if (MANUAL_ONLY_PATTERN.test(corpus)) {
    return { value: false, reason: 'manual-only signal present' };
  }
  if (AUTOMATION_CATEGORY_PATTERN.test(corpus)) {
    return { value: true, reason: 'automation-friendly category tag' };
  }
  if ((input.steps?.length ?? 0) >= 2) {
    return { value: true, reason: 'has actionable steps, no manual signals' };
  }
  return { value: false, reason: 'too few steps to script' };
};
