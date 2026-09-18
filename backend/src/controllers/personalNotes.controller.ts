import type { Response } from 'express';
import type { AuthedRequest } from '../middleware/auth.js';
import { prisma } from '../database/prisma.js';

export const personalNotesController = {
  async list(req: AuthedRequest, res: Response): Promise<void> {
    try {
      const notes = await prisma.personalNote.findMany({
        where: { userId: req.userId },
        orderBy: { updatedAt: 'desc' },
      });
      res.json({ notes });
    } catch (err) {
      console.error('[personalNotesController] list error:', err);
      res.status(500).json({ error: 'ServerError', message: 'Failed to list personal notes.' });
    }
  },

  async create(req: AuthedRequest, res: Response): Promise<void> {
    const { title, content } = req.body as { title?: string; content?: string };
    try {
      const note = await prisma.personalNote.create({
        data: {
          userId: req.userId,
          title: title?.trim() || 'Untitled Note',
          content: content || '',
        },
      });
      res.status(201).json({ note });
    } catch (err) {
      console.error('[personalNotesController] create error:', err);
      res.status(500).json({ error: 'ServerError', message: 'Failed to create personal note.' });
    }
  },

  async update(req: AuthedRequest, res: Response): Promise<void> {
    const { id } = req.params;
    const { title, content } = req.body as { title?: string; content?: string };

    try {
      const existing = await prisma.personalNote.findFirst({
        where: { id, userId: req.userId },
      });

      if (!existing) {
        res.status(404).json({ error: 'NotFound', message: 'Personal note not found.' });
        return;
      }

      const note = await prisma.personalNote.update({
        where: { id },
        data: {
          ...(title !== undefined ? { title: title.trim() || 'Untitled Note' } : {}),
          ...(content !== undefined ? { content } : {}),
        },
      });

      res.json({ note });
    } catch (err) {
      console.error('[personalNotesController] update error:', err);
      res.status(500).json({ error: 'ServerError', message: 'Failed to update personal note.' });
    }
  },

  async delete(req: AuthedRequest, res: Response): Promise<void> {
    const { id } = req.params;
    try {
      const existing = await prisma.personalNote.findFirst({
        where: { id, userId: req.userId },
      });

      if (!existing) {
        res.status(404).json({ error: 'NotFound', message: 'Personal note not found.' });
        return;
      }

      await prisma.personalNote.delete({
        where: { id },
      });

      res.json({ success: true, id });
    } catch (err) {
      console.error('[personalNotesController] delete error:', err);
      res.status(500).json({ error: 'ServerError', message: 'Failed to delete personal note.' });
    }
  },
};
