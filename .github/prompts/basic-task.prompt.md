During development, use the following tags to access helpers:
- #console-ninja/*  — for checking errors
- #context7/*       — for full tech-stack context
- #fetch            — for finding best practices on the internet

Tools/command you can use :
- typecheck:shared `tsc --project packages/shared/tsconfig.json`,
- typecheck:api `tsc --project apps/api/tsconfig.json`,
- typecheck:web `tsc --project apps/web/tsconfig.json`,
- Other command available in `package.json` scripts.
- Run the `task` to run background tasks like `npm: dev` 


REMEMBER THIS!! Always check background task `npm: dev` to see the app running or not instead of running `npm run dev:web` manually.

NOTE: DO NOT HALLUCINATE — DO NOT ADD UNNECESSARY THINGS