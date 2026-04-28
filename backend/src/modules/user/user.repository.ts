import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, UpdateQuery } from 'mongoose';
import { USER_MODEL_NAME, UserDocument } from '../../common/schemas';

export interface CreateUserData {
  email: string;
  passwordHash: string;
}

export interface UpdateUserData {
  email?: string;
  passwordHash?: string;
  refreshTokenHash?: string | null;
}

export interface ListUsersResult {
  items: UserDocument[];
  total: number;
}

@Injectable()
export class UserRepository {
  constructor(
    @InjectModel(USER_MODEL_NAME) private readonly userModel: Model<UserDocument>,
  ) {}

  async create(data: CreateUserData): Promise<UserDocument> {
    const now = Date.now();
    const created = await this.userModel.create({
      ...data,
      createdAt: now,
      updatedAt: now,
    });
    return this.findById(created._id.toString());
  }

  async findById(id: string): Promise<UserDocument | null> {
    return this.userModel.findById(id).exec();
  }

  async findByIdWithPassword(id: string): Promise<UserDocument | null> {
    return this.userModel
      .findById(id)
      .select('+passwordHash +refreshTokenHash')
      .exec();
  }

  async findByEmail(email: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ email: email.toLowerCase().trim() }).exec();
  }

  async findByEmailWithPassword(email: string): Promise<UserDocument | null> {
    return this.userModel
      .findOne({ email: email.toLowerCase().trim() })
      .select('+passwordHash +refreshTokenHash')
      .exec();
  }

  async findAll(
    page: number,
    limit: number,
    search?: string,
  ): Promise<ListUsersResult> {
    const safePage = Math.max(1, Math.floor(page) || 1);
    const safeLimit = Math.max(1, Math.min(100, Math.floor(limit) || 10));
    const skip = (safePage - 1) * safeLimit;

    const filter: FilterQuery<UserDocument> = {};
    if (search && search.trim().length > 0) {
      const escaped = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.email = { $regex: escaped, $options: 'i' };
    }

    const [items, total] = await Promise.all([
      this.userModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(safeLimit)
        .exec(),
      this.userModel.countDocuments(filter).exec(),
    ]);

    return { items, total };
  }

  async update(id: string, data: UpdateUserData): Promise<UserDocument | null> {
    const update: UpdateQuery<UserDocument> = {
      ...data,
      updatedAt: Date.now(),
    };
    return this.userModel
      .findByIdAndUpdate(id, update, { new: true, runValidators: true })
      .exec();
  }

  async delete(id: string): Promise<UserDocument | null> {
    return this.userModel.findByIdAndDelete(id).exec();
  }

  async existsByEmail(email: string): Promise<boolean> {
    const found = await this.userModel
      .exists({ email: email.toLowerCase().trim() })
      .exec();
    return Boolean(found);
  }
}
