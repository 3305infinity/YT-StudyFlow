import type { Request, Response } from 'express';
import { prisma } from '../database/prisma.js';
import { hashPassword, verifyPassword, createAuthToken } from '../lib/authUtils.js';
import type { AuthedRequest } from '../middleware/auth.js';

export const authController = {
  async signup(req: Request, res: Response): Promise<void> {
    const { name, email, password, confirmPassword } = req.body as {
      name?: string;
      email?: string;
      password?: string;
      confirmPassword?: string;
    };

    if (!email || !password) {
      res.status(400).json({ error: 'ValidationError', message: 'Email and password are required.' });
      return;
    }

    if (confirmPassword && password !== confirmPassword) {
      res.status(400).json({ error: 'ValidationError', message: 'Passwords do not match.' });
      return;
    }

    if (password.length < 6) {
      res.status(400).json({ error: 'ValidationError', message: 'Password must be at least 6 characters long.' });
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();

    try {
      const existing = await prisma.user.findFirst({
        where: { email: normalizedEmail },
      });

      if (existing) {
        res.status(400).json({ error: 'DuplicateEmail', message: 'An account with this email already exists.' });
        return;
      }

      const passwordHash = hashPassword(password);
      const user = await prisma.user.create({
        data: {
          email: normalizedEmail,
          name: name?.trim() || normalizedEmail.split('@')[0],
          passwordHash,
        },
      });

      const token = createAuthToken({
        userId: user.id,
        email: user.email!,
        name: user.name || undefined,
      });

      res.status(201).json({
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          imageUrl: user.imageUrl,
        },
      });
    } catch (err) {
      console.error('[authController] Signup error:', err);
      res.status(500).json({ error: 'ServerError', message: 'Failed to create account.' });
    }
  },

  async login(req: Request, res: Response): Promise<void> {
    const { email, password } = req.body as { email?: string; password?: string };

    if (!email || !password) {
      res.status(400).json({ error: 'ValidationError', message: 'Email and password are required.' });
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();

    try {
      const user = await prisma.user.findFirst({
        where: { email: normalizedEmail },
      });

      if (!user || !user.passwordHash || !verifyPassword(password, user.passwordHash)) {
        res.status(401).json({ error: 'InvalidCredentials', message: 'Invalid email or password.' });
        return;
      }

      const token = createAuthToken({
        userId: user.id,
        email: user.email!,
        name: user.name || undefined,
      });

      res.json({
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          imageUrl: user.imageUrl,
        },
      });
    } catch (err) {
      console.error('[authController] Login error:', err);
      res.status(500).json({ error: 'ServerError', message: 'Failed to log in.' });
    }
  },

  async me(req: AuthedRequest, res: Response): Promise<void> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: req.userId },
      });

      if (!user) {
        res.json({
          user: {
            id: req.userId,
            email: req.userEmail || 'guest@local.dev',
            name: req.userName || 'Guest',
          },
        });
        return;
      }

      res.json({
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          imageUrl: user.imageUrl,
        },
      });
    } catch (err) {
      console.error('[authController] Profile error:', err);
      res.status(500).json({ error: 'ServerError', message: 'Failed to fetch user profile.' });
    }
  },
};
