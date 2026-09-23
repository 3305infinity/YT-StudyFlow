import { Router } from 'express';
import { authController } from '../controllers/auth.controller.js';
import { requireAuth, type AuthedRequest } from '../middleware/auth.js';

export const authRoutes = Router();
export const authRouter = authRoutes;

authRoutes.post('/signup', authController.signup);
authRoutes.post('/login', authController.login);
authRoutes.get('/me', requireAuth, (req, res, next) => {
  authController.me(req as AuthedRequest, res).catch(next);
});
