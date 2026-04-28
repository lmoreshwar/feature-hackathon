import { TestCaseDocument } from '../../common/schemas/test-case.schema';
import { PageElementDocument } from '../../common/schemas/page-element.schema';
import { ScriptType } from './testcase-mapping.interface';

const sanitizeTitle = (title: string): string =>
  title.replace(/[`'"]/g, '').slice(0, 120);

const elementSelector = (el: PageElementDocument): string => {
  const obj = el.toObject() as { selector: string; selectorType: string };
  switch (obj.selectorType) {
    case 'XPATH':
      return `xpath=${obj.selector}`;
    case 'TEXT':
      return `text=${obj.selector}`;
    case 'ID':
      return obj.selector.startsWith('#') ? obj.selector : `#${obj.selector}`;
    default:
      return obj.selector;
  }
};

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

  if (scriptType === 'PLAYWRIGHT') {
    const interactions = elements
      .map((el, idx) => {
        const obj = el.toObject() as { elementType: string; elementName: string };
        const sel = elementSelector(el);
        if (obj.elementType === 'INPUT') {
          return `  await page.locator('${sel}').fill('VALUE_${idx + 1}'); // ${obj.elementName}`;
        }
        if (obj.elementType === 'BUTTON' || obj.elementType === 'LINK') {
          return `  await page.locator('${sel}').click(); // ${obj.elementName}`;
        }
        if (obj.elementType === 'CHECKBOX') {
          return `  await page.locator('${sel}').check(); // ${obj.elementName}`;
        }
        return `  await page.locator('${sel}').waitFor(); // ${obj.elementName}`;
      })
      .join('\n');

    return `import { test, expect } from '@playwright/test';

// Steps:
${steps.map((s, i) => `// ${i + 1}. ${s}`).join('\n')}
// Expected: ${expectedResult}

test('${title}', async ({ page }) => {
  await page.goto(process.env.AUT_BASE_URL ?? 'https://www.saucedemo.com/');
${interactions}
  // TODO: assert: ${expectedResult}
});
`;
  }

  if (scriptType === 'CYPRESS') {
    const interactions = elements
      .map((el, idx) => {
        const obj = el.toObject() as { elementType: string; elementName: string };
        const sel = elementSelector(el);
        if (obj.elementType === 'INPUT') {
          return `  cy.get('${sel}').type('VALUE_${idx + 1}'); // ${obj.elementName}`;
        }
        return `  cy.get('${sel}').click(); // ${obj.elementName}`;
      })
      .join('\n');

    return `// Steps:
${steps.map((s, i) => `// ${i + 1}. ${s}`).join('\n')}
// Expected: ${expectedResult}

describe('${title}', () => {
  it('runs ${title}', () => {
    cy.visit(Cypress.env('AUT_BASE_URL') || 'https://www.saucedemo.com/');
${interactions}
    // TODO: assert: ${expectedResult}
  });
});
`;
  }

  // SELENIUM (Node)
  const interactions = elements
    .map((el, idx) => {
      const obj = el.toObject() as { elementType: string; elementName: string };
      const sel = elementSelector(el);
      const by =
        obj.elementType === 'INPUT'
          ? `await driver.findElement(By.css('${sel}')).sendKeys('VALUE_${idx + 1}'); // ${obj.elementName}`
          : `await driver.findElement(By.css('${sel}')).click(); // ${obj.elementName}`;
      return `  ${by}`;
    })
    .join('\n');
  return `const { Builder, By } = require('selenium-webdriver');

// Steps:
${steps.map((s, i) => `// ${i + 1}. ${s}`).join('\n')}
// Expected: ${expectedResult}

(async function ${title.replace(/[^a-zA-Z0-9_]/g, '_')}() {
  const driver = await new Builder().forBrowser('chrome').build();
  try {
    await driver.get(process.env.AUT_BASE_URL || 'https://www.saucedemo.com/');
${interactions}
    // TODO: assert: ${expectedResult}
  } finally {
    await driver.quit();
  }
})();
`;
};
