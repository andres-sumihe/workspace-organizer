import { parsePaginationQuery } from '../schemas/pagination.js';
import { getWorkspaceList } from '../services/workspaces.service.js';

import type { RequestHandler } from 'express';

export const listWorkspacesHandler: RequestHandler = async (req, res) => {
  const pagination = parsePaginationQuery(req.query);

  const response = await getWorkspaceList({
    page: pagination.page,
    pageSize: pagination.pageSize
  });

  res.json(response);
};
