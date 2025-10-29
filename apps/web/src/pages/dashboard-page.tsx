import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

type InitiativeStatus = 'Active' | 'Completed' | 'Planned';

interface InitiativeSummary {
  id: string;
  name: string;
  goal: string;
  status: InitiativeStatus;
  nextSteps: string[];
}

const initiatives: InitiativeSummary[] = [
  {
    id: 'initiative-1',
    name: 'Initiative 1 – Extend Shared Contracts',
    goal: 'Expand the `@workspace/shared` package so API and web stay in lockstep.',
    status: 'Active',
    nextSteps: [
      'Inventory existing DTOs in packages/shared/src/index.ts',
      'Model WorkspaceSummary and related responses ahead of API consumers',
      'Run lint + typecheck after contract updates',
    ],
  },
  {
    id: 'initiative-2',
    name: 'Initiative 2 – API Foundations',
    goal: 'Scaffold the Express service and ship GET /api/v1/workspaces with SQLite backing.',
    status: 'Completed',
    nextSteps: [
      'Keep OpenAPI slice (`docs/openapi/workspaces.yaml`) in sync',
      'Monitor migrations under apps/api/src/db for drift',
    ],
  },
  {
    id: 'initiative-3',
    name: 'Initiative 3 – Frontend Shell & Dashboard',
    goal: 'Deliver the desktop shell, dashboard cards, and hook them into the workspace API.',
    status: 'Active',
    nextSteps: [
      'Wire the dashboard to fetch WorkspaceListResponse data',
      'Introduce loading/error states that match UI standards',
      'Add refresh + toast patterns for data-driven cards',
    ],
  },
  {
    id: 'initiative-4',
    name: 'Initiative 4 – Persistence & Integrations',
    goal: 'Formalize SQLite migrations, repositories, and monitoring hooks.',
    status: 'Planned',
    nextSteps: [
      'Add migration runner and seed guidance to README',
      'Implement template/job repositories with transaction helpers',
    ],
  },
  {
    id: 'initiative-5',
    name: 'Initiative 5 – Iterative Feature Build-Out',
    goal: 'Ship workspace explorer, template management, application flow, and job monitoring.',
    status: 'Planned',
    nextSteps: [
      'Prioritize Workspace Explorer detail endpoint + UI',
      'Design template CRUD and job monitoring slices',
      'Update standards docs after each feature release',
    ],
  },
];

const statusVariant: Record<InitiativeStatus, string> = {
  Active: 'bg-amber-100 text-amber-800',
  Completed: 'bg-emerald-100 text-emerald-800',
  Planned: 'bg-slate-200 text-slate-700',
};

export const DashboardPage = () => {
  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Workspace Organizer Master Plan</CardTitle>
          <CardDescription>
            Track execution across the five initiatives that align the shared contracts, API, frontend shell, and persistence layers.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 xl:grid-cols-3">
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Current focus: extend shared contracts and complete the dashboard integration slice so the web client consumes the live workspace listing shipped by the API.
            </p>
            <p className="text-sm text-muted-foreground">
              Reference <code>docs/plan/master-plan.md</code> for full task breakdown and adjust statuses here as milestones land.
            </p>
          </div>
          <div className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">Immediate priorities</p>
            <ul className="mt-2 list-disc space-y-1 pl-4">
              <li>Finalize shared DTO coverage for workspace summaries</li>
              <li>Expose `/api/v1/workspaces` to the dashboard with loading/error states</li>
              <li>Document any new conventions in standards docs after implementation</li>
            </ul>
          </div>
          <div className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">Quality gates</p>
            <ul className="mt-2 list-disc space-y-1 pl-4">
              <li>Run <code>npm run lint</code> and <code>npm run typecheck</code> after shared contract edits</li>
              <li>Keep OpenAPI definitions synchronized with shipped endpoints</li>
              <li>Log major UX or API shifts inside the standards documents</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        {initiatives.map((initiative) => (
          <Card key={initiative.id} className="flex flex-col">
            <CardHeader className="flex flex-row items-start justify-between space-y-0">
              <div>
                <CardTitle>{initiative.name}</CardTitle>
                <CardDescription>{initiative.goal}</CardDescription>
              </div>
              <Badge className={statusVariant[initiative.status]}>{initiative.status}</Badge>
            </CardHeader>
            <CardContent>
              <p className="text-sm font-medium text-foreground">Next steps</p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                {initiative.nextSteps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};
