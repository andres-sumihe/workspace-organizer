# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.2] 

### Added 
- Add search feature on Scripts and Driver Mappings tab
- Add day or weekly mode on Journal

### Changed
- Remove File manager from workspace page, now every project have dedicated file manager feature.
- Enhance auto update feature.

### Fixed
- Fix minor bug on projects page.
- Fix overtime calendar and validation issue.
- Fix projects query.

## [0.2.1] - 2026-01-28

### Fixed
- **Auth Context Crash**: Resolved a critical "useAuth must be used within an AuthProvider" error by moving configuration providers to the application root.
- **Settings Animation Jitter**: Fixed a UI flickering issue on the Settings page by optimizing tab transition logic and removing layout-conflicting CSS transforms.
- **Recovery Key persistence**: Fixed a regression in the authentication provider that could cause recovery keys to be invalidated after a single use.

### Changed
- **Provider Architecture**: Refactored `main.tsx` and `App.tsx` to host fundamental context providers at the root level, improving boot stability.
- **UI Transitions**: Replaced aggressive slide animations with smoother opacity-based fade-ins throughout the Settings page for a cleaner desktop feel.

## [0.2.0] - 2026-01-26

### Added
- **Notes**: Create, edit, delete and search personal notes inside a workspace. Notes sync with the local API and support title/content search.
- **Work Journal (Work Logs)**: New work journal—create daily/weekly work log entries, copy entries between dates, tag entries, and view weekly ranges.
- **Session & Lock Screen Improvements**: Idle timeout handling and a lock screen flow that allows re-authentication without losing state.
- **User-facing UI Improvements**: Added `About` dialog, update checker/notifications, and improved native menu integrations for common workflows.

### Changed
- Improvements to templates and scripts UX (clearer import messages, better error feedback).
- Search experience improved for notes and scripts.

### Fixed
- Fixed authentication header mutation that caused intermittent auth failures.
- Resolved multiple UI and TypeScript issues that could cause crashes during template application and script import.
- Various smaller bug fixes and stability improvements across work journal, notes, and team features.


## [0.1.1] - 2026-01-09

### Added
- **Logging Infrastructure**: Integrated `pino` and `pino-http` for structured logging and request monitoring.
- **Request Validation**: Added `Zod` schema validation for all API inputs (Body, Query, Params) with dedicated middleware.
- **Security Plugins**: Added `eslint-plugin-security` and `eslint-plugin-n` to enforce security best practices.
- **IPC Type Safety**: Introduced `TypedElectronAPI` for end-to-end type safety between Electron main and renderer processes.
- **Desktop UI Components**: Added `AboutDialog`, `UpdateChecker`, and `UpdateNotifier` components for better application lifecycle management.
- **Native Menu Integration**: Added `useMenuCommands` hook to handle Electron native menu actions in React.

### Changed
- **Performance**: Optimized React Query caching strategy for desktop usage (longer stale/GC times).
- **Security**: Upgraded JWT secret generation to use `crypto.randomBytes(32)`.
- **CORS**: Implemented dynamic origin validation for `app://` and `file://` protocols.
- **Styling**: Migrated theme tokens to Tailwind CSS v4 CSS-first configuration.
- **API Standards**: Enforced named exports for all routers and standardized error handling for Zod/JWT errors.

### Fixed
- **Auth Interception**: Fixed a critical bug where the request logger mutated headers, causing authentication failures.
- **Session Management**: Optimized session activity tracking and inactivity cleanup logic.
- **TypeScript**: Resolved `NodeJS.Timeout` vs `setInterval` return type mismatches.


## [0.1.0] - 2026-01-07

### Initial Release
The first beta release of **Workspace Organizer**, a desktop application designed to streamline file management, automation scripts, and team collaboration.

### ✨ Key Features

#### 🖥️ Desktop Experience
- **Electron Shell**: Native desktop application experience for Windows.
- **Local Filesystem Access**: Direct interaction with local directories and files.
- **Dual-Database Architecture**:
  - **Review**: SQLite for personal workspace data.
  - **Team**: PostgreSQL for shared scripts, users, and logs.

#### 📂 Workspace Management
- **Project Organization**: Manage local projects and folders efficiently.
- **Template System**: Apply standard folder structures to new projects.
- **File Preview**: Built-in preview for text, code, and financial message formats.

#### 🤖 Automation & scripts
- **Batch Script Catalog**: Centralized repository for team scripts.
- **Drive Conflict Detection**: Visual analysis of drive letter mapping conflicts across scripts.
- **Control-M Integration**: View job statuses, details, and basic dependency graphs.

#### 🛡️ Security & Compliance
- **RBAC (Role-Based Access Control)**: Granular permissions for Admins, Developers, and Viewers.
- **Audit Logging**: Comprehensive tracking of user actions (Login, Script edits, Permission changes).
- **Financial Validation**: Built-in validators for **ISO20022** (XML) and **SWIFT MT** formats.

### 🔧 Technical Highlights
- **Tech Stack**: React 19, TypeScript 5.9, Vite 7, Express 5.
- **Installation Wizard**: User-friendly setup for connecting to the shared team database.
- **Theming**: Dark/Light mode support with modern UI components (shadcn/ui).

### 🐛 Known Issues
- "Manage Template" sheet in workspace settings is currently incomplete.
- SWIFT MT validation rules are in initial implementation phase.
