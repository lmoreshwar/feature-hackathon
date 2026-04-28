import { IRequirementSource } from '../../interfaces';

export type RequirementStatus = IRequirementSource['status'];

export interface RequirementRecord extends IRequirementSource {
  _id: string;
}
