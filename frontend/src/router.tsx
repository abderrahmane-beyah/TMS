import { createBrowserRouter, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Commandes from './pages/Commandes';
import NouvelleCommande from './pages/NouvelleCommande';
import CommandeDetail from './pages/CommandeDetail';
import Tournees from './pages/Tournees';
import TourneeDetail from './pages/TourneeDetail';
import Optimisation from './pages/Optimisation';
import Flotte from './pages/Flotte';
import Kpis from './pages/Kpis';
import Anomalies from './pages/Anomalies';
import Admin from './pages/Admin';
import ChauffeurDashboard from './pages/ChauffeurDashboard';
import ChauffeurTournee from './pages/ChauffeurTournee';
import NotFound from './pages/NotFound';

export const router = createBrowserRouter([
  { path: '/login', element: <Login /> },
  {
    path: '/',
    element: (
      <ProtectedRoute>
        <Layout />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      {
        path: 'dashboard',
        element: (
          <ProtectedRoute allowedRoles={['Dispatcheur', 'Administrateur']}>
            <Dashboard />
          </ProtectedRoute>
        ),
      },
      {
        path: 'commandes',
        element: (
          <ProtectedRoute allowedRoles={['Dispatcheur', 'Expéditeur', 'Administrateur']}>
            <Commandes />
          </ProtectedRoute>
        ),
      },
      {
        path: 'commandes/nouvelle',
        element: (
          <ProtectedRoute allowedRoles={['Expéditeur', 'Administrateur']}>
            <NouvelleCommande />
          </ProtectedRoute>
        ),
      },
      {
        path: 'commandes/:id',
        element: (
          <ProtectedRoute>
            <CommandeDetail />
          </ProtectedRoute>
        ),
      },
      {
        path: 'tournees',
        element: (
          <ProtectedRoute allowedRoles={['Dispatcheur', 'Administrateur']}>
            <Tournees />
          </ProtectedRoute>
        ),
      },
      {
        path: 'tournees/:id',
        element: (
          <ProtectedRoute allowedRoles={['Dispatcheur', 'Administrateur']}>
            <TourneeDetail />
          </ProtectedRoute>
        ),
      },
      {
        path: 'optimisation',
        element: (
          <ProtectedRoute allowedRoles={['Dispatcheur', 'Administrateur']}>
            <Optimisation />
          </ProtectedRoute>
        ),
      },
      {
        path: 'flotte',
        element: (
          <ProtectedRoute allowedRoles={['Administrateur']}>
            <Flotte />
          </ProtectedRoute>
        ),
      },
      {
        path: 'kpis',
        element: (
          <ProtectedRoute allowedRoles={['Dispatcheur', 'Administrateur']}>
            <Kpis />
          </ProtectedRoute>
        ),
      },
      {
        path: 'anomalies',
        element: (
          <ProtectedRoute allowedRoles={['Dispatcheur', 'Administrateur']}>
            <Anomalies />
          </ProtectedRoute>
        ),
      },
      {
        path: 'admin',
        element: (
          <ProtectedRoute allowedRoles={['Administrateur']}>
            <Admin />
          </ProtectedRoute>
        ),
      },
      {
        path: 'chauffeur',
        element: (
          <ProtectedRoute allowedRoles={['Chauffeur']}>
            <ChauffeurDashboard />
          </ProtectedRoute>
        ),
      },
      {
        path: 'chauffeur/tournee',
        element: (
          <ProtectedRoute allowedRoles={['Chauffeur']}>
            <ChauffeurTournee />
          </ProtectedRoute>
        ),
      },
      { path: '*', element: <NotFound /> },
    ],
  },
]);
