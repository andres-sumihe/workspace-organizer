import { promises as fs } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

import multer from 'multer';

import type { Request, Response, NextFunction } from 'express';

// ---------------------------------------------------------------------------
// Upload directory resolution (mirrors db/client.ts data directory logic)
// ---------------------------------------------------------------------------

const getUploadsDir = (): string => {
  if (process.env.ELECTRON_USER_DATA_PATH) {
    return path.join(process.env.ELECTRON_USER_DATA_PATH, 'uploads');
  }
  return path.resolve(import.meta.dirname ?? __dirname, '../../data/uploads');
};

const ensureUploadsDir = async () => {
  const dir = getUploadsDir();
  await fs.mkdir(dir, { recursive: true });
  return dir;
};

// ---------------------------------------------------------------------------
// Allowed MIME types
// ---------------------------------------------------------------------------

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
]);

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

// ---------------------------------------------------------------------------
// Multer configuration
// ---------------------------------------------------------------------------

const storage = multer.diskStorage({
  destination: async (_req, _file, cb) => {
    try {
      const dir = await ensureUploadsDir();
      cb(null, dir);
    } catch (err) {
      cb(err as Error, '');
    }
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    // Use a UUID to prevent filename collisions and path-traversal attacks
    cb(null, `${randomUUID()}${ext}`);
  },
});

export const imageUpload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME_TYPES.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only image files (JPEG, PNG, GIF, WebP, SVG) are allowed'));
    }
  },
});

// ---------------------------------------------------------------------------
// Controllers
// ---------------------------------------------------------------------------

/**
 * POST /api/v1/uploads/images
 * Accepts a single image via multipart field "image".
 */
export const uploadImage = (req: Request, res: Response, _next: NextFunction) => {
  if (!req.file) {
    res.status(400).json({
      code: 'VALIDATION_ERROR',
      message: 'No image file provided. Use form field "image".',
    });
    return;
  }

  const filename = req.file.filename;
  const url = `/api/v1/uploads/images/${filename}`;

  res.status(201).json({
    data: { url, filename },
  });
};

/**
 * GET /api/v1/uploads/images/:filename
 * Serves an uploaded image from disk.
 */
export const serveImage = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const filename = req.params.filename as string | undefined;

    // Sanitise: only allow simple filenames (UUID + ext)
    if (!filename || !/^[\da-f-]+\.\w+$/i.test(filename)) {
      res.status(400).json({ code: 'VALIDATION_ERROR', message: 'Invalid filename' });
      return;
    }

    const filePath = path.join(getUploadsDir(), filename);

    // Check existence before sending
    try {
      await fs.access(filePath);
    } catch {
      res.status(404).json({ code: 'NOT_FOUND', message: 'Image not found' });
      return;
    }

    res.sendFile(filePath);
  } catch (error) {
    next(error);
  }
};

// ---------------------------------------------------------------------------
// Image cleanup helpers
// ---------------------------------------------------------------------------

/**
 * Extract uploaded image filenames from a Tiptap JSON content string.
 * Returns filenames (e.g. "abc-123.png") found in image node `src` attributes
 * that point to our upload endpoint.
 */
export function extractImageFilenames(contentJson: string): string[] {
  const filenames: string[] = [];
  try {
    const doc = JSON.parse(contentJson);
    const walk = (node: Record<string, unknown>) => {
      if (node.type === 'image') {
        const src = (node.attrs as Record<string, unknown> | undefined)?.src as string | undefined;
        if (src) {
          const match = src.match(/\/api\/v1\/uploads\/images\/([\da-f-]+\.\w+)$/i);
          if (match) filenames.push(match[1]);
        }
      }
      const content = node.content as Record<string, unknown>[] | undefined;
      content?.forEach(walk);
    };
    walk(doc);
  } catch {
    // Not valid JSON or unexpected structure — ignore
  }
  return filenames;
}

/**
 * Delete uploaded images by filename. Silently ignores files that don't exist.
 */
export async function deleteUploadedImages(filenames: string[]): Promise<void> {
  const dir = getUploadsDir();
  await Promise.all(
    filenames.map(async (filename) => {
      // Re-validate filename pattern to avoid any path traversal
      if (!/^[\da-f-]+\.\w+$/i.test(filename)) return;
      try {
        await fs.unlink(path.join(dir, filename));
      } catch {
        // File already gone or inaccessible — ignore
      }
    }),
  );
}
