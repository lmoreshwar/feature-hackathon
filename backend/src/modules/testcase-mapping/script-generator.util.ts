import { TestCaseDocument } from '../../common/schemas/test-case.schema';
import { PageElementDocument } from '../../common/schemas/page-element.schema';
import {
  PageGroup,
  groupElementsByPage,
  safeIdent,
} from '../page-element/pom-generator.util';
import { PageElementRecord } from '../page-element/page-element.interface';
import { ScriptType } from './testcase-mapping.interface';

const sanitizeTitle = (title: string): string =>
  title.replace(/[`'"]/g, '').slice(0, 120);

interface ElementUsage {
  page: PageGroup;
  element: PageElementRecord;
}

const elementToRecord = (doc: PageElementDocument): PageElementRecord => {
  const obj = doc.toObject() as Record<string, unknown>;
  return {
    _id: doc._id.toString(),
    featureId: obj.featureId as string,
    testSuiteId: (obj.testSuiteId as string) ?? undefined,
    pageUrl: obj.pageUrl as string,
    pageName: (obj.pageName as string) ?? undefined,
    elementName: obj.elementName as string,
    elementType: obj.elementType as PageElementRecord['elementType'],
    selector: obj.selector as string,
    selectorType: obj.selectorType as PageElementRecord['selectorType'],
    isStable: (obj.isStable as boolean) ?? true,
    createdBy: obj.createdBy as string,
    createdAt: obj.createdAt as number,
    updatedAt: obj.updatedAt as number,
  };
};

/**
 * Build one POM-aware test script for the given test case + ordered list of
 * elements. Each element resolves to its containing Page Object so the script
 * uses references like `loginPage.emailInput.fill('VALUE')` rather than
 * inline locators — matching the POM files generated under
 * `GET /api/page-elements/by-feature/:id/pom`.
 */
export const generateScript = (
  scriptType: ScriptType,
  testCase: TestCaseDocument,
  elements: PageElementDocument[],
): string => {
  const tcObj = testCase.toObject() as {
    title: string;
    steps: string[];
    expectedResult: string;
  };
  const title = sanitizeTitle(tcObj.title);
  const steps = tcObj.steps ?? [];
  const expectedResult = tcObj.expectedResult ?? '';

  const records = elements.map(elementToRecord);
  const groups = groupElementsByPage(records);
  // Map each element's _id to its owning group (preserves caller-supplied order).
  const groupByElementId = new Map<string, PageGroup>();
  for (const g of groups) {
    for (const el of g.elements) groupByElementId.set(el._id, g);
  }
  const usages: ElementUsage[] = records
    .map((r) => {
      const g = groupByElementId.get(r._id);
      return g ? { page: g, element: r } : null;
    })
    .filter((u): u is ElementUsage => u !== null);

  if (scriptType === 'PLAYWRIGHT') {
    return renderPlaywrightScript(title, steps, expectedResult, groups, usages);
  }
  if (scriptType === 'CYPRESS') {
    return renderCypressScript(title, steps, expectedResult, groups, usages);
  }
  return renderSeleniumScript(title, steps, expectedResult, groups, usages);
};

const pageVarName = (g: PageGroup): string =>
  safeIdent(g.className.replace(/Page$/, '') + 'Page');

const renderPlaywrightScript = (
  title: string,
  steps: string[],
  expectedResult: string,
  groups: PageGroup[],
  usages: ElementUsage[],
): string => {
  // Empty crawl → emit a clearly-marked STUB script so the engineer can
  // fill in selectors after running the crawler.
  if (groups.length === 0) {
    return renderPlaywrightStub(title, steps, expectedResult);
  }

  const imports = groups
    .map((g) => `import { ${g.className} } from './pages/${g.className}';`)
    .join('\n');
  const instantiations = groups
    .map((g) => `  const ${pageVarName(g)} = new ${g.className}(page);`)
    .join('\n');
  const openPrimary = groups[0] ? `  await ${pageVarName(groups[0])}.open();` : '';
  const interactions = usages
    .map((u, idx) => playwrightInteraction(u, idx))
    .join('\n');

  return `import { test, expect } from '@playwright/test';
${imports}

// Steps:
${steps.map((s, i) => `// ${i + 1}. ${s}`).join('\n')}
// Expected: ${expectedResult}

test('${title}', async ({ page }) => {
${instantiations}
${openPrimary}
${interactions}
  // TODO: assert: ${expectedResult}
});
`;
};

const renderPlaywrightStub = (
  title: string,
  steps: string[],
  expectedResult: string,
): string => {
  const stepLines = steps
    .map(
      (s, i) =>
        `  // Step ${i + 1}: ${s}\n  // TODO: await page.locator('REPLACE_WITH_SELECTOR').click(); // ${shortLabel(s)}`,
    )
    .join('\n\n');
  return `import { test, expect } from '@playwright/test';

/**
 * STUB SCRIPT \u2014 No crawled page elements were found for this feature.
 *  1. Run the Page Crawler for this feature to capture locators.
 *  2. Re-generate this script to replace the TODOs with real Page Object calls.
 *
 * Title: ${title}
 * Expected: ${expectedResult}
 */
test('${title}', async ({ page }) => {
  await page.goto('REPLACE_WITH_BASE_URL');

${stepLines}

  // TODO: assert: ${expectedResult}
});
`;
};

const shortLabel = (s: string): string =>
  s.replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60);

const playwrightInteraction = (u: ElementUsage, idx: number): string => {
  const ref = `${pageVarName(u.page)}.${safeIdent(u.element.elementName)}`;
  if (u.element.elementType === 'INPUT')
    return `  await ${ref}.fill('VALUE_${idx + 1}'); // ${u.element.elementName}`;
  if (u.element.elementType === 'BUTTON' || u.element.elementType === 'LINK')
    return `  await ${ref}.click(); // ${u.element.elementName}`;
  if (u.element.elementType === 'CHECKBOX')
    return `  await ${ref}.check(); // ${u.element.elementName}`;
  if (u.element.elementType === 'DROPDOWN')
    return `  await ${ref}.selectOption({ index: 0 }); // ${u.element.elementName}`;
  return `  await ${ref}.waitFor(); // ${u.element.elementName}`;
};

const renderCypressScript = (
  title: string,
  steps: string[],
  expectedResult: string,
  groups: PageGroup[],
  usages: ElementUsage[],
): string => {
  const requires = groups
    .map((g) => `const ${g.className} = require('./pages/${g.className}');`)
    .join('\n');
  const instantiations = groups
    .map((g) => `  const ${pageVarName(g)} = new ${g.className}();`)
    .join('\n');
  const openPrimary = groups[0]
    ? `  ${pageVarName(groups[0])}.open();`
    : '';
  const interactions = usages
    .map((u, idx) => cypressInteraction(u, idx))
    .join('\n');

  return `${requires}

// Steps:
${steps.map((s, i) => `// ${i + 1}. ${s}`).join('\n')}
// Expected: ${expectedResult}

describe('${title}', () => {
  it('runs ${title}', () => {
${instantiations}
${openPrimary}
${interactions}
    // TODO: assert: ${expectedResult}
  });
});
`;
};

const cypressInteraction = (u: ElementUsage, idx: number): string => {
  const ref = `${pageVarName(u.page)}.${safeIdent(u.element.elementName)}()`;
  if (u.element.elementType === 'INPUT')
    return `    ${ref}.type('VALUE_${idx + 1}'); // ${u.element.elementName}`;
  if (u.element.elementType === 'CHECKBOX')
    return `    ${ref}.check(); // ${u.element.elementName}`;
  return `    ${ref}.click(); // ${u.element.elementName}`;
};

const renderSeleniumScript = (
  title: string,
  steps: string[],
  expectedResult: string,
  groups: PageGroup[],
  usages: ElementUsage[],
): string => {
  const imports = groups
    .map(
      (g) => `import com.example.pages.${g.className};`,
    )
    .join('\n');
  const instantiations = groups
    .map(
      (g) => `        ${g.className} ${pageVarName(g)} = new ${g.className}(driver);`,
    )
    .join('\n');
  const openPrimary = groups[0]
    ? `        ${pageVarName(groups[0])}.open();`
    : '';
  const interactions = usages
    .map((u, idx) => seleniumInteraction(u, idx))
    .join('\n');
  const safeTitle = title.replace(/[^A-Za-z0-9_]/g, '_');

  return `import org.openqa.selenium.WebDriver;
import org.openqa.selenium.chrome.ChromeDriver;
${imports}

/**
 * Steps:
${steps.map((s, i) => ` * ${i + 1}. ${s}`).join('\n')}
 * Expected: ${expectedResult}
 */
public class ${safeTitle} {
    public static void main(String[] args) {
        WebDriver driver = new ChromeDriver();
        try {
${instantiations}
${openPrimary}
${interactions}
            // TODO: assert: ${expectedResult}
        } finally {
            driver.quit();
        }
    }
}
`;
};

const seleniumInteraction = (u: ElementUsage, idx: number): string => {
  const getter = `${pageVarName(u.page)}.get${capitalize(safeIdent(u.element.elementName))}()`;
  if (u.element.elementType === 'INPUT')
    return `            ${getter}.sendKeys("VALUE_${idx + 1}"); // ${u.element.elementName}`;
  return `            ${getter}.click(); // ${u.element.elementName}`;
};

const capitalize = (s: string): string =>
  s.length === 0 ? s : s.charAt(0).toUpperCase() + s.slice(1);
