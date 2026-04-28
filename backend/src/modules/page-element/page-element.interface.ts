import { IPageElement } from '../../interfaces';

export type PageElementType = IPageElement['elementType'];
export type PageSelectorType = IPageElement['selectorType'];

export interface PageElementRecord extends IPageElement {
  _id: string;
}
