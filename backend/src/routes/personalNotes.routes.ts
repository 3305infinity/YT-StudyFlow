import { Router } from 'express';
import { personalNotesController } from '../controllers/personalNotes.controller.js';
import { requireAuth, type AuthedRequest } from '../middleware/auth.js';

export const personalNotesRouter = Router();

personalNotesRouter.use(requireAuth);

personalNotesRouter.get('/', (req, res, next) => {
  personalNotesController.list(req as AuthedRequest, res).catch(next);
});
personalNotesRouter.post('/', (req, res, next) => {
  personalNotesController.create(req as AuthedRequest, res).catch(next);
});
personalNotesRouter.put('/:id', (req, res, next) => {
  personalNotesController.update(req as unknown as AuthedRequest, res).catch(next);
});
personalNotesRouter.delete('/:id', (req, res, next) => {
  personalNotesController.delete(req as unknown as AuthedRequest, res).catch(next);
});
