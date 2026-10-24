import { apiData } from '../lib/apiData';
import { useApiQuery } from './useApiQuery';
import type { Project } from '../types';
export function useProjects() {
  const query = useApiQuery('projects', apiData.projects, [] as Project[]);
  return { projects: query.data, loading: query.loading, error: query.error };
}
