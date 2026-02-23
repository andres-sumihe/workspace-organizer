import { Router } from 'express';

import { imageUpload, uploadImage, serveImage, deleteImage } from '../../controllers/uploads.controller.js';

export const uploadsRouter = Router();

// POST /api/v1/uploads/images — upload a single image
uploadsRouter.post('/images', imageUpload.single('image'), uploadImage);

// GET /api/v1/uploads/images/:filename — serve an uploaded image
uploadsRouter.get('/images/:filename', serveImage);

// DELETE /api/v1/uploads/images/:filename — delete an uploaded image
uploadsRouter.delete('/images/:filename', deleteImage);
