import { useQuery } from '@tanstack/react-query';
import { getOptimisationStatut, getOptimisationResult } from '../api/optimisation';
import type { OptimisationStatut, OptimisationResult } from '../api/optimisation';

export function useOptimisationPolling(tacheId: number | null) {
  const statut = useQuery<OptimisationStatut>({
    queryKey: ['optimisation-statut', tacheId],
    queryFn: () => getOptimisationStatut(tacheId!),
    enabled: tacheId !== null,
    refetchInterval: (query) => {
      if (query.state.data?.statut === 'EN_COURS') return 3000;
      return false;
    },
  });

  const result = useQuery<OptimisationResult>({
    queryKey: ['optimisation-result', tacheId],
    queryFn: () => getOptimisationResult(tacheId!),
    enabled: tacheId !== null && statut.data?.statut === 'TERMINÉE',
  });

  return {
    statut: statut.data,
    result: result.data,
    isPolling: statut.data?.statut === 'EN_COURS',
    isComplete: statut.data?.statut === 'TERMINÉE',
    isError: statut.isError || result.isError,
  };
}
