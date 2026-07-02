import { Router } from 'express';
import { authController } from '../controllers/auth.controller.js';
import type { AuthedRequest } from '../middleware/auth.js';

export const authRoutes = Router();

authRoutes.get('/me', (req, res, next) => {
  authController.me(req as AuthedRequest, res).catch(next);
});

authRoutes.get('/usage', (req, res, next) => {
  authController.usage(req as AuthedRequest, res).catch(next);
});
