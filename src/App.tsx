import React, { useState, useEffect } from 'react';
import { Settings, User, MoreVertical } from 'lucide-react';
import { AccountProvider, useAccount } from './context/AccountContext';
import { OrderProvider, useOrders } from './context/OrderContext';
import { AdminLogin } from './components/AdminLogin';
import { ClientView } from './components/ClientView';
import { WaiterView } from './components/WaiterView';
import { AdminDashboard } from './components/AdminDashboard';
import { KitchenView } from './components/KitchenView';
import { RoleAccessModal } from './components/RoleAccessModal';
import { NotificationToast } from './components/NotificationToast';
import { SplashScreen } from './components/SplashScreen';
import { supabase } from './db/supabaseClient';

const AppContent: React.FC = () => {
  const { currentRole, setCurrentRole } = useOrders();
  const { loginCocina, loginCocinaAsAdmin, loginMesero, loginMeseroAsAdmin, mesaSeleccionada, meseroLogueado } = useAccount();
  const [showSectionModal, setShowSectionModal] = useState(false);
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setShowSplash(false), 3000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const openModal = () => setShowSectionModal(true);
    window.addEventListener('open_role_modal', openModal);
    return () => window.removeEventListener('open_role_modal', openModal);
  }, []);

  // Handle section selection from the modal
  const handleRoleSelected = async (role: 'admin' | 'mesero' | 'cocina', username: string, password: string) => {
    // Migración N2-subfase2: isAdmin se deriva de la sesión Supabase Auth
    // (profiles.roles), no del RPC verificar_credenciales. El modal ya
    // autenticó vía signInWithPassword; aquí solo se lee la sesión activa.
    // No se consulta la lista `users` en memoria (sin dependencia de timing).
    let isAdmin = false;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        isAdmin = false;
      } else {
        const { data: profile } = await supabase.from('profiles').select('roles').eq('id', session.user.id).single();
        const rolesStr: string = (profile as any)?.roles ?? '';
        isAdmin = rolesStr.split(',').map(r => r.trim()).includes('admin');
      }
    } catch {
      // Fallo de red posterior a un login ya validado por el modal:
      // degradar a ruta no-admin; loginMesero/loginCocina revalidan de todos
      // modos (mismo comportamiento que la carga fría anterior).
      isAdmin = false;
    }

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

  const isCocina = currentRole === 'cocina';

  return (
    <>
      <SplashScreen isVisible={showSplash} />
      <div className="min-h-screen bg-brand-green-dark flex flex-col font-sans">
      {/* Navigation bar — oculta estructuralmente en COCINA para recuperar espacio vertical.
          KitchenView ya provee su propio header compacto (COCINA / Pendientes / Listos / Salir),
          evitando duplicación de barras y dejando una sola capa superior. */}
      {isCocina ? null : (
      <nav id="role-navigator" className="bg-brand-green-dark/95 backdrop-blur-xl border-b border-brand-gold/15 text-brand-crema sticky top-0 z-50 px-4 py-3 shadow-2xl select-none">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xl font-bold text-brand-gold whitespace-nowrap">El Buen Café</span>
            {currentRole === 'mesero' && mesaSeleccionada && (
              <>
                <span className="w-px h-5 bg-brand-gold/25 shrink-0 hidden md:block" aria-hidden="true" />
                <span className="text-sm font-semibold text-brand-crema/90 truncate hidden md:inline">
                  Mesa {mesaSeleccionada.numero} · {mesaSeleccionada.ubicacion}
                </span>
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            {/* Píldora mesero+⋮ — solo rol mesero con mesa y solo desktop. No tiene lógica:
                dispara 'toggle_mesa_menu', que WaiterView escucha para abrir su menú existente.
                Misma altura que Cliente/⚙ para no alterar el layout. */}
            {currentRole === 'mesero' && mesaSeleccionada && meseroLogueado && (
              <button
                onClick={() => window.dispatchEvent(new Event('toggle_mesa_menu'))}
                className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-semibold transition-all bg-brand-green text-white hover:bg-brand-green-light"
                title="Opciones de mesa"
              >
                <User className="w-4 h-4 shrink-0" />
                <span className="max-w-[100px] truncate">{meseroLogueado.nombre}</span>
                <MoreVertical className="w-4 h-4 shrink-0" />
              </button>
            )}
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
      )}

      {/* Main content — en cocina usa fondo KDS para evitar franja verde por el calc(100vh-4rem) interno de KitchenView */}
      <main className={`flex-1 ${isCocina ? 'bg-[#f4f4f0]' : ''}`}>
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
    </>
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
