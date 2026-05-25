import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function RootRedirect() {
  const { role } = useAuth();

  if (role === 'Chauffeur') {
    return <Navigate to="/chauffeur" replace />;
  }

  if (role === 'Expediteur') {
    return <Navigate to="/commandes" replace />;
  }

  return <Navigate to="/dashboard" replace />;
}
