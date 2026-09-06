import { useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useAuthStore } from '@/store/auth-store';
import { RequireRole } from '@/components/RequireRole';
import { AuthRedirect } from '@/components/AuthRedirect';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';

// Pages
import HomePage from '@/pages/HomePage';
import LoginPage from '@/pages/LoginPage';
import AdminAccessPage from '@/pages/AdminAccessPage';
import SelectFirstRolePage from '@/pages/SelectFirstRolePage';

// Dashboards
import DashboardPage from '@/pages/DashboardPage';
import AgentDashboardPage from '@/pages/AgentDashboardPage';
import StationDashboardPage from '@/pages/StationDashboardPage';
import DriverDashboardPage from '@/pages/DriverDashboardPage';
import FleetManagementPage from '@/pages/FleetManagementPage';

// Feature Pages
import FuelOrderingPage from '@/pages/FuelOrderingPage';
import FuelManagementPage from '@/pages/FuelManagementPage';
import InsurancePage from '@/pages/InsurancePage';
import LoyaltyPage from '@/pages/LoyaltyPage';
import { PaymentsPage } from '@/pages/PaymentsPage';
import ReceiptHistoryPage from '@/pages/ReceiptHistoryPage';
import AnalyticsPage from '@/pages/AnalyticsPage';
import DriverCreatePage from '@/pages/DriverCreatePage';

// Profile & Settings
import ProfileRouter from '@/components/ProfileRouter';
import ProfilePage from '@/pages/ProfilePage';
import SettingsPage from '@/pages/SettingsPage';

// QR Features
import QRScannerPage from '@/pages/QRScannerPage';
import QRScanGuide from '@/pages/QRScanGuide';

// Error Pages
import UnauthorizedPage from '@/pages/UnauthorizedPage';
import NotFoundPage from '@/pages/NotFoundPage';

function App() {
  const { checkAuth, isAuthenticated } = useAuthStore();

  // Check authentication on app load
  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  return (
    <TooltipProvider>
      <BrowserRouter>
        <Routes>
          {/* ==================== PUBLIC ROUTES ==================== */}
          
          {/* Route racine - laisse AuthRedirect décider */}
          <Route 
            path="/" 
            element={
              isAuthenticated ? <AuthRedirect /> : <HomePage />
            } 
          />

          {/* Routes publiques */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/admin-access" element={<AdminAccessPage />} />
          <Route path="/unauthorized" element={<UnauthorizedPage />} />

          {/* ==================== ROLE SELECTION ==================== */}
          
          {/* Sélection de rôle (après login, avant dashboard) */}
          <Route path="/select-role" element={<SelectFirstRolePage />} />

          {/* ==================== DASHBOARDS ==================== */}
          
          {/* Dashboard Principal - Admin, Agent, Fleet, Driver */}
          <Route
            path="/dashboard"
            element={
              <RequireRole allowedRoles={['admin', 'assur_agent', 'fleet_manager', 'driver']}>
                <DashboardPage />
              </RequireRole>
            }
          />

          {/* Dashboard Agent */}
          <Route
            path="/dashboard/agent"
            element={
              <RequireRole allowedRoles={['admin', 'assur_agent']}>
                <AgentDashboardPage />
              </RequireRole>
            }
          />

          {/* Dashboard Station */}
          <Route
            path="/dashboard/station"
            element={
              <RequireRole allowedRoles={['admin', 'station_operator']}>
                <StationDashboardPage />
              </RequireRole>
            }
          />

          {/* Dashboard Chauffeur */}
          <Route
            path="/dashboard/driver"
            element={
              <RequireRole allowedRoles={['admin', 'driver']}>
                <DriverDashboardPage />
              </RequireRole>
            }
          />

          {/* Dashboard/Page Gestionnaire (Fleet Management) */}
          <Route
            path="/fleet/dashboard"
            element={
              <RequireRole allowedRoles={['admin', 'fleet_manager']}>
                <FleetManagementPage />
              </RequireRole>
            }
          />

          {/* Alias /fleet pour compatibilité */}
          <Route
            path="/fleet"
            element={
              <RequireRole allowedRoles={['admin', 'fleet_manager']}>
                <FleetManagementPage />
              </RequireRole>
            }
          />

          {/* ==================== FUEL FEATURES ==================== */}

          {/* Fuel Ordering - Accessible aux gestionnaires et chauffeurs */}
          <Route
            path="/fuel"
            element={
              <RequireRole allowedRoles={['admin', 'fleet_manager', 'driver']}>
                <FuelOrderingPage />
              </RequireRole>
            }
          />

          {/* Fuel Management - Admin et Agent */}
          <Route
            path="/fuel-management"
            element={
              <RequireRole allowedRoles={['admin', 'assur_agent']}>
                <FuelManagementPage />
              </RequireRole>
            }
          />

          {/* ==================== DRIVER MANAGEMENT ==================== */}

          {/* Create Driver - Admin, Agent, Fleet Manager */}
          <Route
            path="/drivers/new"
            element={
              <RequireRole allowedRoles={['admin', 'assur_agent', 'fleet_manager']}>
                <DriverCreatePage />
              </RequireRole>
            }
          />

          {/* ==================== OTHER FEATURES ==================== */}

          {/* Insurance - Accessible à tous sauf station */}
          <Route
            path="/insurance"
            element={
              <RequireRole allowedRoles={['admin', 'assur_agent', 'fleet_manager', 'driver']}>
                <InsurancePage />
              </RequireRole>
            }
          />

          {/* Loyalty - Gestionnaires et Chauffeurs */}
          <Route
            path="/loyalty"
            element={
              <RequireRole allowedRoles={['admin', 'fleet_manager', 'driver']}>
                <LoyaltyPage />
              </RequireRole>
            }
          />

          {/* Payments - Tous sauf station */}
          <Route
            path="/payments"
            element={
              <RequireRole allowedRoles={['admin', 'assur_agent', 'fleet_manager', 'driver']}>
                <PaymentsPage />
              </RequireRole>
            }
          />

          {/* Receipt History - Tous sauf station */}
          <Route
            path="/receipts"
            element={
              <RequireRole allowedRoles={['admin', 'assur_agent', 'fleet_manager', 'driver']}>
                <ReceiptHistoryPage />
              </RequireRole>
            }
          />

          {/* Analytics - Admin only */}
          <Route
            path="/analytics"
            element={
              <RequireRole allowedRoles={['admin']}>
                <AnalyticsPage />
              </RequireRole>
            }
          />

          {/* ==================== PROFILE & SETTINGS ==================== */}

          {/* Profile - Tous les rôles */}
          <Route
            path="/profile"
            element={
              <RequireRole allowedRoles={['admin', 'assur_agent', 'fleet_manager', 'station_operator', 'driver']}>
                <ProfileRouter />
              </RequireRole>
            }
          />

          {/* View Other User Profile - Admin only */}
          <Route
            path="/profile/:userId"
            element={
              <RequireRole allowedRoles={['admin']}>
                <ProfilePage />
              </RequireRole>
            }
          />

          {/* Settings - Admin only */}
          <Route
            path="/settings"
            element={
              <RequireRole allowedRoles={['admin']}>
                <SettingsPage />
              </RequireRole>
            }
          />

          {/* ==================== QR FEATURES ==================== */}

          {/* QR Scanner - Station operators */}
          <Route
            path="/qr-scanner"
            element={
              <RequireRole allowedRoles={['admin', 'station_operator']}>
                <QRScannerPage />
              </RequireRole>
            }
          />

          {/* QR Guide - Station operators */}
          <Route
            path="/qr-guide"
            element={
              <RequireRole allowedRoles={['admin', 'station_operator']}>
                <QRScanGuide />
              </RequireRole>
            }
          />

          {/* ==================== ERROR PAGES ==================== */}

          {/* 404 */}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </BrowserRouter>
      <Toaster />
    </TooltipProvider>
  );
}

export default App;
