import { z } from 'zod';

// ============================================
// Workspace Schemas
// ============================================

export const createWorkspaceSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  rootPath: z.string().min(1, 'Root path is required'),
  description: z.string().max(1000).optional(),
});

export const updateWorkspaceSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(1000).optional(),
  settings: z
    .object({
      enforceNamingRules: z.boolean().optional(),
      namingRules: z
        .array(
          z.object({
            id: z.string(),
            label: z.string(),
            appliesTo: z.enum(['folder', 'file']),
            pattern: z.string(),
            description: z.string().optional(),
            sample: z.string().optional(),
          })
        )
        .optional(),
    })
    .optional(),
});

export const createProjectSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  relativePath: z.string().min(1, 'Relative path is required'),
  description: z.string().max(1000).optional(),
});

// ============================================
// Type Exports
// ============================================

export type CreateWorkspaceInput = z.infer<typeof createWorkspaceSchema>;
export type UpdateWorkspaceInput = z.infer<typeof updateWorkspaceSchema>;
export type CreateProjectInput = z.infer<typeof createProjectSchema>;
