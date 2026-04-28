import { Injectable, NotFoundException } from '@nestjs/common';
import { TestExecutionDocument } from '../../common/schemas';
import { PaginatedResult } from '../../common/interfaces/api-response.interface';
import { paginate } from '../../common/utils/search-query.util';
import { assertValidObjectId } from '../../common/utils/object-id.util';
import { BrowserStackRunnerService } from './browserstack-runner.service';
import { CreateExecutionDto } from './dto/create-execution.dto';
import { RunFromGitDto } from './dto/run-from-git.dto';
import { RunWorkflowDto } from './dto/run-workflow.dto';
import { SearchExecutionDto } from './dto/search-execution.dto';
import { UpdateExecutionDto } from './dto/update-execution.dto';
import {
  GitRepo,
  GitRunnerService,
  GitWorkflow,
} from './git-runner.service';
import {
  ExecutionRecord,
  ExecutionStatus,
} from './test-execution.interface';
import { ExecutionRepository } from './test-execution.repository';

@Injectable()
export class ExecutionService {
  constructor(
    private readonly executionRepository: ExecutionRepository,
    private readonly browserStackRunner: BrowserStackRunnerService,
    private readonly gitRunner: GitRunnerService,
  ) {}

  async trigger(
    dto: CreateExecutionDto,
    triggeredBy: string,
  ): Promise<ExecutionRecord> {
    assertValidObjectId(dto.featureId, 'featureId');
    if (dto.testSuiteId) {
      assertValidObjectId(dto.testSuiteId, 'testSuiteId');
    }

    const provider = dto.provider ?? 'LOCAL';

    const created = await this.executionRepository.create({
      featureId: dto.featureId,
      testSuiteId: dto.testSuiteId ?? null,
      testCaseIds: dto.testCaseIds ?? [],
      buildName: dto.buildName.trim(),
      provider,
      status: dto.status ?? 'QUEUED',
      totalTests: dto.testCaseIds?.length ?? 0,
      triggeredBy,
    });

    const record = this.toRecord(created);

    // Kick off the BrowserStack run asynchronously. The HTTP response goes
    // back immediately with the QUEUED record so the UI can start polling;
    // the runner mutates this same execution document as it progresses.
    if (provider === 'BROWSERSTACK') {
      void this.browserStackRunner.runInBackground(
        {
          executionId: record._id,
          featureId: record.featureId,
          testSuiteId: record.testSuiteId,
          testCaseIds: record.testCaseIds,
          buildName: record.buildName,
          baseUrl: dto.baseUrl,
          caps: dto.browserStack,
        },
        triggeredBy,
      );
    }

    return record;
  }

  /**
   * Trigger a Playwright run from a user's connected git branch on
   * BrowserStack. Creates a QUEUED execution record and dispatches the
   * git-runner asynchronously so the HTTP call returns immediately and
   * the UI can poll `GET /test-executions/:id` for live counts.
   */
  async triggerFromGit(
    dto: RunFromGitDto,
    triggeredBy: string,
  ): Promise<ExecutionRecord> {
    assertValidObjectId(dto.featureId, 'featureId');

    const created = await this.executionRepository.create({
      featureId: dto.featureId,
      testCaseIds: [],
      buildName: dto.buildName.trim(),
      provider: 'BROWSERSTACK',
      status: 'QUEUED',
      totalTests: 0,
      logsUrl: `Cloning ${dto.repoUrl ? '(override repo)' : 'connected repo'} @ ${dto.branch}…`,
      triggeredBy,
    });
    const record = this.toRecord(created);

    void this.gitRunner.runInBackground(
      {
        executionId: record._id,
        branch: dto.branch,
        buildName: record.buildName,
        repoUrlOverride: dto.repoUrl,
        testPath: dto.testPath,
      },
      triggeredBy,
    );

    return record;
  }

  async listGitRepos(userId: string): Promise<GitRepo[]> {
    return this.gitRunner.listRepos(userId);
  }

  async listGitBranches(userId: string, repo?: string): Promise<string[]> {
    return this.gitRunner.listBranches(userId, repo);
  }

  async listGitWorkflows(
    userId: string,
    repo?: string,
  ): Promise<GitWorkflow[]> {
    return this.gitRunner.listWorkflows(userId, repo);
  }

  /**
   * Trigger a GitHub Actions workflow_dispatch on the chosen branch and
   * track the resulting run. Creates a QUEUED execution that the dispatcher
   * mutates as the workflow progresses.
   */
  async runGitWorkflow(
    dto: RunWorkflowDto,
    triggeredBy: string,
  ): Promise<ExecutionRecord> {
    assertValidObjectId(dto.featureId, 'featureId');

    const created = await this.executionRepository.create({
      featureId: dto.featureId,
      testCaseIds: [],
      buildName: dto.buildName.trim(),
      provider: 'BROWSERSTACK',
      status: 'QUEUED',
      totalTests: 0,
      logsUrl: `Dispatching ${dto.workflowFile} on ${dto.branch}${dto.repo ? ` (${dto.repo})` : ''}…`,
      triggeredBy,
    });
    const record = this.toRecord(created);

    void this.gitRunner.dispatchAndTrackWorkflow(
      {
        executionId: record._id,
        workflowFile: dto.workflowFile,
        branch: dto.branch,
        buildName: record.buildName,
        repo: dto.repo,
      },
      triggeredBy,
    );

    return record;
  }

  async getById(id: string): Promise<ExecutionRecord> {
    assertValidObjectId(id);
    const found = await this.executionRepository.findById(id);
    if (!found) {
      throw new NotFoundException(`Execution with id "${id}" not found`);
    }
    return this.toRecord(found);
  }

  async search(
    dto: SearchExecutionDto,
  ): Promise<PaginatedResult<ExecutionRecord>> {
    const pageIndex = dto.pageIndex ?? 1;
    const pageSize = dto.pageSize ?? 10;
    const { items, total } = await this.executionRepository.search(dto);
    return paginate(
      items.map((i) => this.toRecord(i)),
      total,
      pageIndex,
      pageSize,
    );
  }

  async update(
    id: string,
    dto: UpdateExecutionDto,
  ): Promise<ExecutionRecord> {
    assertValidObjectId(id);
    const updated = await this.executionRepository.update(id, {
      buildName: dto.buildName?.trim(),
      status: dto.status,
      totalTests: dto.totalTests,
      passedTests: dto.passedTests,
      failedTests: dto.failedTests,
      skippedTests: dto.skippedTests,
      reportUrl: dto.reportUrl,
      videoUrl: dto.videoUrl,
      logsUrl: dto.logsUrl,
    });
    if (!updated) {
      throw new NotFoundException(`Execution with id "${id}" not found`);
    }
    return this.toRecord(updated);
  }

  async setStatus(
    id: string,
    status: ExecutionStatus,
  ): Promise<ExecutionRecord> {
    assertValidObjectId(id);
    const updated = await this.executionRepository.update(id, { status });
    if (!updated) {
      throw new NotFoundException(`Execution with id "${id}" not found`);
    }
    return this.toRecord(updated);
  }

  async delete(id: string): Promise<{ id: string }> {
    assertValidObjectId(id);
    const deleted = await this.executionRepository.delete(id);
    if (!deleted) {
      throw new NotFoundException(`Execution with id "${id}" not found`);
    }
    return { id };
  }

  private toRecord(doc: TestExecutionDocument): ExecutionRecord {
    const obj = doc.toObject() as Record<string, unknown>;
    return {
      _id: doc._id.toString(),
      featureId: obj.featureId as string,
      testSuiteId: (obj.testSuiteId as string) ?? undefined,
      testCaseIds: (obj.testCaseIds as string[]) ?? [],
      buildName: obj.buildName as string,
      provider: obj.provider as ExecutionRecord['provider'],
      status: obj.status as ExecutionRecord['status'],
      totalTests: (obj.totalTests as number) ?? 0,
      passedTests: (obj.passedTests as number) ?? 0,
      failedTests: (obj.failedTests as number) ?? 0,
      skippedTests: (obj.skippedTests as number) ?? 0,
      reportUrl: (obj.reportUrl as string) ?? undefined,
      videoUrl: (obj.videoUrl as string) ?? undefined,
      logsUrl: (obj.logsUrl as string) ?? undefined,
      triggeredBy: obj.triggeredBy as string,
      createdAt: obj.createdAt as number,
      updatedAt: obj.updatedAt as number,
    };
  }
}
