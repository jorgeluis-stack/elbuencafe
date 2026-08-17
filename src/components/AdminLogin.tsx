import React, { useState, useEffect } from 'react';
import { useOrders } from '../context/OrderContext';
import { useAccount } from '../context/AccountContext';
import { User, Lock, Eye, EyeOff, LogIn, UserPlus, Trash2, Save, ChefHat, Users, Shield } from 'lucide-react';
import { motion } from 'motion/react';

interface UserCredentials {
    username: string;
    password: string;
    roles: string; // Roles separados por coma: "admin,mesero,cocina,repartidor"
}

export const AdminLogin: React.FC<{ currentRole: 'admin' | 'mesero' | 'cocina' | 'cliente' | 'login' }> = ({ currentRole }) => {
    const { setCurrentRole, addNotification, users, saveUser, deleteUser, updateAdminCredentials } = useOrders();
    const { loginCocina, loginCocinaAsAdmin, loginMesero, loginMeseroAsAdmin } = useAccount();
    const [username, setUsername] = useState('admin');
    const [password, setPassword] = useState('admin');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [showUserManager, setShowUserManager] = useState(false);
    const [newUsername, setNewUsername] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [newRoles, setNewRoles] = useState<string[]>(['mesero']);
    const [showRoleSelector, setShowRoleSelector] = useState(false);
    const [loggedUser, setLoggedUser] = useState<UserCredentials | null>(null);

    // Solo admin puede gestionar usuarios
    const canManageUsers = currentRole === 'admin' || (loggedUser?.roles?.includes('admin') ?? false);

    // Load saved credentials from localStorage
    useEffect(() => {
        try {
            const savedUsers = localStorage.getItem('elbuencafe_users');
            if (savedUsers) {
                const parsed = JSON.parse(savedUsers);
                // Normalizar: compatibilidad con formato antiguo (role) y nuevo (roles)
                const users: UserCredentials[] = parsed.map((u: any) => ({
                    username: u.username,
                    password: u.password,
                    roles: u.roles || u.role || 'mesero'
                }));
                // Check if admin user exists
                const adminUser = users.find(u => u.roles.includes('admin'));
                if (adminUser) {
                    setUsername(adminUser.username);
                    setPassword(adminUser.password);
                }
            }
        } catch (err) {
            console.error('Error al cargar credenciales guardadas:', err);
        }
    }, []);

    const handleLogin = (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        // Usar los usuarios del contexto (cargados desde Supabase o localStorage)
        setTimeout(async () => {
            // 1. Buscar primero en el contexto (Supabase)
            let userFound = users.find(
                u => u.username.toLowerCase() === username.toLowerCase() && u.password === password
            );

            // 2. Si no se encontró en el contexto, buscar en localStorage
            if (!userFound) {
                try {
                    const savedUsers = localStorage.getItem('elbuencafe_users');
                    if (savedUsers) {
                        const parsed = JSON.parse(savedUsers);
                        const localUsers = parsed.map((u: any) => ({
                            username: u.username,
                            password: u.password,
                            roles: u.roles || u.role || 'mesero'
                        }));
                        userFound = localUsers.find(
                            u => u.username.toLowerCase() === username.toLowerCase() && u.password === password
                        );
                    }
                } catch (err) {
                    console.error('Error al leer usuarios de localStorage:', err);
                }
            }

            // 3. Si no se encontró y es admin/admin, crearlo automáticamente en Supabase + localStorage
            if (!userFound && username.toLowerCase() === 'admin' && password === 'admin') {
                try {
                    await saveUser({ username: 'admin', password: 'admin', roles: 'admin' });
                    userFound = { username: 'admin', password: 'admin', roles: 'admin' };
                } catch (err) {
                    console.error('Error al crear admin default:', err);
                    // Fallback: crear solo en localStorage
                    userFound = { username: 'admin', password: 'admin', roles: 'admin' };
                    localStorage.setItem('elbuencafe_users', JSON.stringify([userFound]));
                }
            }

            if (userFound) {
                setLoggedUser(userFound);
                // Mostrar selector de roles para todos los usuarios autenticados
                setShowRoleSelector(true);
                setError('');
            } else {
                setError('Usuario o contraseña incorrectos');
                addNotification('❌ Intento de inicio de sesión fallido');
            }
            setIsLoading(false);
        }, 500);
    };

    // Manejar selección de rol después del login (para todos los usuarios)
    const handleRoleSelect = async (role: 'admin' | 'mesero' | 'cocina') => {
        // Verificar que el usuario tenga permiso para acceder al rol seleccionado
        if (loggedUser) {
            const isAdmin = loggedUser.roles.includes('admin');

            if (isAdmin) {
                // Admin tiene acceso total a todas las secciones - sin restricciones
            } else {
                // NO es admin: verificar permisos según roles asignados
                if (role === 'admin') {
                    setError('Solo los administradores pueden acceder al panel de administración');
                    return;
                }
                // Verificar que el usuario tenga el rol específico seleccionado
                if (!loggedUser.roles.includes(role)) {
                    const roleLabel = role === 'mesero' ? 'mesero' : 'cocina';
                    setError(`No tienes permiso para acceder al panel de ${roleLabel}`);
                    return;
                }
            }
        }

        // Autenticación según el rol seleccionado
        let loginSuccess = true;
        if (role === 'cocina') {
            if (loggedUser?.roles?.includes('admin')) {
                loginCocinaAsAdmin();
            } else {
                loginSuccess = await loginCocina(loggedUser?.username || '', loggedUser?.password || '');
            }
        } else if (role === 'mesero') {
            if (loggedUser?.roles?.includes('admin')) {
                loginMeseroAsAdmin();
            } else {
                loginSuccess = await loginMesero(loggedUser?.username || '', loggedUser?.password || '');
            }
        }

        if (!loginSuccess) {
            setError('Error al iniciar sesión. Verifica que el usuario exista y tenga el rol adecuado.');
            return;
        }

        setCurrentRole(role);
        addNotification(`👋 Bienvenido al Panel de ${role === 'admin' ? 'Administración' : role === 'mesero' ? 'Mesero' : 'Cocina'}!`);
        setShowRoleSelector(false);
    };

    const handleAddUser = async () => {
        if (!newUsername || !newPassword) {
            alert('Por favor completa todos los campos');
            return;
        }

        // Check if username already exists
        if (users.find(u => u.username.toLowerCase() === newUsername.toLowerCase())) {
            alert('El usuario ya existe');
            return;
        }

        try {
            await saveUser({
                username: newUsername,
                password: newPassword,
                roles: newRoles.join(',')
            });
            addNotification(`✅ Usuario ${newUsername} creado exitosamente`);
            setNewUsername('');
            setNewPassword('');
            setNewRoles(['mesero']);
        } catch (err) {
            console.error('Error al guardar usuario:', err);
            addNotification(`❌ Error al crear usuario`);
        }
    };

    const handleDeleteUser = async (usernameToDelete: string) => {
        if (usernameToDelete === 'admin') {
            alert('No puedes eliminar el usuario admin');
            return;
        }

        try {
            await deleteUser(usernameToDelete);
            addNotification(`❌ Usuario ${usernameToDelete} eliminado`);
        } catch (err) {
            console.error('Error al eliminar usuario:', err);
            addNotification(`❌ Error al eliminar usuario`);
        }
    };

    const handleSaveCredentials = async () => {
        try {
            await updateAdminCredentials(username, password);
            addNotification('✅ Credenciales guardadas exitosamente');
        } catch (err) {
            console.error('Error al guardar credenciales:', err);
            addNotification('❌ Error al guardar credenciales');
        }
    };

    // Role Selector Modal (después de login exitoso)
    if (showRoleSelector && loggedUser) {
        // Determinar qué roles puede ver el usuario
        const availableRoles: string[] = loggedUser.roles.includes('admin')
            ? ['admin', 'mesero', 'cocina']
            : ['mesero', 'cocina'].filter(r => loggedUser.roles.includes(r));

        return (
            <div className="min-h-screen bg-gradient-to-br from-brand-green-dark via-brand-green to-brand-green-dark flex items-center justify-center p-4">
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-brand-crema-light w-full max-w-md rounded-3xl shadow-2xl overflow-hidden border border-brand-gold/20"
                >
                    <div className="bg-gradient-to-r from-brand-gold to-brand-gold-dark p-8 text-center">
                        <div className="w-20 h-20 mx-auto bg-white rounded-full flex items-center justify-center mb-4 shadow-lg">
                            <Shield className="w-10 h-10 text-brand-green-dark" />
                        </div>
                        <h2 className="text-2xl font-bold text-brand-green-dark">Selecciona tu Rol</h2>
                        <p className="text-brand-warm-gray/60 text-sm mt-2">¿A dónde deseas acceder?</p>
                    </div>

                    <div className="p-8 space-y-4">
                        {availableRoles.includes('admin') && (
                            <button
                                onClick={() => handleRoleSelect('admin')}
                                className="w-full bg-gradient-to-r from-brand-green to-brand-green-dark hover:from-brand-green-light hover:to-brand-green text-white font-bold py-4 rounded-xl shadow-lg transition-all transform hover:scale-[1.02] flex items-center justify-center gap-3"
                            >
                                <Shield className="w-6 h-6" />
                                <span>Panel de Administración</span>
                            </button>
                        )}

                        {availableRoles.includes('mesero') && (
                            <button
                                onClick={() => handleRoleSelect('mesero')}
                                className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white font-bold py-4 rounded-xl shadow-lg transition-all transform hover:scale-[1.02] flex items-center justify-center gap-3"
                            >
                                <Users className="w-6 h-6" />
                                <span>Panel de Mesero</span>
                            </button>
                        )}

                        {availableRoles.includes('cocina') && (
                            <button
                                onClick={() => handleRoleSelect('cocina')}
                                className="w-full bg-gradient-to-r from-orange-600 to-orange-700 hover:from-orange-500 hover:to-orange-600 text-white font-bold py-4 rounded-xl shadow-lg transition-all transform hover:scale-[1.02] flex items-center justify-center gap-3"
                            >
                                <ChefHat className="w-6 h-6" />
                                <span>Pantalla de Cocina</span>
                            </button>
                        )}
                    </div>
                </motion.div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-brand-green-dark via-brand-green to-brand-green-dark flex items-center justify-center p-4">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-brand-crema-light w-full max-w-md rounded-3xl shadow-2xl overflow-hidden border border-brand-gold/20"
            >
                {/* Header */}
                <div className="bg-gradient-to-r from-brand-gold to-brand-gold-dark p-8 text-center">
                    <div className="w-20 h-20 mx-auto bg-white rounded-full flex items-center justify-center mb-4 shadow-lg">
                        <LogIn className="w-10 h-10 text-brand-green-dark" />
                    </div>
                    <h2 className="text-2xl font-bold text-brand-green-dark">Panel de Control</h2>
                    <p className="text-brand-warm-gray/60 text-sm mt-2">El Buen Café - Restaurante Gourmet</p>
                </div>

                {/* Form */}
                <div className="p-8">
                    <form onSubmit={handleLogin} className="space-y-6">
                        {/* Username Input */}
                        <div className="space-y-2">
                            <label className="text-xs font-bold uppercase tracking-wider text-brand-warm-gray/70">
                                Usuario
                            </label>
                            <div className="relative">
                                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-brand-gold/60" />
                                <input
                                    type="text"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    className="w-full bg-brand-crema border border-brand-gold/20 rounded-xl py-3 pl-10 pr-4 text-brand-green-dark font-semibold focus:outline-none focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/20 transition-all"
                                    placeholder="Ingresa tu usuario"
                                />
                            </div>
                        </div>

                        {/* Password Input */}
                        <div className="space-y-2">
                            <label className="text-xs font-bold uppercase tracking-wider text-brand-warm-gray/70">
                                Contraseña
                            </label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-brand-gold/60" />
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full bg-brand-crema border border-brand-gold/20 rounded-xl py-3 pl-10 pr-12 text-brand-green-dark font-semibold focus:outline-none focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/20 transition-all"
                                    placeholder="••••••••"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-warm-gray/50 hover:text-brand-gold transition-colors"
                                >
                                    {showPassword ? (
                                        <EyeOff className="w-5 h-5" />
                                    ) : (
                                        <Eye className="w-5 h-5" />
                                    )}
                                </button>
                            </div>
                        </div>

                        {/* Error Message */}
                        {error && (
                            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-red-600 text-sm font-semibold text-center animate-pulse">
                                {error}
                            </div>
                        )}

                        {/* Login Button */}
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full bg-gradient-to-r from-brand-gold to-brand-gold-dark hover:from-brand-gold-light hover:to-brand-gold text-brand-green-dark font-bold py-4 rounded-xl shadow-lg shadow-brand-gold/20 transition-all transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {isLoading ? (
                                <>
                                    <div className="w-5 h-5 border-2 border-brand-green-dark border-t-transparent rounded-full animate-spin" />
                                    <span>Iniciando...</span>
                                </>
                            ) : (
                                <>
                                    <LogIn className="w-5 h-5" />
                                    <span>Iniciar Sesión</span>
                                </>
                            )}
                        </button>
                    </form>

                    {/* User Management Toggle - Solo visible para admin */}
                    {canManageUsers && (
                        <div className="mt-6">
                            <button
                                onClick={() => setShowUserManager(!showUserManager)}
                                className="w-full bg-brand-crema-dark/10 hover:bg-brand-crema-dark/20 text-brand-green-dark font-semibold py-3 rounded-xl transition-all flex items-center justify-center gap-2"
                            >
                                <UserPlus className="w-5 h-5" />
                                <span>{showUserManager ? 'Cerrar Gestión de Usuarios' : 'Gestión de Usuarios'}</span>
                            </button>
                        </div>
                    )}

                    {/* User Manager Panel */}
                    {showUserManager && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            className="mt-6 pt-6 border-t border-brand-gold/20 space-y-6"
                        >
                            {/* Add New User */}
                            <div className="space-y-3">
                                <h3 className="text-sm font-bold uppercase tracking-wider text-brand-gold">Agregar Nuevo Usuario</h3>
                                <div className="space-y-2">
                                    <input
                                        type="text"
                                        value={newUsername}
                                        onChange={(e) => setNewUsername(e.target.value)}
                                        className="w-full bg-brand-crema border border-brand-gold/20 rounded-lg py-2 px-3 text-sm text-brand-green-dark focus:outline-none focus:border-brand-gold"
                                        placeholder="Nombre de usuario"
                                    />
                                    <input
                                        type="password"
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                        className="w-full bg-brand-crema border border-brand-gold/20 rounded-lg py-2 px-3 text-sm text-brand-green-dark focus:outline-none focus:border-brand-gold"
                                        placeholder="Contraseña"
                                    />
                                    <div className="flex flex-wrap gap-2">
                                        {['mesero', 'cocina', 'repartidor'].map(rol => (
                                            <label key={rol} className="flex items-center gap-1 text-sm cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={newRoles.includes(rol)}
                                                    onChange={(e) => {
                                                        if (e.target.checked) {
                                                            setNewRoles([...newRoles, rol]);
                                                        } else {
                                                            setNewRoles(newRoles.filter(r => r !== rol));
                                                        }
                                                    }}
                                                    className="accent-brand-gold"
                                                />
                                                <span className="text-brand-green-dark capitalize">{rol}</span>
                                            </label>
                                        ))}
                                    </div>
                                    <button
                                        onClick={handleAddUser}
                                        className="w-full bg-brand-green hover:bg-brand-green-dark text-white font-bold py-2 rounded-lg transition-colors flex items-center justify-center gap-2"
                                    >
                                        <UserPlus className="w-4 h-4" />
                                        <span>Agregar Usuario</span>
                                    </button>
                                </div>
                            </div>

                            {/* Save Admin Credentials */}
                            <div className="space-y-3">
                                <h3 className="text-sm font-bold uppercase tracking-wider text-brand-gold">Cambiar Credenciales Admin</h3>
                                <div className="space-y-2">
                                    <input
                                        type="text"
                                        value={username}
                                        onChange={(e) => setUsername(e.target.value)}
                                        className="w-full bg-brand-crema border border-brand-gold/20 rounded-lg py-2 px-3 text-sm text-brand-green-dark focus:outline-none focus:border-brand-gold"
                                        placeholder="Nuevo nombre de usuario admin"
                                    />
                                    <input
                                        type="password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="w-full bg-brand-crema border border-brand-gold/20 rounded-lg py-2 px-3 text-sm text-brand-green-dark focus:outline-none focus:border-brand-gold"
                                        placeholder="Nueva contraseña admin"
                                    />
                                    <button
                                        onClick={handleSaveCredentials}
                                        className="w-full bg-brand-gold hover:bg-brand-gold-dark text-brand-green-dark font-bold py-2 rounded-lg transition-colors flex items-center justify-center gap-2"
                                    >
                                        <Save className="w-4 h-4" />
                                        <span>Guardar Credenciales</span>
                                    </button>
                                </div>
                            </div>

                            {/* List of Users */}
                            <div className="space-y-3">
                                <h3 className="text-sm font-bold uppercase tracking-wider text-brand-gold">Usuarios Activos</h3>
                                <div className="space-y-2 max-h-48 overflow-y-auto">
                                    {users.map(user => (
                                        <div key={user.username} className="flex items-center justify-between bg-brand-crema-dark/5 p-3 rounded-lg border border-brand-gold/10">
                                            <div className="flex items-center gap-2">
                                                <User className="w-4 h-4 text-brand-gold/60" />
                                                <div>
                                                    <span className="text-sm font-bold text-brand-green-dark">{user.username}</span>
                                                    <span className="text-[10px] text-brand-warm-gray/60 ml-2 uppercase">{user.roles}</span>
                                                </div>
                                            </div>
                                            {!user.roles.includes('admin') && (
                                                <button
                                                    onClick={() => handleDeleteUser(user.username)}
                                                    className="text-red-500 hover:text-red-600 p-1 transition-colors"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {/* Info */}
                    <div className="mt-6 text-center">
                        <p className="text-[10px] text-brand-warm-gray/40">
                            Por defecto: usuario <span className="font-bold text-brand-gold">admin</span> / contraseña <span className="font-bold text-brand-gold">admin</span>
                        </p>
                    </div>
                </div>
            </motion.div>
        </div>
    );
};
