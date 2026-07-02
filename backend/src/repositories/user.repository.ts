import { prisma } from '../database/prisma.js';

export const userRepository = {
  async findById(id: string) {
    if (!process.env.DATABASE_URL) return null;
    return prisma.user.findUnique({ where: { id } });
  },

  async upsertFromClerk(params: {
    id: string;
    email?: string;
    name?: string;
    imageUrl?: string;
  }) {
    if (!process.env.DATABASE_URL) return null;
    return prisma.user.upsert({
      where: { id: params.id },
      create: params,
      update: {
        email: params.email,
        name: params.name,
        imageUrl: params.imageUrl,
      },
    });
  },
};
