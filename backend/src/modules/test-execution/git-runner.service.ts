import { Injectable, Logger } from '@nestjs/common';
import { exec } from 'child_process';
import { promisify } from 'util';
import { promises as fs } from 'fs';
import * as os from 'os';
import * as path from 'path';

import { decryptSecret } from '../../common/utils/crypto.util';
import { IntegrationRepository } from '../integration/integration.repository';
import { ExecutionRepository } from './test-execution.repository';

const execAsync = promisify(exec);

interface RunFromGitInput {
  executionId: string;
  branch: string;
  buildName: string;
  /** Optional override; defaults to the saved git integration `repoUrl`. */
  repoUrlOverride?: string;
  /** Optional override "owner/repo" — converted to https URL using the saved provider. */
  repo?: string;
  /** Glob/path passed to `npx playwright test` (e.g. tests/login.spec.ts). */
  testPath?: string;
}

export interface GitWorkflow {
  id: number;
  name: string;
  path: string;
  state: string;
  htmlUrl: string;
}

export interface GitRepo {
  fullName: string; // "owner/repo"
  name: string;
  private: boolean;
  defaultBranch: string;
  htmlUrl: string;
}

interface DispatchWorkflowInput {
  executionId: string;
  workflowFile: string; // e.g. "playwright.yml" or ".github/workflows/playwright.yml"
  branch: string;
  buildName: string;
  /** Optional override "owner/repo" — falls back to the saved git integration. */
  repo?: string;
}

interface PlaywrightJsonReport {
  stats?: {
    expected?: number;
    unexpected?: number;
    flaky?: number;
    skipped?: number;
  };
  suites?: unknown[];
}

/**
 * Clones a user's git repo at a chosen branch, runs `npx playwright test`,
 * parses the Playwright JSON reporter output, and writes pass/fail counts
 * back to the Execution document.
 *
 * IMPORTANT: this runner shells out to `git`, `npm`, and `npx`. It assumes
 * the host machine has them on PATH. The clone is shallow + isolated to a
 * temp dir which is removed after the run completes.
 */
@Injectable()
export class GitRunnerService {
  private readonly logger = new Logger(GitRunnerService.name);

  constructor(
    private readonly integrationRepository: IntegrationRepository,
    private readonly executionRepository: ExecutionRepository,
  ) {}

  /** Fire-and-forget. All failures land on the Execution doc. */
  async runInBackground(input: RunFromGitInput, userId: string): Promise<void> {
    void this.run(input, userId).catch((e) => {
      const msg = e instanceof Error ? e.message : 'Unknown runner failure';
      this.logger.error(`git-runner crashed for ${input.executionId}: ${msg}`);
    });
  }

  async run(input: RunFromGitInput, userId: string): Promise<void> {
    const { executionId, branch, buildName } = input;
    this.logger.log(
      `git-runner: starting execution=${executionId} branch=${branch} build="${buildName}"`,
    );

    let repoUrl: string;
    let token: string | null = null;
    try {
      const integration = await this.integrationRepository.findByUserId(userId);
      const git = integration?.git;
      if (!git) {
        throw new Error(
          'Git integration is not configured. Open Settings → Integrations and save your git repo URL + token.',
        );
      }
      repoUrl = (input.repoUrlOverride || git.repoUrl || '').trim();
      if (!repoUrl) {
        throw new Error('Saved git integration has no repoUrl.');
      }
      try {
        token = git.tokenEncrypted ? decryptSecret(git.tokenEncrypted) : null;
      } catch {
        token = null;
      }
    } catch (e) {
      await this.markFailure(
        executionId,
        e instanceof Error ? e.message : 'git config error',
      );
      return;
    }

    await this.executionRepository.update(executionId, { status: 'RUNNING' });

    const workDir = await fs.mkdtemp(
      path.join(os.tmpdir(), `qaai-run-${executionId}-`),
    );
    const cloneDir = path.join(workDir, 'repo');
    const logChunks: string[] = [];

    try {
      const cloneUrl = this.injectToken(repoUrl, token);

      await this.runCmd(
        `git clone --depth 1 --branch ${this.shellQuote(branch)} ${this.shellQuote(cloneUrl)} ${this.shellQuote(cloneDir)}`,
        workDir,
        logChunks,
        'git clone',
        180_000,
      );

      // Install only what's needed. Prefer `npm ci` if a lockfile exists.
      const hasLock = await this.exists(path.join(cloneDir, 'package-lock.json'));
      const installCmd = hasLock ? 'npm ci --no-audit --no-fund' : 'npm install --no-audit --no-fund';
      await this.runCmd(installCmd, cloneDir, logChunks, 'npm install', 600_000);

      // Run Playwright with JSON reporter so we can parse counts.
      const reportFile = path.join(workDir, 'playwright-report.json');
      const testTarget = input.testPath ? ` ${this.shellQuote(input.testPath)}` : '';
      const testCmd =
        `npx --yes playwright test${testTarget} --reporter=json`;

      // Capture stdout into the report file. Use shell redirection that
      // works on both Windows (cmd.exe) and *nix.
      const isWindows = process.platform === 'win32';
      const redirect = isWindows
        ? ` > ${this.shellQuote(reportFile)}`
        : ` > ${this.shellQuote(reportFile)}`;
      // Note: `npx playwright test` exits 1 on test failures. We swallow
      // the non-zero exit so we can still parse the JSON report.
      const { allowNonZero: _allowNonZero, ...rest } = { allowNonZero: true };
      void _allowNonZero;
      void rest;
      await this.runCmd(
        testCmd + redirect,
        cloneDir,
        logChunks,
        'playwright test',
        1_200_000,
        true,
      );

      // Parse the report.
      let report: PlaywrightJsonReport | null = null;
      try {
        const raw = await fs.readFile(reportFile, 'utf8');
        report = JSON.parse(raw) as PlaywrightJsonReport;
      } catch (e) {
        const reason = e instanceof Error ? e.message : 'unknown';
        logChunks.push(`Could not parse Playwright JSON report: ${reason}`);
      }

      const stats = report?.stats ?? {};
      const passed = stats.expected ?? 0;
      const failed = (stats.unexpected ?? 0) + (stats.flaky ?? 0);
      const skipped = stats.skipped ?? 0;
      const total = passed + failed + skipped;

      await this.executionRepository.update(executionId, {
        status: failed === 0 && total > 0 ? 'PASSED' : 'FAILED',
        totalTests: total,
        passedTests: passed,
        failedTests: failed,
        skippedTests: skipped,
        logsUrl: this.tailLogs(logChunks),
      });

      this.logger.log(
        `git-runner: finished execution=${executionId} → ${passed}/${total} passed, ${failed} failed`,
      );
    } catch (e) {
      const reason = e instanceof Error ? e.message : 'Unknown runner error';
      this.logger.error(`git-runner: execution ${executionId} failed: ${reason}`);
      await this.executionRepository.update(executionId, {
        status: 'FAILED',
        logsUrl: this.tailLogs([...logChunks, `ERROR: ${reason}`]),
      });
    } finally {
      // Best-effort cleanup. On Windows the clone dir often holds a lock
      // for a few seconds after npm exits, so we just log and move on.
      try {
        await fs.rm(workDir, { recursive: true, force: true });
      } catch (e) {
        this.logger.warn(
          `git-runner: could not remove temp dir ${workDir}: ${e instanceof Error ? e.message : e}`,
        );
      }
    }
  }

  /**
   * Lists every GitHub repository the saved PAT can see. Used by the
   * Executions UI as the first dropdown, so the user can pick *which*
   * repo's workflow to trigger without changing their saved integration.
   */
  async listRepos(userId: string): Promise<GitRepo[]> {
    const integration = await this.integrationRepository.findByUserId(userId);
    const git = integration?.git;
    if (!git?.repoUrl || git.provider !== 'GITHUB') return [];

    const token = git.tokenEncrypted ? decryptSecret(git.tokenEncrypted) : null;
    if (!token) return this.savedRepoFallback(git);

    try {
      // `affiliation=owner,collaborator,organization_member` covers most
      // hackathon setups; sort by recently pushed so the user's actively-
      // worked repos float to the top of the dropdown.
      const res = await fetch(
        'https://api.github.com/user/repos?per_page=100&sort=pushed&affiliation=owner,collaborator,organization_member',
        { headers: this.githubHeaders(token) },
      );
      if (!res.ok) {
        this.logger.warn(`listRepos: HTTP ${res.status}`);
        return this.savedRepoFallback(git);
      }
      const json = (await res.json()) as Array<{
        full_name: string;
        name: string;
        private: boolean;
        default_branch: string;
        html_url: string;
        pushed_at: string;
      }>;
      const mapped: GitRepo[] = json.map((r) => ({
        fullName: r.full_name,
        name: r.name,
        private: r.private,
        defaultBranch: r.default_branch,
        htmlUrl: r.html_url,
      }));
      // Hoist the configured repo to the top so it stays the obvious default.
      const savedFull = this.toGithubApiPath(git.repoUrl);
      if (savedFull && mapped.some((r) => r.fullName === savedFull)) {
        return [
          mapped.find((r) => r.fullName === savedFull)!,
          ...mapped.filter((r) => r.fullName !== savedFull),
        ];
      }
      return mapped;
    } catch (e) {
      this.logger.warn(
        `listRepos: failed: ${e instanceof Error ? e.message : e}`,
      );
      return this.savedRepoFallback(git);
    }
  }

  /**
   * Lists GitHub Actions workflows defined under `.github/workflows/` in the
   * given repo (or the user's saved repo if `repoOverride` is omitted).
   * Only enabled workflows are returned.
   */
  async listWorkflows(
    userId: string,
    repoOverride?: string,
  ): Promise<GitWorkflow[]> {
    const integration = await this.integrationRepository.findByUserId(userId);
    const git = integration?.git;
    if (!git || git.provider !== 'GITHUB') return [];

    const apiPath = repoOverride?.trim() || this.toGithubApiPath(git.repoUrl);
    if (!apiPath) return [];

    const token = git.tokenEncrypted ? decryptSecret(git.tokenEncrypted) : null;

    try {
      const res = await fetch(
        `https://api.github.com/repos/${apiPath}/actions/workflows?per_page=100`,
        { headers: this.githubHeaders(token) },
      );
      if (!res.ok) {
        this.logger.warn(
          `listWorkflows: GitHub returned HTTP ${res.status} for ${apiPath}`,
        );
        return [];
      }
      const json = (await res.json()) as {
        workflows?: Array<{
          id: number;
          name: string;
          path: string;
          state: string;
          html_url: string;
        }>;
      };
      return (json.workflows ?? [])
        .filter((w) => w.state === 'active')
        .map((w) => ({
          id: w.id,
          name: w.name,
          path: w.path,
          state: w.state,
          htmlUrl: w.html_url,
        }));
    } catch (e) {
      this.logger.warn(
        `listWorkflows: failed: ${e instanceof Error ? e.message : e}`,
      );
      return [];
    }
  }

  /**
   * Triggers a GitHub Actions workflow_dispatch on the chosen branch, then
   * polls the API until the run reaches a conclusion (success/failure/etc.)
   * and writes the resulting pass/fail counts onto the Execution doc.
   *
   * Requires `workflow_dispatch:` to be declared in the workflow's `on:`
   * triggers and the saved PAT to have `repo` + `workflow` scopes.
   */
  async dispatchAndTrackWorkflow(
    input: DispatchWorkflowInput,
    userId: string,
  ): Promise<void> {
    void this.runDispatchAndTrack(input, userId).catch((e) => {
      const msg = e instanceof Error ? e.message : 'Unknown dispatch failure';
      this.logger.error(
        `dispatchAndTrackWorkflow crashed for ${input.executionId}: ${msg}`,
      );
    });
  }

  private async runDispatchAndTrack(
    input: DispatchWorkflowInput,
    userId: string,
  ): Promise<void> {
    const { executionId, workflowFile, branch, buildName } = input;
    const integration = await this.integrationRepository.findByUserId(userId);
    const git = integration?.git;
    if (!git || git.provider !== 'GITHUB') {
      await this.markFailure(
        executionId,
        'Git integration must be GitHub for workflow dispatch.',
      );
      return;
    }
    const apiPath = input.repo?.trim() || this.toGithubApiPath(git.repoUrl);
    if (!apiPath) {
      await this.markFailure(executionId, 'Could not resolve repo (owner/name).');
      return;
    }
    const token = git.tokenEncrypted ? decryptSecret(git.tokenEncrypted) : null;
    if (!token) {
      await this.markFailure(
        executionId,
        'GitHub PAT is required to dispatch workflows.',
      );
      return;
    }

    // Normalise the workflow ref to just the file name — GitHub accepts
    // "playwright.yml" or the numeric id, not the full repo path.
    const workflowRef = workflowFile.split('/').pop() || workflowFile;

    await this.executionRepository.update(executionId, { status: 'RUNNING' });

    // Snapshot "now" so we can find the run we just kicked off.
    const dispatchedAt = new Date();

    // 1) Fire workflow_dispatch
    try {
      const dispatchUrl = `https://api.github.com/repos/${apiPath}/actions/workflows/${encodeURIComponent(
        workflowRef,
      )}/dispatches`;
      const dispatchRes = await fetch(dispatchUrl, {
        method: 'POST',
        headers: {
          ...this.githubHeaders(token),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ref: branch,
          inputs: { build_name: buildName },
        }),
      });
      if (dispatchRes.status !== 204) {
        const body = await dispatchRes.text();
        throw new Error(
          `workflow_dispatch HTTP ${dispatchRes.status}: ${body.slice(0, 300)}`,
        );
      }
      this.logger.log(
        `git-runner: dispatched ${workflowRef} on ${branch} for execution=${executionId}`,
      );
    } catch (e) {
      const reason = e instanceof Error ? e.message : 'dispatch failed';
      await this.executionRepository.update(executionId, {
        status: 'FAILED',
        logsUrl: `Workflow dispatch failed: ${reason.slice(0, 400)}`,
      });
      return;
    }

    // 2) Poll for the run (the API needs ~2-5 s to surface it)
    let runId: number | null = null;
    let runHtmlUrl: string | null = null;
    const pollDeadline = Date.now() + 20 * 60 * 1000; // 20 min hard cap
    const findRun = async (): Promise<void> => {
      const list = await fetch(
        `https://api.github.com/repos/${apiPath}/actions/workflows/${encodeURIComponent(
          workflowRef,
        )}/runs?branch=${encodeURIComponent(branch)}&event=workflow_dispatch&per_page=10`,
        { headers: this.githubHeaders(token) },
      );
      if (!list.ok) return;
      const json = (await list.json()) as {
        workflow_runs?: Array<{
          id: number;
          html_url: string;
          created_at: string;
          status: string;
        }>;
      };
      const candidate = (json.workflow_runs ?? []).find(
        (r) => new Date(r.created_at).getTime() >= dispatchedAt.getTime() - 5000,
      );
      if (candidate) {
        runId = candidate.id;
        runHtmlUrl = candidate.html_url;
      }
    };

    for (let i = 0; i < 12 && !runId; i++) {
      await this.sleep(2500);
      try {
        await findRun();
      } catch {
        /* retry */
      }
    }
    if (!runId) {
      await this.executionRepository.update(executionId, {
        status: 'FAILED',
        logsUrl: 'Workflow dispatched but the run never appeared on GitHub.',
      });
      return;
    }

    await this.executionRepository.update(executionId, {
      reportUrl: runHtmlUrl ?? undefined,
      logsUrl: `GitHub Actions run #${runId} queued…`,
    });

    // 3) Poll the run until it concludes
    while (Date.now() < pollDeadline) {
      await this.sleep(5000);
      try {
        const r = await fetch(
          `https://api.github.com/repos/${apiPath}/actions/runs/${runId}`,
          { headers: this.githubHeaders(token) },
        );
        if (!r.ok) continue;
        const run = (await r.json()) as {
          status: string;
          conclusion: string | null;
          html_url: string;
        };
        runHtmlUrl = run.html_url;
        if (run.status === 'completed') {
          // 4) Try BrowserStack first (real session-level counts), then
          //    fall back to GitHub job counts if BrowserStack creds aren't
          //    configured or no matching build is found.
          const bsCounts = await this.fetchBrowserStackBuildCounts(
            userId,
            buildName,
          );
          const counts =
            bsCounts && bsCounts.total > 0
              ? bsCounts
              : await this.fetchRunJobCounts(apiPath, runId, token);
          const source =
            bsCounts && bsCounts.total > 0 ? 'BrowserStack sessions' : 'GitHub jobs';

          const finalStatus =
            counts.failed === 0 && counts.total > 0
              ? 'PASSED'
              : run.conclusion === 'success'
                ? 'PASSED'
                : 'FAILED';

          await this.executionRepository.update(executionId, {
            status: finalStatus,
            totalTests: counts.total,
            passedTests: counts.passed,
            failedTests: counts.failed,
            skippedTests: counts.skipped,
            reportUrl: run.html_url,
            logsUrl: `GitHub Actions ${run.conclusion ?? 'completed'} — ${counts.passed}/${counts.total} ${source}`,
          });
          this.logger.log(
            `git-runner: workflow run ${runId} concluded as ${run.conclusion} ` +
              `(${counts.passed}/${counts.total} via ${source})`,
          );
          return;
        }
        await this.executionRepository.update(executionId, {
          logsUrl: `GitHub Actions run #${runId} ${run.status}…`,
        });
      } catch {
        /* keep polling */
      }
    }

    await this.executionRepository.update(executionId, {
      status: 'FAILED',
      logsUrl: 'Polling timed out after 20 minutes.',
    });
  }

  /**
   * Lists branches for the chosen repo (or saved git integration if
   * `repoOverride` is omitted). GitHub-only for now — GitLab / Bitbucket
   * fall back to a heuristic based on the saved branch.
   */
  async listBranches(
    userId: string,
    repoOverride?: string,
  ): Promise<string[]> {
    const integration = await this.integrationRepository.findByUserId(userId);
    const git = integration?.git;
    if (!git) return [];

    const token = git.tokenEncrypted ? decryptSecret(git.tokenEncrypted) : null;

    if (git.provider === 'GITHUB') {
      const apiPath = repoOverride?.trim() || this.toGithubApiPath(git.repoUrl);
      if (!apiPath) return git.branch ? [git.branch] : [];
      try {
        const res = await fetch(
          `https://api.github.com/repos/${apiPath}/branches?per_page=100`,
          { headers: this.githubHeaders(token) },
        );
        if (!res.ok) {
          this.logger.warn(
            `listBranches: GitHub returned HTTP ${res.status} for ${apiPath}`,
          );
          return git.branch ? [git.branch] : [];
        }
        const json = (await res.json()) as Array<{ name: string }>;
        const names = json.map((b) => b.name).filter(Boolean);
        // Hoist the saved default branch to the top *only* when looking at
        // the saved repo — otherwise we'd be misleading for foreign repos.
        const savedRepoPath = this.toGithubApiPath(git.repoUrl);
        if (
          git.branch &&
          (!repoOverride || repoOverride === savedRepoPath) &&
          names.includes(git.branch)
        ) {
          return [git.branch, ...names.filter((n) => n !== git.branch)];
        }
        return names;
      } catch (e) {
        this.logger.warn(
          `listBranches: failed to query GitHub: ${e instanceof Error ? e.message : e}`,
        );
        return git.branch ? [git.branch] : [];
      }
    }

    // GitLab / Bitbucket: at least let the user run the saved branch.
    return git.branch ? [git.branch] : [];
  }

  private savedRepoFallback(git: {
    repoUrl?: string;
    branch?: string;
  }): GitRepo[] {
    const fullName = git.repoUrl ? this.toGithubApiPath(git.repoUrl) : null;
    if (!fullName) return [];
    return [
      {
        fullName,
        name: fullName.split('/').pop() ?? fullName,
        private: false,
        defaultBranch: git.branch ?? 'main',
        htmlUrl: `https://github.com/${fullName}`,
      },
    ];
  }

  // -----------------------------------------------------------------
  // helpers
  // -----------------------------------------------------------------

  private async runCmd(
    cmd: string,
    cwd: string,
    logChunks: string[],
    label: string,
    timeoutMs: number,
    allowNonZero = false,
  ): Promise<void> {
    const start = Date.now();
    this.logger.log(`git-runner [${label}] $ ${this.redact(cmd)}`);
    try {
      const { stdout, stderr } = await execAsync(cmd, {
        cwd,
        timeout: timeoutMs,
        maxBuffer: 32 * 1024 * 1024,
        windowsHide: true,
        // shell: true is the default on Windows for `exec`
      });
      const ms = Date.now() - start;
      logChunks.push(`[${label}] ok in ${ms}ms`);
      if (stderr) logChunks.push(`[${label}:stderr] ${stderr.slice(-2000)}`);
      if (stdout) logChunks.push(`[${label}:stdout] ${stdout.slice(-2000)}`);
    } catch (e: unknown) {
      const ms = Date.now() - start;
      const err = e as { stdout?: string; stderr?: string; message?: string };
      const tail =
        (err.stderr || err.stdout || err.message || 'unknown error').toString();
      logChunks.push(`[${label}] FAILED in ${ms}ms: ${tail.slice(-2000)}`);
      if (!allowNonZero) {
        throw new Error(`${label} failed: ${tail.slice(-300)}`);
      }
    }
  }

  /**
   * Tokens are bearer secrets — never echo them into the execution logs.
   * Removes the `https://x-access-token:TOKEN@host/...` shape if present.
   */
  private redact(cmd: string): string {
    return cmd.replace(/https:\/\/[^@\s]+@/g, 'https://***@');
  }

  /**
   * For HTTPS repos, embed the user's PAT so the clone works without an
   * external git credential helper. For SSH URLs we use them as-is and
   * rely on the host's SSH agent.
   */
  private injectToken(repoUrl: string, token: string | null): string {
    if (!token) return repoUrl;
    if (!/^https?:\/\//i.test(repoUrl)) return repoUrl;
    try {
      const u = new URL(repoUrl);
      // For GitHub PATs the recommended user is `x-access-token`. For GitLab
      // tokens, `oauth2`. We use a generic PAT-as-password form which works
      // for all three providers.
      u.username = 'oauth2';
      u.password = token;
      return u.toString();
    } catch {
      return repoUrl;
    }
  }

  private toGithubApiPath(repoUrl: string): string | null {
    try {
      const u = new URL(repoUrl);
      if (!/github\.com$/i.test(u.hostname)) return null;
      const seg = u.pathname.replace(/^\/+|\/+$/g, '').replace(/\.git$/i, '');
      const parts = seg.split('/');
      if (parts.length < 2) return null;
      return `${parts[0]}/${parts[1]}`;
    } catch {
      return null;
    }
  }

  private async exists(p: string): Promise<boolean> {
    try {
      await fs.access(p);
      return true;
    } catch {
      return false;
    }
  }

  private shellQuote(value: string): string {
    if (process.platform === 'win32') {
      return `"${value.replace(/"/g, '\\"')}"`;
    }
    return `'${value.replace(/'/g, `'\\''`)}'`;
  }

  private tailLogs(chunks: string[]): string {
    const blob = chunks.join(' || ');
    return blob.length > 1500 ? `…${blob.slice(-1500)}` : blob;
  }

  private githubHeaders(token: string | null): Record<string, string> {
    const base: Record<string, string> = {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'qa-ai-hackathon',
    };
    if (token) base.Authorization = `Bearer ${token}`;
    return base;
  }

  /**
   * Maps GitHub Actions job conclusions to passed/failed/skipped counts.
   * Each job in the run is treated as one "test" so the user gets a quick
   * pass/fail KPI without having to crack open the artifact.
   */
  private async fetchRunJobCounts(
    apiPath: string,
    runId: number,
    token: string,
  ): Promise<{ total: number; passed: number; failed: number; skipped: number }> {
    try {
      const res = await fetch(
        `https://api.github.com/repos/${apiPath}/actions/runs/${runId}/jobs?per_page=100`,
        { headers: this.githubHeaders(token) },
      );
      if (!res.ok) return { total: 0, passed: 0, failed: 0, skipped: 0 };
      const json = (await res.json()) as {
        jobs?: Array<{ conclusion: string | null; status: string }>;
      };
      const jobs = json.jobs ?? [];
      let passed = 0;
      let failed = 0;
      let skipped = 0;
      for (const j of jobs) {
        const c = (j.conclusion ?? '').toLowerCase();
        if (c === 'success') passed += 1;
        else if (c === 'skipped' || c === 'cancelled' || c === 'neutral') skipped += 1;
        else failed += 1;
      }
      return { total: jobs.length, passed, failed, skipped };
    } catch {
      return { total: 0, passed: 0, failed: 0, skipped: 0 };
    }
  }

  /**
   * Pulls real test-session counts from BrowserStack Automate for the build
   * name we passed to the workflow. The user's Playwright config is
   * expected to set `build: process.env.BUILD_NAME` (or similar) so that
   * sessions group under one build matching `buildName`.
   *
   * Returns null if BrowserStack creds aren't configured. Returns
   * zero-count object if no matching build is found yet (workflow may have
   * raced ahead of BrowserStack indexing).
   */
  private async fetchBrowserStackBuildCounts(
    userId: string,
    buildName: string,
  ): Promise<{ total: number; passed: number; failed: number; skipped: number } | null> {
    try {
      const integration = await this.integrationRepository.findByUserId(userId);
      const bs = integration?.browserstack;
      if (!bs?.username || !bs.accessKeyEncrypted) return null;
      const key = decryptSecret(bs.accessKeyEncrypted);
      const auth = `Basic ${Buffer.from(`${bs.username}:${key}`).toString('base64')}`;

      // 1) Find the build (BrowserStack returns most-recent first).
      const buildsRes = await fetch(
        'https://api.browserstack.com/automate/builds.json?limit=20',
        { headers: { Authorization: auth, Accept: 'application/json' } },
      );
      if (!buildsRes.ok) return null;
      const builds = (await buildsRes.json()) as Array<{
        automation_build: {
          hashed_id: string;
          name: string;
          status: string;
        };
      }>;
      const target = builds.find(
        (b) => b.automation_build?.name?.trim() === buildName.trim(),
      );
      if (!target) {
        this.logger.warn(
          `BrowserStack: no build found matching "${buildName}" — falling back to GitHub job counts`,
        );
        return { total: 0, passed: 0, failed: 0, skipped: 0 };
      }

      // 2) List sessions for that build.
      const buildId = target.automation_build.hashed_id;
      const sessionsRes = await fetch(
        `https://api.browserstack.com/automate/builds/${buildId}/sessions.json?limit=200`,
        { headers: { Authorization: auth, Accept: 'application/json' } },
      );
      if (!sessionsRes.ok) return { total: 0, passed: 0, failed: 0, skipped: 0 };
      const sessions = (await sessionsRes.json()) as Array<{
        automation_session: { status: string };
      }>;

      let passed = 0;
      let failed = 0;
      let skipped = 0;
      for (const s of sessions) {
        const st = (s.automation_session?.status ?? '').toLowerCase();
        if (st === 'passed' || st === 'done') passed += 1;
        else if (st === 'skipped') skipped += 1;
        else failed += 1; // failed | error | timeout | unknown
      }
      return { total: sessions.length, passed, failed, skipped };
    } catch (e) {
      this.logger.warn(
        `BrowserStack: failed to fetch build counts: ${e instanceof Error ? e.message : e}`,
      );
      return null;
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
  }

  private async markFailure(executionId: string, reason: string): Promise<void> {
    this.logger.warn(`git-runner: pre-flight failure: ${reason}`);
    await this.executionRepository.update(executionId, {
      status: 'FAILED',
      logsUrl: reason.slice(0, 500),
    });
  }
}
