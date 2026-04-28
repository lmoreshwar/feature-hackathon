import { IBaseCollection } from './IBase';

// =====================================================
// PAGE CRAWL ELEMENTS
// =====================================================


export interface IPageElement extends IBaseCollection {
  featureId: string; // IFeature._id
  testSuiteId?: string; // ITestSuite._id

  pageUrl: string;
  pageName?: string;

  elementName: string;

  elementType:
    | 'BUTTON'
    | 'INPUT'
    | 'LINK'
    | 'DROPDOWN'
    | 'CHECKBOX'
    | 'TEXT'
    | 'OTHER';

  selector: string;
  selectorType: 'ID' | 'CSS' | 'XPATH' | 'TEXT';

  isStable: boolean;

  createdBy: string; // IUser._id
}
