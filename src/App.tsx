import React, { useState, useEffect } from 'react';
import { Settings } from 'lucide-react';
import { AccountProvider, useAccount } from './context/AccountContext';
import { OrderProvider, useOrders } from './context/OrderContext';
import { AdminLogin } from './components/AdminLogin';
import { ClientView } from './components/ClientView';
import { WaiterView } from './components/WaiterView';
import { AdminDashboard } from './components/AdminDashboard';
import { KitchenView } from './components/KitchenView';
import { RoleAccessModal } from './components/RoleAccessModal';
import { NotificationToast } from './components/NotificationToast';

const AppContent: React.FC = () => {
  const { currentRole, setCurrentRole, users } = useOrders();
  const { loginCocina, loginCocinaAsAdmin, loginMesero, loginMeseroAsAdmin } = useAccount();
  const [showSectionModal, setShowSectionModal] = useState(false);

  useEffect(() => {
    const openModal = () => setShowSectionModal(true);
    window.addEventListener('open_role_modal', openModal);
    return () => window.removeEventListener('open_role_modal', openModal);
  }, []);

  // Handle section selection from the modal
  const handleRoleSelected = async (role: 'admin' | 'mesero' | 'cocina', username: string, password: string) => {
    // Verificar si el usuario tiene rol admin (acceso total)
    const user = users.find(u => u.username.toLowerCase() === username.toLowerCase());
    const isAdmin = user?.roles.includes('admin') ?? false;

    // Set up authentication based on the role
    if (role === 'cocina') {
      if (isAdmin) {
        loginCocinaAsAdmin();
      } else {
        await loginCocina(username, password);
      }
    } else if (role === 'mesero') {
      if (isAdmin) {
        loginMeseroAsAdmin();
      } else {
        await loginMesero(username, password);
      }
    } else if (role === 'admin') {
      loginMeseroAsAdmin();
    }
    setCurrentRole(role);
  };

  // Render the appropriate view based on currentRole
  const renderView = () => {
    switch (currentRole) {
      case 'login':
        return <AdminLogin currentRole="login" />;
      case 'cliente':
        return <ClientView />;
      case 'mesero':
        return <WaiterView />;
      case 'admin':
        return <AdminDashboard />;
      case 'cocina':
        return <KitchenView />;
      default:
        return <AdminLogin currentRole="login" />;
    }
  };

  return (
    <div className="min-h-screen bg-brand-green-dark flex flex-col font-sans">
      {/* Navigation bar */}
      <nav id="role-navigator" className="bg-brand-green-dark/95 backdrop-blur-xl border-b border-brand-gold/15 text-brand-crema sticky top-0 z-50 px-4 py-3 shadow-2xl select-none">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl font-bold text-brand-gold">El Buen Café</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${currentRole === 'cliente' ? 'bg-brand-gold text-brand-green-dark' : 'bg-brand-green text-white hover:bg-brand-green-light'}`}
              onClick={() => setCurrentRole('cliente')}
            >
              Cliente
            </button>
            <button
              className="px-3 py-1.5 rounded-lg text-sm font-semibold transition-all bg-brand-green text-white hover:bg-brand-green-light"
              onClick={() => setShowSectionModal(true)}
              title="Acceder a secciones del sistema"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>
      </nav>

      {/* Main content */}
      <main className="flex-1">
        {renderView()}
      </main>

      {/* Role Access Modal */}
      <RoleAccessModal
        isOpen={showSectionModal}
        onClose={() => setShowSectionModal(false)}
        onRoleSelected={handleRoleSelected}
      />

      {/* Notification toast */}
      <NotificationToast />
    </div>
  );
};

export default function App() {
  return (
    <AccountProvider>
      <OrderProvider>
        <AppContent />
      </OrderProvider>
    </AccountProvider>
  );
}
