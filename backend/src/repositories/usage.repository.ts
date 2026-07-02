import { prisma } from '../database/prisma.js';

export const usageRepository = {
  async record(userId: string, action: string): Promise<void> {
    if (!process.env.DATABASE_URL) return;
    try {
      await prisma.usageLog.create({ data: { userId, action } });
    } catch {
      // DB optional during early migration
    }
  },

  async countToday(userId: string): Promise<number> {
    if (!process.env.DATABASE_URL) return 0;
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    try {
      return prisma.usageLog.count({
        where: { userId, createdAt: { gte: start } },
      });
    } catch {
      return 0;
    }
  },
};
