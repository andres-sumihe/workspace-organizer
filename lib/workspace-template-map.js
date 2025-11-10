const path = require('path');
const fs = require('fs-extra');

const FILE_NAME = 'workspace-templates.json';

const readStore = async (userDataRoot) => {
  const filePath = path.join(userDataRoot, FILE_NAME);
  const exists = await fs.pathExists(filePath);
  if (!exists) {
    return { workspaces: {} };
  }
  try {
    const data = await fs.readJson(filePath);
    if (!data || typeof data !== 'object' || !data.workspaces) {
      return { workspaces: {} };
    }
    return {
      workspaces: data.workspaces || {}
    };
  } catch {
    return { workspaces: {} };
  }
};

const writeStore = async (userDataRoot, store) => {
  const filePath = path.join(userDataRoot, FILE_NAME);
  await fs.mkdirp(path.dirname(filePath));
  await fs.writeJson(filePath, store, { spaces: 2 });
  return store;
};

const listWorkspaceTemplates = async (userDataRoot, workspaceRoot) => {
  const store = await readStore(userDataRoot);
  const ids = store.workspaces?.[workspaceRoot] || [];
  return ids;
};

const saveWorkspaceTemplates = async (userDataRoot, workspaceRoot, templateIds) => {
  const store = await readStore(userDataRoot);
  store.workspaces[workspaceRoot] = templateIds;
  await writeStore(userDataRoot, store);
  return templateIds;
};

module.exports = {
  listWorkspaceTemplates,
  saveWorkspaceTemplates
};
