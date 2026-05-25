import { useQuery } from '@tanstack/react-query';
import { getOptimisationStatut, getOptimisationResult } from '../api/optimisation';
import type { OptimisationStatut, OptimisationResult } from '../api/optimisation';

export function useOptimisationPolling(tacheId: number | null) {
  const statut = useQuery<OptimisationStatut>({
    queryKey: ['optimisation-statut', tacheId],
    queryFn: () => getOptimisationStatut(tacheId!),
    enabled: tacheId !== null,
    refetchInterval: (query) => {
      const status = query.state.data?.statut;
      if (status === 'EN_ATTENTE' || status === 'EN_COURS') return 3000;
      return false;
    },
  });

  const result = useQuery<OptimisationResult>({
    queryKey: ['optimisation-result', tacheId],
    queryFn: () => getOptimisationResult(tacheId!),
    enabled: tacheId !== null && (statut.data?.statut === 'TERMINEE' || statut.data?.statut === 'ERREUR'),
  });

  return {
    statut: statut.data,
    result: result.data,
    isPolling: statut.data?.statut === 'EN_ATTENTE' || statut.data?.statut === 'EN_COURS',
    isComplete: statut.data?.statut === 'TERMINEE',
    isError: statut.data?.statut === 'ERREUR' || statut.isError || result.isError,
  };
}
