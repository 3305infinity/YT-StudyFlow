import { Router } from 'express';
import { personalNotesController } from '../controllers/personalNotes.controller.js';
import { requireAuth } from '../middleware/auth.js';

export const personalNotesRouter = Router();

personalNotesRouter.use(requireAuth);

personalNotesRouter.get('/', personalNotesController.list);
personalNotesRouter.post('/', personalNotesController.create);
personalNotesRouter.put('/:id', personalNotesController.update);
personalNotesRouter.delete('/:id', personalNotesController.delete);
