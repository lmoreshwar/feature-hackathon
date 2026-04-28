import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  FEATURE_MODEL_NAME,
  FeatureDocument,
  PAGE_ELEMENT_MODEL_NAME,
  PageElementDocument,
  REQUIREMENT_MODEL_NAME,
  RequirementDocument,
  TEST_CASE_MODEL_NAME,
  TEST_EXECUTION_MODEL_NAME,
  TEST_SUITE_MODEL_NAME,
  TESTCASE_MAPPING_MODEL_NAME,
  TestCaseDocument,
  TestCaseMappingDocument,
  TestExecutionDocument,
  TestSuiteDocument,
} from '../../common/schemas';
import { DashboardMetrics, TraceabilityRow } from './metrics.interface';

@Injectable()
export class MetricsService {
  constructor(
    @InjectModel(FEATURE_MODEL_NAME)
    private readonly featureModel: Model<FeatureDocument>,
    @InjectModel(TEST_SUITE_MODEL_NAME)
    private readonly testSuiteModel: Model<TestSuiteDocument>,
    @InjectModel(TEST_CASE_MODEL_NAME)
    private readonly testCaseModel: Model<TestCaseDocument>,
    @InjectModel(TESTCASE_MAPPING_MODEL_NAME)
    private readonly mappingModel: Model<TestCaseMappingDocument>,
    @InjectModel(TEST_EXECUTION_MODEL_NAME)
    private readonly executionModel: Model<TestExecutionDocument>,
    @InjectModel(REQUIREMENT_MODEL_NAME)
    private readonly requirementModel: Model<RequirementDocument>,
    @InjectModel(PAGE_ELEMENT_MODEL_NAME)
    private readonly pageElementModel: Model<PageElementDocument>,
  ) {}

  async getDashboardMetrics(): Promise<DashboardMetrics> {
    const [
      totalFeatures,
      totalTestSuites,
      totalTestCases,
      approvedTestCases,
      automatedTestCaseIds,
      passedExecutions,
      failedExecutions,
    ] = await Promise.all([
      this.featureModel.countDocuments().exec(),
      this.testSuiteModel.countDocuments().exec(),
      this.testCaseModel.countDocuments().exec(),
      this.testCaseModel.countDocuments({ status: 'APPROVED' }).exec(),
      this.mappingModel
        .find({ generatedScript: { $ne: null } })
        .distinct('testCaseId')
        .exec(),
      this.executionModel.countDocuments({ status: 'PASSED' }).exec(),
      this.executionModel.countDocuments({ status: 'FAILED' }).exec(),
    ]);

    const automatedTestCases = automatedTestCaseIds.length;
    const coveragePercentage =
      totalTestCases === 0
        ? 0
        : Math.round((approvedTestCases / totalTestCases) * 100);

    return {
      totalFeatures,
      totalTestSuites,
      totalTestCases,
      approvedTestCases,
      automatedTestCases,
      passedExecutions,
      failedExecutions,
      coveragePercentage,
    };
  }

  async getTraceability(featureId?: string): Promise<TraceabilityRow[]> {
    const requirementFilter = featureId ? { featureId } : {};
    const requirements = await this.requirementModel
      .find(requirementFilter)
      .sort({ createdAt: -1 })
      .exec();

    const testCaseFilter = featureId ? { featureId } : {};
    const testCases = await this.testCaseModel.find(testCaseFilter).exec();

    const automatedIds = new Set(
      await this.mappingModel
        .find({ generatedScript: { $ne: null } })
        .distinct('testCaseId')
        .exec(),
    );

    return requirements.map((req) => {
      const r = req.toObject() as {
        _id: { toString(): string };
        featureId: string;
        jiraId?: string;
        confluenceUrl?: string;
        requirementText?: string;
      };

      const source: TraceabilityRow['requirementSource'] = r.jiraId
        ? 'JIRA'
        : r.confluenceUrl
          ? 'CONFLUENCE'
          : r.requirementText
            ? 'TEXT'
            : 'UNKNOWN';

      const requirementKey =
        r.jiraId ?? r.confluenceUrl ?? r.requirementText?.slice(0, 80) ?? '';

      const linked = testCases
        .filter((tc) => {
          const ref = (tc.toObject() as { referenceInfo?: Record<string, string> | null })
            .referenceInfo;
          if (!ref) return false;
          if (r.jiraId && ref.jiraId === r.jiraId) return true;
          if (r.confluenceUrl && ref.confluenceUrl === r.confluenceUrl)
            return true;
          if (
            r.requirementText &&
            ref.requirementText === r.requirementText
          ) {
            return true;
          }
          return false;
        })
        .map((tc) => {
          const obj = tc.toObject() as {
            _id: { toString(): string };
            title: string;
            status: TraceabilityRow['testCases'][number]['status'];
          };
          const tcId = obj._id.toString();
          return {
            _id: tcId,
            title: obj.title,
            status: obj.status,
            automated: automatedIds.has(tcId),
          };
        });

      const approved = linked.filter((tc) => tc.status === 'APPROVED').length;
      let status: TraceabilityRow['status'] = 'GAP';
      if (linked.length === 0) status = 'GAP';
      else if (approved === linked.length) status = 'COVERED';
      else status = 'PARTIAL';

      return {
        requirementId: r._id.toString(),
        requirementSource: source,
        requirementKey,
        featureId: r.featureId,
        testCases: linked,
        status,
      };
    });
  }

  async getCountsByFeature(featureId: string) {
    const [
      suites,
      cases,
      approved,
      automatedIds,
      executions,
      pageElements,
    ] = await Promise.all([
      this.testSuiteModel.countDocuments({ featureId }).exec(),
      this.testCaseModel.countDocuments({ featureId }).exec(),
      this.testCaseModel
        .countDocuments({ featureId, status: 'APPROVED' })
        .exec(),
      this.mappingModel
        .find({ featureId, generatedScript: { $ne: null } })
        .distinct('testCaseId')
        .exec(),
      this.executionModel.countDocuments({ featureId }).exec(),
      this.pageElementModel.countDocuments({ featureId }).exec(),
    ]);

    return {
      featureId,
      totalSuites: suites,
      totalTestCases: cases,
      approvedTestCases: approved,
      automatedTestCases: automatedIds.length,
      totalExecutions: executions,
      totalPageElements: pageElements,
      coveragePercentage: cases === 0 ? 0 : Math.round((approved / cases) * 100),
    };
  }
}
