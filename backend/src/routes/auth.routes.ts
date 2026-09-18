import { Router } from 'express';
import { authController } from '../controllers/auth.controller.js';
import { requireAuth } from '../middleware/auth.js';

export const authRoutes = Router();
export const authRouter = authRoutes;

authRoutes.post('/signup', authController.signup);
authRoutes.post('/login', authController.login);
authRoutes.get('/me', requireAuth, authController.me);
