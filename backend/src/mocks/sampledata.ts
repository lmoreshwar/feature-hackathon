import {
  IUser,
  IIntegrationSettings,
  IFeature,
  IRequirementSource,
  ITestSuite,
  ITestCase,
  IPageElement,
  ITestCaseElementMapping,
  ITestExecution,
} from '../interfaces';

const now = Date.now();

// =====================================================
// USER
// =====================================================

export const user: IUser = {
  _id: 'user_001',
  email: 'arul@quantumai.com',
  passwordHash: 'hashed_password_here',
  createdAt: now,
  updatedAt: now,
};

// =====================================================
// INTEGRATION SETTINGS
// =====================================================

export const integration: IIntegrationSettings = {
  _id: 'int_001',
  userId: 'user_001',
  jira: {
    baseUrl: 'https://company.atlassian.net',
    email: 'arul@company.com',
    apiTokenEncrypted: 'encrypted_token',
  },
  git: {
    provider: 'GITHUB',
    repoUrl: 'https://github.com/quantum-ai/tests',
    tokenEncrypted: 'encrypted_git_token',
    branch: 'main',
  },
  browserstack: {
    username: 'arul_bs',
    accessKeyEncrypted: 'encrypted_bs_key',
  },
  createdAt: now,
  updatedAt: now,
};

// =====================================================
// FEATURE
// =====================================================

export const feature: IFeature = {
  _id: 'feat_001',
  name: 'Login Feature',
  description: 'User authentication module',
  status: 'ACTIVE',
  totalSuites: 1,
  totalTestCases: 2,
  coveragePercentage: 80,
  createdBy: 'user_001',
  createdAt: now,
  updatedAt: now,
};

// =====================================================
// REQUIREMENT SOURCE
// =====================================================

export const requirement: IRequirementSource = {
  _id: 'req_001',
  featureId: 'feat_001',
  jiraId: 'AUTH-101',
  requirementText: 'User should login with email and password',
  status: 'PROCESSED',
  createdBy: 'user_001',
  createdAt: now,
  updatedAt: now,
};

// =====================================================
// TEST SUITE
// =====================================================

export const testSuite: ITestSuite = {
  _id: 'suite_001',
  featureId: 'feat_001',
  moduleName: 'Login Module',
  version: 'v1.0.0',
  totalTests: 2,
  passedTests: 1,
  failedTests: 1,
  passPercentage: 50,
  status: 'ACTIVE',
  referenceInfo: {
    jiraId: 'AUTH-101',
  },
  createdBy: 'user_001',
  createdAt: now,
  updatedAt: now,
};

// =====================================================
// TEST CASES
// =====================================================

export const testCases: ITestCase[] = [
  {
    _id: 'tc_001',
    featureId: 'feat_001',
    testSuiteId: 'suite_001',
    title: 'Valid Login',
    steps: ['Enter email', 'Enter password', 'Click login'],
    expectedResult: 'User should be logged in',
    priority: 'HIGH',
    type: 'FUNCTIONAL',
    status: 'APPROVED',
    createdBy: 'user_001',
    createdAt: now,
    updatedAt: now,
  },
  {
    _id: 'tc_002',
    featureId: 'feat_001',
    testSuiteId: 'suite_001',
    title: 'Invalid Login',
    steps: ['Enter wrong password', 'Click login'],
    expectedResult: 'Error message should be shown',
    priority: 'MEDIUM',
    type: 'FUNCTIONAL',
    status: 'APPROVED',
    createdBy: 'user_001',
    createdAt: now,
    updatedAt: now,
  },
];

// =====================================================
// PAGE ELEMENTS
// =====================================================

export const elements: IPageElement[] = [
  {
    _id: 'el_001',
    featureId: 'feat_001',
    pageUrl: '/login',
    elementName: 'Email Input',
    elementType: 'INPUT',
    selector: '#email',
    selectorType: 'CSS',
    isStable: true,
    createdBy: 'user_001',
    createdAt: now,
    updatedAt: now,
  },
  {
    _id: 'el_002',
    featureId: 'feat_001',
    pageUrl: '/login',
    elementName: 'Login Button',
    elementType: 'BUTTON',
    selector: '#login-btn',
    selectorType: 'CSS',
    isStable: true,
    createdBy: 'user_001',
    createdAt: now,
    updatedAt: now,
  },
];

// =====================================================
// TESTCASE → PAGE ELEMENT MAPPING
// =====================================================

export const mapping: ITestCaseElementMapping = {
  _id: 'map_001',
  featureId: 'feat_001',
  testSuiteId: 'suite_001',
  testCaseId: 'tc_001',
  elementIds: ['el_001', 'el_002'],
  scriptType: 'PLAYWRIGHT',
  generatedScript: `
await page.fill('#email', 'test@mail.com');
await page.fill('#password', '123456');
await page.click('#login-btn');
`,
  gitPushStatus: 'NOT_PUSHED',
  createdBy: 'user_001',
  createdAt: now,
  updatedAt: now,
};

// =====================================================
// TEST EXECUTION
// =====================================================

export const execution: ITestExecution = {
  _id: 'exec_001',
  featureId: 'feat_001',
  testSuiteId: 'suite_001',
  testCaseIds: ['tc_001', 'tc_002'],
  buildName: 'Login Regression Build',
  provider: 'BROWSERSTACK',
  status: 'RUNNING',
  totalTests: 2,
  passedTests: 1,
  failedTests: 0,
  triggeredBy: 'user_001',
  createdAt: now,
  updatedAt: now,
};
