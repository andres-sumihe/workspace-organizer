import { Router } from 'express';

import { imageUpload, uploadImage, serveImage } from '../../controllers/uploads.controller.js';

export const uploadsRouter = Router();

// POST /api/v1/uploads/images — upload a single image
uploadsRouter.post('/images', imageUpload.single('image'), uploadImage);

// GET /api/v1/uploads/images/:filename — serve an uploaded image
uploadsRouter.get('/images/:filename', serveImage);
