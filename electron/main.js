const { app, BrowserWindow, ipcMain, dialog, clipboard, protocol, net, Menu } = require('electron');
const path = require('path');
const http = require('http');
const url = require('url');
const fs = require('fs');

// Auto-updater
const { autoUpdater } = require('electron-updater');
const electronLog = require('electron-log');

// Configure auto-updater logging
autoUpdater.logger = electronLog;
autoUpdater.logger.transports.file.level = 'info';

let expressApp = null;
let mainWindow = null;

// --- helper: command registry & menu builder ---
function buildAppMenu(win) {
  const platformIsMac = process.platform === 'darwin';

  // small command map — menu items send a simple 'menu-command' with an id
  const commands = [
    {
      label: 'Workspace',
      items: [
        {
          id: 'open-workspace-root',
          label: 'Open Workspace Root...',
          accelerator: platformIsMac ? 'Cmd+Shift+O' : 'Ctrl+Shift+O'
        },
        {
          id: 'import-template',
          label: 'Import Template ZIP...',
          accelerator: platformIsMac ? 'Cmd+I' : 'Ctrl+I'
        }
      ]
    },
    {
      label: 'View',
      items: [
        { id: 'toggle-sidebar', label: 'Toggle Sidebar', accelerator: 'F9' },
        { id: 'toggle-devtools', label: 'Toggle DevTools', accelerator: platformIsMac ? 'Alt+Cmd+I' : 'Ctrl+Shift+I' }
      ]
    },
    {
      label: 'Help',
      items: [
        { id: 'check-updates', label: 'Check for Updates' },
        { id: 'about', label: 'About' }
      ]
    }
  ];

  // build Menu template from commands
  const template = commands.map(group => {
    return {
      label: group.label,
      submenu: group.items.map(item => {
        return {
          label: item.label,
          accelerator: item.accelerator,
          click: () => {
            // send a single normalized event to renderer with id and metadata
            if (win && !win.isDestroyed()) {
              win.webContents.send('menu-command', { id: item.id });
            }
          }
        };
      })
    };
  });

  // Add standard macOS app menu on Mac to keep native behaviors
  if (platformIsMac) {
    template.unshift({
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'quit' }
      ]
    });
  }

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// Debug logging to file since console.log doesn't show in production
let logFile = null;
function log(...args) {
  const msg = `[${new Date().toISOString()}] ${args.map(a => typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a)).join(' ')}\n`;
  console.log(...args);
  try {
    if (!logFile && app.isReady()) {
      logFile = path.join(app.getPath('userData'), 'debug.log');
      // Clear old log on start
      fs.mkdirSync(path.dirname(logFile), { recursive: true });
      fs.writeFileSync(logFile, '=== App Started ===\n');
    }
    if (logFile) {
      fs.appendFileSync(logFile, msg);
    }
  } catch (e) {
    // ignore
  }
}

// Production uses port 41923 (private range) to avoid conflicts with dev servers
// Development uses port 4000 (standard dev port)
const PRODUCTION_API_PORT = 41923;
const DEVELOPMENT_API_PORT = 4000;

const getApiPort = () => {
  const isDev = !app.isPackaged || process.env.ELECTRON_DEV === 'true' || process.env.NODE_ENV === 'development';
  return isDev ? DEVELOPMENT_API_PORT : PRODUCTION_API_PORT;
};

const getApiBaseUrl = () => `http://127.0.0.1:${getApiPort()}`;

// Register custom protocol scheme before app is ready
// This must be called before app.whenReady()
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'app',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true
    }
  }
]);

// Health check for API server
function waitForApi(healthUrl, maxAttempts = 30, intervalMs = 500) {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    
    const check = () => {
      attempts++;
      console.log(`API health check attempt ${attempts}/${maxAttempts}`);
      
      const req = http.get(healthUrl, (res) => {
        if (res.statusCode === 200) {
          console.log('API server is ready');
          resolve(true);
        } else {
          retry();
        }
      });
      
      req.on('error', () => {
        retry();
      });
      
      req.setTimeout(1000, () => {
        req.destroy();
        retry();
      });
    };
    
    const retry = () => {
      if (attempts >= maxAttempts) {
        console.error('API server failed to start after', maxAttempts, 'attempts');
        resolve(false); // Don't reject, let the app show error UI
      } else {
        setTimeout(check, intervalMs);
      }
    };
    
    check();
  });
}

function startApiServer() {
  const isDev = !app.isPackaged || process.env.ELECTRON_DEV === 'true' || process.env.NODE_ENV === 'development';
  
  if (isDev) {
    log(`Dev mode: Expecting API server on port ${DEVELOPMENT_API_PORT}`);
    return Promise.resolve(true);
  }

  // In production, load the API app in-process
  log(`[API] App packaged: ${app.isPackaged}`);
  log(`[API] Loading API in-process`);
  
  // Set environment for the API
  const userDataPath = app.getPath('userData');
  log(`[API] User data path: ${userDataPath}`);
  
  process.env.NODE_ENV = 'production';
  process.env.ELECTRON_USER_DATA_PATH = userDataPath;
  
  return new Promise(async (resolve) => {
    try {
      const appPath = app.getAppPath();
      log(`[API] App path: ${appPath}`);
      
      // For native modules, we need to point to the unpacked node_modules
      const resourcesPath = path.dirname(appPath);
      const unpackedNodeModules = path.join(resourcesPath, 'app.asar.unpacked', 'node_modules');
      
      // Add unpacked node_modules to global module paths
      const Module = require('module');
      Module.globalPaths.unshift(unpackedNodeModules);
      log(`[API] Added to global module paths: ${unpackedNodeModules}`);
      
      // Verify better-sqlite3 can be loaded before proceeding
      try {
        const testSqlite = require('better-sqlite3');
        log(`[API] better-sqlite3 loaded successfully: ${typeof testSqlite}`);
      } catch (sqliteErr) {
        log(`[API] CRITICAL: Failed to load better-sqlite3: ${sqliteErr.message}`);
        log(`[API] Stack: ${sqliteErr.stack}`);
        resolve(false);
        return;
      }
      
      // Use bundled app.js which uses CJS require() for native modules
      let apiAppPath;
      if (appPath.includes('.asar')) {
        apiAppPath = path.join(resourcesPath, 'app.asar.unpacked', 'apps', 'api', 'dist', 'app.bundle.js');
      } else {
        apiAppPath = path.join(appPath, 'apps', 'api', 'dist', 'app.bundle.js');
      }
      
      log(`[API] Loading from: ${apiAppPath}`);
      
      // Check if file exists
      if (!fs.existsSync(apiAppPath)) {
        log(`[API] File not found: ${apiAppPath}`);
        // Try alternate paths
        const altPaths = [
          path.join(appPath, 'apps', 'api', 'dist', 'app.bundle.js'),
          path.join(resourcesPath, 'app.asar.unpacked', 'apps', 'api', 'dist', 'app.bundle.js'),
        ];
        log('[API] Trying alternate paths:', altPaths);
        for (const altPath of altPaths) {
          if (fs.existsSync(altPath)) {
            apiAppPath = altPath;
            log(`[API] Found at: ${altPath}`);
            break;
          }
        }
      }
      
      // Use dynamic import with file:// URL for ESM module
      const fileUrl = new URL(`file://${apiAppPath.replace(/\\/g, '/')}`);
      log(`[API] Import URL: ${fileUrl.href}`);
      
      const apiModule = await import(fileUrl.href);
      log(`[API] Module loaded, exports:`, Object.keys(apiModule));
      
      if (!apiModule.createApp) {
        throw new Error('createApp not exported from API module');
      }
      
      expressApp = await apiModule.createApp();
      log(`[API] Express app loaded successfully`);
      resolve(true);
    } catch (err) {
      log('[API] Failed to load API:', err.message);
      log('[API] Error stack:', err.stack);
      resolve(false);
    }
  });
}

// Setup custom protocol handler for app:// scheme
function setupProtocolHandler() {
  const isDev = !app.isPackaged || process.env.ELECTRON_DEV === 'true' || process.env.NODE_ENV === 'development';
  
  protocol.handle('app', async (request) => {
    try {
      const requestUrl = new URL(request.url);
      const pathname = requestUrl.pathname;
      
      // If it's an API request, handle it directly or proxy to dev server
      if (pathname.startsWith('/api/')) {
        if (isDev) {
          // In dev, proxy to the dev API server
          const apiUrl = `${getApiBaseUrl()}${pathname}${requestUrl.search}`;
          console.log(`[Protocol] Proxying to dev API: ${request.url} -> ${apiUrl}`);
          
          const fetchOptions = {
            method: request.method,
            headers: request.headers,
          };
          
          if (request.method !== 'GET' && request.method !== 'HEAD' && request.body) {
            fetchOptions.body = request.body;
            fetchOptions.duplex = 'half';
          }
          
          try {
            return await net.fetch(apiUrl, fetchOptions);
          } catch (fetchError) {
            console.error('[Protocol] Dev API fetch error:', fetchError);
            return new Response(JSON.stringify({ error: 'API request failed' }), {
              status: 502,
              headers: { 'Content-Type': 'application/json' }
            });
          }
        } else {
          // In production, call Express app directly (no network hop)
          if (!expressApp) {
            log('[Protocol] Express app not loaded');
            return new Response(JSON.stringify({ error: 'API not ready' }), {
              status: 503,
              headers: { 'Content-Type': 'application/json' }
            });
          }
          
          log(`[Protocol] Handling API request directly: ${request.method} ${pathname}`);
          
          // Create a mock request/response to call Express directly
          return new Promise(async (resolve) => {
            try {
              // Parse request body if present
              let body = null;
              if (request.method !== 'GET' && request.method !== 'HEAD' && request.body) {
                try {
                  const text = await request.text();
                  if (text) {
                    try {
                      body = JSON.parse(text);
                    } catch {
                      body = text;
                    }
                  }
                } catch (e) {
                  console.error('[Protocol] Failed to read request body:', e);
                }
              }
              
              // Create mock req object with all properties Express middleware needs
              const mockReq = {
                method: request.method,
                url: pathname + requestUrl.search,
                originalUrl: pathname + requestUrl.search,
                path: pathname,
                baseUrl: '',
                query: Object.fromEntries(requestUrl.searchParams),
                params: {},
                headers: Object.fromEntries(request.headers.entries()),
                body: body,
                ip: '127.0.0.1',
                protocol: 'app',
                secure: false,
                xhr: false,
                hostname: 'localhost',
                get: function(name) {
                  return this.headers[name.toLowerCase()];
                },
                header: function(name) {
                  return this.headers[name.toLowerCase()];
                },
                accepts: function() { return true; },
                acceptsEncodings: function() { return true; },
                acceptsCharsets: function() { return true; },
                acceptsLanguages: function() { return true; },
                is: function() { return false; },
                socket: { remoteAddress: '127.0.0.1' },
                connection: { remoteAddress: '127.0.0.1' }
              };
              
              // Create mock res object
              let responseBody = '';
              let responseStatus = 200;
              let responseHeaders = { 'Content-Type': 'application/json' };
              let headersSent = false;
              
              const mockRes = {
                statusCode: 200,
                headersSent: false,
                locals: {},
                status: function(code) {
                  responseStatus = code;
                  this.statusCode = code;
                  return this;
                },
                set: function(name, value) {
                  if (typeof name === 'object') {
                    Object.assign(responseHeaders, name);
                  } else {
                    responseHeaders[name] = value;
                  }
                  return this;
                },
                setHeader: function(name, value) {
                  responseHeaders[name] = value;
                  return this;
                },
                getHeader: function(name) {
                  return responseHeaders[name];
                },
                removeHeader: function(name) {
                  delete responseHeaders[name];
                  return this;
                },
                type: function(type) {
                  responseHeaders['Content-Type'] = type;
                  return this;
                },
                json: function(data) {
                  if (headersSent) return this;
                  headersSent = true;
                  this.headersSent = true;
                  responseHeaders['Content-Type'] = 'application/json';
                  responseBody = JSON.stringify(data);
                  log(`[Protocol] API response: ${responseStatus} ${pathname}`);
                  resolve(new Response(responseBody, {
                    status: responseStatus,
                    headers: responseHeaders
                  }));
                  return this;
                },
                send: function(data) {
                  if (headersSent) return this;
                  if (typeof data === 'object') {
                    return this.json(data);
                  }
                  headersSent = true;
                  this.headersSent = true;
                  responseBody = String(data);
                  log(`[Protocol] API response (send): ${responseStatus} ${pathname}`);
                  resolve(new Response(responseBody, {
                    status: responseStatus,
                    headers: responseHeaders
                  }));
                  return this;
                },
                end: function(data) {
                  if (headersSent) return this;
                  headersSent = true;
                  this.headersSent = true;
                  if (data) responseBody = String(data);
                  log(`[Protocol] API response (end): ${responseStatus} ${pathname}`);
                  resolve(new Response(responseBody, {
                    status: responseStatus,
                    headers: responseHeaders
                  }));
                  return this;
                },
                write: function(chunk) {
                  responseBody += String(chunk);
                  return true;
                },
                on: function() { return this; },
                once: function() { return this; },
                emit: function() { return this; }
              };
              
              // Call Express app
              expressApp(mockReq, mockRes, (err) => {
                if (err) {
                  log('[Protocol] Express error:', err.message);
                  log('[Protocol] Express error stack:', err.stack);
                  resolve(new Response(JSON.stringify({ error: err.message }), {
                    status: 500,
                    headers: { 'Content-Type': 'application/json' }
                  }));
                }
              });
              
              // Timeout after 30 seconds
              setTimeout(() => {
                log('[Protocol] Request timeout for:', pathname);
                resolve(new Response(JSON.stringify({ error: 'Request timeout' }), {
                  status: 504,
                  headers: { 'Content-Type': 'application/json' }
                }));
              }, 30000);
              
            } catch (err) {
              log('[Protocol] Error handling API request:', err.message);
              log('[Protocol] Error stack:', err.stack);
              resolve(new Response(JSON.stringify({ error: err.message }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
              }));
            }
          });
        }
      }
      
      // Otherwise, serve static files from the web dist folder
      const webDistPath = path.join(__dirname, '..', 'apps', 'web', 'dist');
      let filePath = pathname === '/' ? '/index.html' : pathname;
      
      // For SPA routing: if file doesn't have extension, serve index.html
      if (!path.extname(filePath)) {
        filePath = '/index.html';
      }
      
      const fullPath = path.join(webDistPath, filePath);
      
      // Security: Prevent directory traversal
      const normalizedPath = path.normalize(fullPath);
      if (!normalizedPath.startsWith(webDistPath)) {
        console.error('[Protocol] Attempted directory traversal:', filePath);
        return new Response('Forbidden', { status: 403 });
      }
      
      console.log(`[Protocol] Serving file: ${normalizedPath}`);
      return net.fetch(url.pathToFileURL(normalizedPath).toString());
    } catch (error) {
      console.error('[Protocol] Handler error:', error);
      return new Response('Internal Error', { status: 500 });
    }
  });
}

function createWindow() {
  const isDev = !app.isPackaged || process.env.ELECTRON_DEV === 'true' || process.env.NODE_ENV === 'development';
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false, // Don't show until ready
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Show window when ready to prevent white flash
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  const devUrl = 'http://127.0.0.1:5173';
  
  if (isDev) {
    // In development, use the Vite dev server directly
    mainWindow
      .loadURL(devUrl)
      .catch((err) => {
        console.error('Failed to load dev URL:', err);
        // Fallback to custom protocol if dev server is not available
        mainWindow.loadURL('app://bundle/');
      });
  } else {
    // In production, use the custom app:// protocol
    // This allows proper routing of both static files and API requests
    mainWindow.loadURL('app://bundle/').catch((err) => {
      console.error('Failed to load app via custom protocol:', err);
      mainWindow.show();
    });
  }

  return mainWindow;
}

app.on('ready', async () => {
  log('[App] Ready event fired');
  // Setup custom protocol handler before creating window
  setupProtocolHandler();
  log('[App] Protocol handler setup complete');

  const apiReady = await startApiServer();
  log('[App] API ready status:', apiReady);
  log('[App] expressApp is:', expressApp ? 'loaded' : 'null');
  const win = createWindow();
  buildAppMenu(win);

  // Check for updates after window is created
  if (app.isPackaged) {
    autoUpdater.checkForUpdatesAndNotify();
  }

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) {
      const win = createWindow();
      buildAppMenu(win);
    }
  });
});

app.on('window-all-closed', () => {
  // No server to close - Express app runs in-process without a listener
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Minimal IPC handlers (placeholders). Implementations will be provided by lib modules.
ipcMain.handle('restart-and-install', () => {
  autoUpdater.quitAndInstall();
});

ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});

ipcMain.handle('get-process-versions', () => {
  return {
    node: process.versions.node,
    electron: process.versions.electron,
    chrome: process.versions.chrome,
  };
});

ipcMain.handle('check-for-updates', async () => {
  console.log('[Updater] Checking for updates via API...');
  try {
    // In dev, autoUpdater might not be fully configured, but we try anyway
    const result = await autoUpdater.checkForUpdates();
    return { ok: true, result };
  } catch (err) {
    console.error('[Updater] Failed to check for updates:', err);
    return { ok: false, error: err.message };
  }
});

// Handle DevTools toggle from renderer
ipcMain.handle('toggle-devtools', () => {
  const win = BrowserWindow.getFocusedWindow();
  if (win && !win.isDestroyed()) {
    if (win.webContents.isDevToolsOpened()) {
      win.webContents.closeDevTools();
    } else {
      win.webContents.openDevTools();
    }
  }
});

// Forward specific updater events to renderer
autoUpdater.on('update-available', (info) => {
  if (mainWindow) mainWindow.webContents.send('update-available', info);
});

autoUpdater.on('update-downloaded', (info) => {
  if (mainWindow) mainWindow.webContents.send('update-downloaded', info);
});

ipcMain.handle('list-templates', async () => {
  return { items: [] };
});

ipcMain.handle('open-path', async (event, filePath) => {
  const { shell } = require('electron');
  try {
    await shell.openPath(filePath);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
});

ipcMain.handle('select-directory', async () => {
  try {
    const browserWindow = BrowserWindow.getFocusedWindow() ?? undefined;
    const result = await dialog.showOpenDialog(browserWindow, {
      properties: ['openDirectory'],
    });
    if (result.canceled || result.filePaths.length === 0) {
      return { canceled: true };
    }
    return { canceled: false, path: result.filePaths[0] };
  } catch (err) {
    return { canceled: true, error: String(err) };
  }
});

// hook up template & fs services
const templateZip = require('../lib/template-zip');
const templateEngine = require('../lib/template-engine');
const fsExecutor = require('../lib/fs-executor');
const workspaceFs = require('../lib/workspace-fs');
const templateRegistry = require('../lib/template-registry');
const workspaceTemplateMap = require('../lib/workspace-template-map');

const getUserDataRoot = () => path.join(app.getPath('userData'), 'workspace-organizer');

ipcMain.handle('import-template-zip', async (event, zipPath) => {
  return templateZip.importZipToFolder(zipPath, path.join(app.getPath('userData'), 'templates', path.basename(zipPath, '.zip')));
});

ipcMain.handle('dry-run-apply', async (event, manifestObj, rootPath, tokens) => {
  try {
    const manifest = templateEngine.parseManifest(manifestObj);
    const ops = templateEngine.generateDryRun(manifest, rootPath, tokens || {});
    return { ok: true, ops };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
});

ipcMain.handle('apply-template', async (event, manifestObj, rootPath, tokens, policy) => {
  try {
    const manifest = templateEngine.parseManifest(manifestObj);
    const ops = templateEngine.generateDryRun(manifest, rootPath, tokens || {});
    const result = await fsExecutor.applyDryRunOpsTransactional(ops, rootPath, { policy });
    return result;
  } catch (err) {
    return { ok: false, error: String(err) };
  }
});

ipcMain.handle('workspace:list-dir', async (event, payload) => {
  try {
    const result = await workspaceFs.listDirectory(payload?.rootPath, payload?.relativePath);
    return { ok: true, ...result };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
});

ipcMain.handle('workspace:read-text', async (event, payload) => {
  try {
    const result = await workspaceFs.readTextFile(payload?.rootPath, payload?.relativePath, {
      maxBytes: payload?.maxBytes,
      encoding: payload?.encoding,
    });
    return { ok: true, ...result };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
});

ipcMain.handle('workspace:read-binary', async (event, payload) => {
  try {
    const result = await workspaceFs.readBinaryFile(payload?.rootPath, payload?.relativePath);
    return { ok: true, ...result };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
});

ipcMain.handle('workspace:get-file-url', async (event, payload) => {
  try {
    const result = await workspaceFs.getFileUrl(payload?.rootPath, payload?.relativePath);
    return { ok: true, ...result };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
});

ipcMain.handle('workspace:merge-text', async (event, payload) => {
  console.log('🔍 Electron IPC received merge request with mode:', payload?.mode);
  try {
    const result = await workspaceFs.mergeTextFiles(payload?.rootPath, payload?.sources, payload?.destination, {
      separator: payload?.separator,
      includeHeaders: payload?.includeHeaders,
      overwrite: payload?.overwrite,
      encoding: payload?.encoding,
      mode: payload?.mode,
    });
    
    // Copy to clipboard if requested
    if (payload?.copyToClipboard && result.content) {
      clipboard.writeText(result.content);
    }
    
    return { ok: true, ...result };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
});

ipcMain.handle('workspace:split-text', async (event, payload) => {
  try {
    const result = await workspaceFs.splitTextFile(payload?.rootPath, payload?.source, {
      separator: payload?.separator,
      prefix: payload?.prefix,
      extension: payload?.extension,
      overwrite: payload?.overwrite,
      preserveOriginal: payload?.preserveOriginal,
      encoding: payload?.encoding,
      mode: payload?.mode,
      clipboardContent: payload?.clipboardContent,
      outputDir: payload?.outputDir,
    });
    return { ok: true, ...result };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
});

ipcMain.handle('workspace:create-dir', async (event, payload) => {
  try {
    const result = await workspaceFs.createDirectory(payload?.rootPath, payload?.relativePath);
    return { ok: true, ...result };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
});

ipcMain.handle('workspace:write-text', async (event, payload) => {
  try {
    const result = await workspaceFs.writeTextFile(payload?.rootPath, payload?.relativePath, payload?.content, {
      encoding: payload?.encoding,
    });
    return { ok: true, ...result };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
});

ipcMain.handle('workspace:rename', async (event, payload) => {
  try {
    const result = await workspaceFs.renameEntry(payload?.rootPath, payload?.oldRelativePath, payload?.newName);
    return { ok: true, ...result };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
});

ipcMain.handle('workspace:delete', async (event, payload) => {
  try {
    const result = await workspaceFs.deleteEntries(payload?.rootPath, payload?.relativePaths);
    return { ok: true, ...result };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
});

ipcMain.handle('templates:list', async () => {
  try {
    const result = await templateRegistry.listTemplates(getUserDataRoot());
    return { ok: true, templates: result.templates };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
});

ipcMain.handle('templates:create-from-folder', async (event, payload) => {
  try {
    const template = await templateRegistry.createTemplateFromFolder(getUserDataRoot(), {
      name: payload?.name,
      description: payload?.description,
      sourcePath: payload?.sourcePath
    });
    return { ok: true, template };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
});

ipcMain.handle('templates:get', async (event, payload) => {
  try {
    const manifest = await templateRegistry.getTemplateManifest(getUserDataRoot(), payload?.templateId);
    return { ok: true, manifest };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
});

ipcMain.handle('templates:save', async (event, payload) => {
  try {
    const saved = await templateRegistry.saveTemplateManifest(getUserDataRoot(), payload);
    return { ok: true, template: saved };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
});

ipcMain.handle('templates:delete', async (event, payload) => {
  try {
    await templateRegistry.deleteTemplate(getUserDataRoot(), payload?.templateId);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
});

ipcMain.handle('templates:apply-to-project', async (event, payload) => {
  try {
    const result = await templateRegistry.applyTemplateToProject(
      getUserDataRoot(),
      payload?.templateId,
      payload?.workspaceRoot,
      payload?.projectRelativePath,
      payload?.tokens || {}
    );
    return result;
  } catch (err) {
    return { ok: false, error: String(err) };
  }
});

ipcMain.handle('workspace-templates:list', async (event, payload) => {
  try {
    const workspaceRoot = payload?.workspaceRoot;
    if (!workspaceRoot) {
      throw new Error('workspaceRoot is required');
    }
    const templateIds = await workspaceTemplateMap.listWorkspaceTemplates(getUserDataRoot(), workspaceRoot);
    const allTemplates = await templateRegistry.listTemplates(getUserDataRoot());
    const templates = allTemplates.templates.filter((tpl) => templateIds.includes(tpl.id));
    return { ok: true, templateIds, templates };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
});

ipcMain.handle('workspace-templates:save', async (event, payload) => {
  try {
    const workspaceRoot = payload?.workspaceRoot;
    const templateIds = Array.isArray(payload?.templateIds) ? payload.templateIds : [];
    if (!workspaceRoot) {
      throw new Error('workspaceRoot is required');
    }
    await workspaceTemplateMap.saveWorkspaceTemplates(getUserDataRoot(), workspaceRoot, templateIds);
    const allTemplates = await templateRegistry.listTemplates(getUserDataRoot());
    const templates = allTemplates.templates.filter((tpl) => templateIds.includes(tpl.id));
    return { ok: true, templateIds, templates };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
});

// Example: main process handler for open-workspace-root
ipcMain.handle('main-action:open-workspace-root', async () => {
  const focused = BrowserWindow.getFocusedWindow();
  const res = await dialog.showOpenDialog(focused, { properties: ['openDirectory'] });
  if (res.canceled) return { canceled: true };
  return { canceled: false, path: res.filePaths[0] };
});
