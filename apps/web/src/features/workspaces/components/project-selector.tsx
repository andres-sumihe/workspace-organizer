import { Edit2, Plus, RefreshCw } from 'lucide-react';
import { memo } from 'react';

import type { Project } from '../hooks/use-project-management';

import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface ProjectSelectorProps {
  projects: Project[];
  selectedProjectId: string | null;
  onSelectProject: (id: string) => void;
  onCreateProject: () => void;
  onEditProject: () => void;
  onRefresh: () => void;
  refreshDisabled?: boolean;
}

const ProjectSelectorComponent = ({
  projects,
  selectedProjectId,
  onSelectProject,
  onCreateProject,
  onEditProject,
  onRefresh,
  refreshDisabled
}: ProjectSelectorProps) => (
  <div className="flex items-center gap-3">
    <Select value={selectedProjectId || undefined} onValueChange={onSelectProject}>
      <SelectTrigger className="h-10 w-60">
        <SelectValue placeholder="Select a project...">
          {selectedProjectId ? projects.find(p => p.id === selectedProjectId)?.name : 'Select a project...'}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {projects?.length > 0 ? (
          projects.map((project) => (
            <SelectItem key={project.id} value={project.id}>
              {project.name}
            </SelectItem>
          ))
        ) : null}
      </SelectContent>
    </Select>
    
    <div className="flex items-center gap-2 rounded-md border border-border/40 p-1">
      <Button 
        onClick={onCreateProject} 
        variant="ghost" 
        size="sm"
        className="h-8 gap-2 px-3"
      >
        <Plus className="size-4" />
        <span>New Project</span>
      </Button>
      <Button 
        onClick={onEditProject} 
        disabled={!selectedProjectId} 
        variant="ghost" 
        size="sm"
        className="h-8 gap-2 px-3"
      >
        <Edit2 className="size-4" />
        <span>Edit</span>
      </Button>
      <Button
        onClick={onRefresh}
        disabled={refreshDisabled}
        variant="ghost"
        size="sm"
        className="h-8 gap-2 px-3"
      >
        <RefreshCw className="size-4" />
        <span>Refresh</span>
      </Button>
    </div>
  </div>
);

export const ProjectSelector = memo(ProjectSelectorComponent);
