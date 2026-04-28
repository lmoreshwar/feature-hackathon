import { BadRequestException } from '@nestjs/common';
import { Types } from 'mongoose';

export const assertValidObjectId = (id: string, fieldName = 'id'): void => {
  if (!id || !Types.ObjectId.isValid(id)) {
    throw new BadRequestException(
      `"${id}" is not a valid MongoDB ObjectId for ${fieldName}`,
    );
  }
};

export const isValidObjectId = (id: unknown): boolean =>
  typeof id === 'string' && Types.ObjectId.isValid(id);
