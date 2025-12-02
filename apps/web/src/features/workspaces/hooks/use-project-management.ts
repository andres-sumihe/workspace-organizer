import { useState, useCallback, useRef, type Dispatch, type SetStateAction } from 'react';

import { fetchWorkspaceProjects, createWorkspaceProject, updateWorkspaceProject, deleteWorkspaceProject } from '@/api/workspaces';

export interface Project {
  id: string;
  name: string;
  relativePath: string;
  description?: string;
}

interface ProjectFormData {
  name: string;
  relativePath: string;
  description: string;
}

interface UseProjectManagementReturn {
  projects: Project[];
  projectsRef: { current: Project[] };
  selectedProjectId: string | null;
  setSelectedProjectId: Dispatch<SetStateAction<string | null>>;
  selectedProject: Project | undefined;
  loading: boolean;
  isLoaded: boolean;
  loadProjects: () => Promise<void>;
  createProject: (data: ProjectFormData) => Promise<void>;
  updateProject: (projectId: string, data: ProjectFormData) => Promise<void>;
  deleteProject: (projectId: string) => Promise<void>;
}

export const useProjectManagement = (
  workspaceId: string,
  options?: {
    onError?: (message: string) => void;
    onSuccess?: (message: string) => void;
    initialSelectedProjectId?: string | null;
  }
): UseProjectManagementReturn => {
  const [projects, setProjects] = useState<Project[]>([]);
  const projectsRef = useRef<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
    options?.initialSelectedProjectId ?? null
  );
  const [loading, setLoading] = useState(false);
  const projectsLoadedRef = useRef(false);
  
  // Use refs to avoid stale closures and infinite loops
  const selectedProjectIdRef = useRef(selectedProjectId);
  selectedProjectIdRef.current = selectedProjectId;
  
  const onErrorRef = useRef(options?.onError);
  onErrorRef.current = options?.onError;
  
  const onSuccessRef = useRef(options?.onSuccess);
  onSuccessRef.current = options?.onSuccess;

  // Keep projectsRef in sync
  const updateProjects = useCallback((newProjects: Project[]) => {
    setProjects(newProjects);
    projectsRef.current = newProjects;
  }, []);

  const loadProjects = useCallback(async () => {
    if (!workspaceId) return;
    setLoading(true);
    try {
      const response = await fetchWorkspaceProjects(workspaceId);
      const projectsList = response?.projects || [];
      updateProjects(projectsList);
      
      // Determine which project to select - use ref to avoid dependency on selectedProjectId
      const currentSelectedId = selectedProjectIdRef.current;
      
      if (currentSelectedId) {
        const projectExists = projectsList.some((p: Project) => p.id === currentSelectedId);
        if (!projectExists && projectsList.length > 0) {
          setSelectedProjectId(projectsList[0].id);
        } else if (!projectExists) {
          setSelectedProjectId(null);
        }
      } else if (projectsList.length > 0) {
        setSelectedProjectId(projectsList[0].id);
      }
      
      projectsLoadedRef.current = true;
    } catch (err) {
      console.error('Failed to load projects:', err);
      updateProjects([]);
      onErrorRef.current?.('Failed to load projects. The API endpoint may not be implemented yet.');
    } finally {
      setLoading(false);
    }
  }, [workspaceId, updateProjects]);

  const createProject = useCallback(async (data: ProjectFormData) => {
    if (!workspaceId) return;
    await createWorkspaceProject(workspaceId, data);
    await loadProjects();
  }, [workspaceId, loadProjects]);

  const updateProject = useCallback(async (projectId: string, data: ProjectFormData) => {
    if (!workspaceId) return;
    await updateWorkspaceProject(workspaceId, projectId, data);
    await loadProjects();
  }, [workspaceId, loadProjects]);

  const deleteProject = useCallback(async (projectId: string) => {
    if (!workspaceId) return;
    await deleteWorkspaceProject(workspaceId, projectId);
    setSelectedProjectId(null);
    await loadProjects();
    onSuccessRef.current?.('Project deleted successfully');
  }, [workspaceId, loadProjects]);

  const selectedProject = projects.find(p => p.id === selectedProjectId);

  return {
    projects,
    projectsRef,
    selectedProjectId,
    setSelectedProjectId,
    selectedProject,
    loading,
    isLoaded: projectsLoadedRef.current,
    loadProjects,
    createProject,
    updateProject,
    deleteProject
  };
};
