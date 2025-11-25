# Build Assets

This directory contains icon assets for the desktop application builds.

## Required Icons

### Windows
- `icon.ico` - Multi-resolution icon file (256x256, 128x128, 64x64, 48x48, 32x32, 24x24, 16x16)

### macOS
- `icon.icns` - macOS icon set (1024x1024, 512x512, 256x256, 128x128, 64x64, 32x32, 16x16)

### Linux
- `icon.png` - PNG icon (512x512 or 1024x1024 recommended)

## Generating Icons

You can use online tools or CLI utilities to generate platform-specific icons from a master PNG:

- **electron-icon-builder**: `npm install -g electron-icon-builder`
  ```bash
  electron-icon-builder --input=./master-icon.png --output=./build-assets --flatten
  ```

- **Online**: [Icon Generator](https://www.electronjs.org/docs/latest/tutorial/application-distribution#packaging-your-app-into-a-file)

## Current Status

⚠️ **Placeholder icons needed** - Add your application icons here before building for distribution.
