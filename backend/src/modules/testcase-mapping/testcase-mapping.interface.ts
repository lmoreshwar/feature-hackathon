import { ITestCaseElementMapping } from '../../interfaces';

export type ScriptType = ITestCaseElementMapping['scriptType'];
export type GitPushStatus = NonNullable<ITestCaseElementMapping['gitPushStatus']>;

export interface MappingRecord extends ITestCaseElementMapping {
  _id: string;
}
