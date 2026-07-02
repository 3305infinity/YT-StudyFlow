import { Router } from 'express';

export const healthRoutes = Router();

healthRoutes.get('/', (_req, res) => {
  res.json({
    ok: true,
    service: 'yt-studyflow-backend',
    version: '0.1.0',
  });
});
