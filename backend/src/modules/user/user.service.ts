import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { Types } from 'mongoose';
import { CreateUserDto } from './dto/create-user.dto';
import { ListUsersQueryDto } from './dto/list-users.query.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserDocument } from '../../common/schemas';
import { PaginatedUsers, SafeUser } from './user.interface';
import { UpdateUserData, UserRepository } from './user.repository';

const BCRYPT_SALT_ROUNDS = 10;

@Injectable()
export class UserService {
  constructor(private readonly userRepository: UserRepository) {}

  async createUser(dto: CreateUserDto): Promise<SafeUser> {
    const email = this.normalizeEmail(dto.email);

    const exists = await this.userRepository.existsByEmail(email);
    if (exists) {
      throw new ConflictException(`User with email "${email}" already exists`);
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_SALT_ROUNDS);

    const created = await this.userRepository.create({ email, passwordHash });
    if (!created) {
      throw new BadRequestException('Failed to create user');
    }

    return this.toSafeUser(created);
  }

  async getUserById(id: string): Promise<SafeUser> {
    this.assertValidObjectId(id);

    const user = await this.userRepository.findById(id);
    if (!user) {
      throw new NotFoundException(`User with id "${id}" not found`);
    }
    return this.toSafeUser(user);
  }

  async getUserByEmail(email: string): Promise<SafeUser> {
    if (!email || typeof email !== 'string') {
      throw new BadRequestException('email is required');
    }
    const user = await this.userRepository.findByEmail(this.normalizeEmail(email));
    if (!user) {
      throw new NotFoundException(`User with email "${email}" not found`);
    }
    return this.toSafeUser(user);
  }

  async listUsers(query: ListUsersQueryDto): Promise<PaginatedUsers> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const search = query.search?.trim();

    const { items, total } = await this.userRepository.findAll(page, limit, search);
    const totalPages = total === 0 ? 0 : Math.ceil(total / limit);

    return {
      items: items.map((u) => this.toSafeUser(u)),
      page,
      limit,
      total,
      totalPages,
    };
  }

  async updateUser(id: string, dto: UpdateUserDto): Promise<SafeUser> {
    this.assertValidObjectId(id);

    const existing = await this.userRepository.findById(id);
    if (!existing) {
      throw new NotFoundException(`User with id "${id}" not found`);
    }

    const update: UpdateUserData = {};

    if (dto.email !== undefined) {
      const email = this.normalizeEmail(dto.email);
      if (email !== existing.email) {
        const inUse = await this.userRepository.existsByEmail(email);
        if (inUse) {
          throw new ConflictException(
            `User with email "${email}" already exists`,
          );
        }
        update.email = email;
      }
    }

    if (dto.password !== undefined) {
      update.passwordHash = await bcrypt.hash(dto.password, BCRYPT_SALT_ROUNDS);
    }

    if (Object.keys(update).length === 0) {
      return this.toSafeUser(existing);
    }

    const updated = await this.userRepository.update(id, update);
    if (!updated) {
      throw new NotFoundException(`User with id "${id}" not found`);
    }

    return this.toSafeUser(updated);
  }

  async deleteUser(id: string): Promise<{ id: string }> {
    this.assertValidObjectId(id);

    const deleted = await this.userRepository.delete(id);
    if (!deleted) {
      throw new NotFoundException(`User with id "${id}" not found`);
    }
    return { id };
  }

  private assertValidObjectId(id: string): void {
    if (!id || !Types.ObjectId.isValid(id)) {
      throw new BadRequestException(`"${id}" is not a valid MongoDB ObjectId`);
    }
  }

  private normalizeEmail(email: string): string {
    return email.toLowerCase().trim();
  }

  private toSafeUser(doc: UserDocument): SafeUser {
    const obj = doc.toObject() as {
      email: string;
      createdAt: number;
      updatedAt: number;
      passwordHash?: string;
    };

    delete obj.passwordHash;

    return {
      _id: doc._id.toString(),
      email: obj.email,
      createdAt: obj.createdAt,
      updatedAt: obj.updatedAt,
    };
  }
}
