/**
 * Single source of truth for the colour palette used by NG-ZORRO `nz-tag`
 * across the Quantum AI screens. Keeps every status chip visually consistent.
 */
export const STATUS_COLOR_MAP: Record<string, string> = {
  // Feature / suite lifecycle
  DRAFT: 'default',
  ACTIVE: 'green',
  ARCHIVED: 'gold',

  // Requirement source lifecycle
  PENDING: 'orange',
  PROCESSED: 'green',
  FAILED: 'red',

  // Test case lifecycle
  GENERATED: 'blue',
  APPROVED: 'green',
  REJECTED: 'red',
  NEEDS_REVIEW: 'orange',

  // Execution lifecycle
  QUEUED: 'default',
  RUNNING: 'blue',
  PASSED: 'green',
  CANCELLED: 'gold',

  // Mapping git push lifecycle
  NOT_PUSHED: 'default',
  PUSHED: 'green',

  // Test case priority
  LOW: 'default',
  MEDIUM: 'blue',
  HIGH: 'orange',
  CRITICAL: 'red',

  // Test case type
  FUNCTIONAL: 'blue',
  REGRESSION: 'purple',
  SMOKE: 'cyan',
  E2E: 'magenta',

  // Traceability
  COVERED: 'green',
  PARTIAL: 'orange',
  GAP: 'red',
};

export const statusColor = (status: string | undefined | null): string => {
  if (!status) {
    return 'default';
  }
  return STATUS_COLOR_MAP[status] ?? 'default';
};
