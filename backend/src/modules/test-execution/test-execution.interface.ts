import { ITestExecution } from '../../interfaces';

export type ExecutionProvider = ITestExecution['provider'];
export type ExecutionStatus = ITestExecution['status'];

export interface ExecutionRecord extends ITestExecution {
  _id: string;
}
