# Versioning Policy

## Semantic Versioning
This project adheres to [Semantic Versioning 2.0.0](https://semver.org/spec/v2.0.0.html).

**Format**: `MAJOR.MINOR.PATCH`

- **MAJOR** version when you make incompatible API changes.
- **MINOR** version when you add functionality in a backward compatible manner.
- **PATCH** version when you make backward compatible bug fixes.

## Versioning Strategy

### 1. Release Cycle
- **Alpha/Beta**: `0.x.x` - Rapid development, potential breaking changes without major version bump.
- **Stable**: `1.0.0` - First stable release with guaranteed API compatibility.

### 2. Auto-Update Compatibility
- The auto-updater checks the `publish` configuration in `package.json`.
- Electron updates should be strictly **backward compatible** with the local data (`apps/api/src/db/migrations`).
- Database migrations MUST be additive to prevent data loss on existing clients.

### 3. Branching Model
- `main`: Always contains the latest stable deployable version.
- `develop`: Integration branch for features.
- `feature/*`: Specific feature implementations.
- `release/*`: Preparation for a new production release (version bump, changelog update).

## Component Versioning
Since this is a monorepo, versioning is unified in the root `package.json`. All workspace packages (`apps/api`, `apps/web`) share the same version number to ensure compatibility during the build and release process.
