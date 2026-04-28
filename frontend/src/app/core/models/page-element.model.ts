import { IBaseCollection } from './common.models';

export type PageElementType =
  | 'BUTTON'
  | 'INPUT'
  | 'LINK'
  | 'DROPDOWN'
  | 'CHECKBOX'
  | 'TEXT'
  | 'OTHER';

export type PageSelectorType = 'ID' | 'CSS' | 'XPATH' | 'TEXT';

export const PAGE_ELEMENT_TYPES: readonly PageElementType[] = [
  'BUTTON',
  'INPUT',
  'LINK',
  'DROPDOWN',
  'CHECKBOX',
  'TEXT',
  'OTHER',
] as const;

export const PAGE_SELECTOR_TYPES: readonly PageSelectorType[] = [
  'ID',
  'CSS',
  'XPATH',
  'TEXT',
] as const;

export interface IPageElement extends IBaseCollection {
  featureId: string;
  testSuiteId?: string;
  pageUrl: string;
  pageName?: string;
  elementName: string;
  elementType: PageElementType;
  selector: string;
  selectorType: PageSelectorType;
  isStable: boolean;
  createdBy: string;
}

export interface CreatePageElementPayload {
  featureId: string;
  testSuiteId?: string;
  pageUrl: string;
  pageName?: string;
  elementName: string;
  elementType: PageElementType;
  selector: string;
  selectorType: PageSelectorType;
  isStable?: boolean;
}

export type UpdatePageElementPayload = Partial<
  Omit<CreatePageElementPayload, 'featureId'>
>;
