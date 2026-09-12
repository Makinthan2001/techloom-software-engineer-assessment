import { prisma } from '../config/index.js';
import type { User, Role, Prisma } from '@prisma/client';

export type SafeUser = Omit<User, 'passwordHash'>;

export const safeUserSelect: Prisma.UserSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  createdAt: true,
  updatedAt: true,
};

export const userRepository = {
  async findByEmail(email: string): Promise<User | null> {
    return prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });
  },

  async findByIdSafe(id: string): Promise<SafeUser | null> {
    return prisma.user.findUnique({
      where: { id },
      select: safeUserSelect,
    }) as Promise<SafeUser | null>;
  },

  async createUser(data: {
    name: string;
    email: string;
    passwordHash: string;
    role: Role;
  }): Promise<SafeUser> {
    return prisma.user.create({
      data: {
        ...data,
        email: data.email.toLowerCase(),
      },
      select: safeUserSelect,
    }) as Promise<SafeUser>;
  },
};
