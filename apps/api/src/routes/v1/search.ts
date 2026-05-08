import { Router } from 'express';

import { searchController } from '../../controllers/search.controller.js';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { asyncHandler } from '../../utils/async-handler.js';

export const searchRouter = Router();

searchRouter.use(authMiddleware);
searchRouter.get('/', asyncHandler(searchController.search));