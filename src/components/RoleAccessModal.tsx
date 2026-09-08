import React, { useState } from 'react';
import { X, Shield, Users, ChefHat, User, Lock, Eye, EyeOff, LogIn, ArrowLeft } from 'lucide-react';
import { useOrders } from '../context/OrderContext';
import { ModalWrapper } from './ModalWrapper';

interface UserCredentials {
    username: string;
    password: string;
    roles: string;
}

interface RoleAccessModalProps {
    isOpen: boolean;
    onClose: () => void;
    onRoleSelected: (role: 'admin' | 'mesero' | 'cocina', username: string, password: string) => void;
}

export const RoleAccessModal: React.FC<RoleAccessModalProps> = ({ isOpen, onClose, onRoleSelected }) => {
    const { users, saveUser } = useOrders();
    const [step, setStep] = useState<'select' | 'login'>('select');
    const [selectedRole, setSelectedRole] = useState<'admin' | 'mesero' | 'cocina' | null>(null);
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleRoleClick = (role: 'admin' | 'mesero' | 'cocina') => {
        setSelectedRole(role);
        setStep('login');
        setError('');
        setUsername('');
        setPassword('');
    };

    const handleLogin = (e: React.FormEvent) => {
        e.preventDefault();
        if (isLoading) return;
        setError('');
        setIsLoading(true);

        setTimeout(async () => {
            try {
                let userFound = users.find(
                    u => u.username.toLowerCase() === username.toLowerCase() && u.password === password
                );

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

            if (!userFound && username.toLowerCase() === 'admin' && password === 'admin') {
                try {
                    await saveUser({ username: 'admin', password: 'admin', roles: 'admin' });
                    userFound = { username: 'admin', password: 'admin', roles: 'admin' };
                } catch (err) {
                    console.error('Error al crear admin default:', err);
                    userFound = { username: 'admin', password: 'admin', roles: 'admin' };
                    localStorage.setItem('elbuencafe_users', JSON.stringify([userFound]));
                }
            }

            if (!userFound) {
                setError('Usuario o contraseña incorrectos');
                setIsLoading(false);
                return;
            }

            if (userFound.roles.includes('admin')) {
                setIsLoading(false);
                onRoleSelected(selectedRole, username, password);
                handleCloseInternal();
                return;
            }

            if (selectedRole === 'admin' && !userFound.roles.includes('admin')) {
                setError('Solo los administradores pueden acceder al panel de administración');
                setIsLoading(false);
                return;
            }

            if (selectedRole === 'mesero' && !userFound.roles.includes('mesero')) {
                setError('No tienes permiso para acceder al panel de mesero');
                setIsLoading(false);
                return;
            }

            if (selectedRole === 'cocina' && !userFound.roles.includes('cocina')) {
                setError('No tienes permiso para acceder a la pantalla de cocina');
                setIsLoading(false);
                return;
            }

            setIsLoading(false);
            onRoleSelected(selectedRole!, username, password);
            handleCloseInternal();
            } catch (err) {
                console.error('Error en login:', err);
                setError('Error interno, intenta de nuevo');
                setIsLoading(false);
            }
        }, 500);
    };

    const handleGoBack = () => {
        setStep('select');
        setSelectedRole(null);
        setError('');
        setUsername('');
        setPassword('');
    };

    const handleCloseInternal = () => {
        setStep('select');
        setSelectedRole(null);
        setUsername('');
        setPassword('');
        setError('');
        onClose();
    };

    const roleLabel = selectedRole === 'admin' ? 'Administrador' : selectedRole === 'mesero' ? 'Mesero' : 'Cocina';
    const roleIcon = selectedRole === 'admin' ? Shield : selectedRole === 'mesero' ? Users : ChefHat;
    const IconComponent = roleIcon;

    return (
        <ModalWrapper
            isOpen={isOpen}
            cardClass="bg-brand-crema-light w-full max-w-md rounded-3xl shadow-2xl overflow-hidden border border-brand-gold/20 relative"
        >
            {() => (
                <>
                    {/* Close button */}
                    <button
                        onClick={handleCloseInternal}
                        className="absolute top-4 right-4 text-brand-warm-gray/50 hover:text-brand-gold transition-colors z-10"
                    >
                        <X className="w-5 h-5" />
                    </button>

                    {step === 'select' ? (
                        <>
                            {/* Header */}
                            <div className="bg-gradient-to-r from-brand-gold to-brand-gold-dark p-8 text-center">
                                <div className="w-20 h-20 mx-auto bg-white rounded-full flex items-center justify-center mb-4 shadow-lg">
                                    <Shield className="w-10 h-10 text-brand-green-dark" />
                                </div>
                                <h2 className="text-2xl font-bold text-brand-green-dark">Acceso al Sistema</h2>
                                <p className="text-brand-warm-gray/60 text-sm mt-2">
                                    Selecciona la sección a la que deseas acceder
                                </p>
                            </div>

                            {/* Role Buttons */}
                            <div className="p-8 space-y-4">
                                <button
                                    onClick={() => handleRoleClick('mesero')}
                                    className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white font-bold py-4 rounded-xl shadow-lg transition-all transform hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-3"
                                >
                                    <Users className="w-6 h-6" />
                                    <span>Panel de Mesero</span>
                                </button>

                                <button
                                    onClick={() => handleRoleClick('cocina')}
                                    className="w-full bg-gradient-to-r from-orange-600 to-orange-700 hover:from-orange-500 hover:to-orange-600 text-white font-bold py-4 rounded-xl shadow-lg transition-all transform hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-3"
                                >
                                    <ChefHat className="w-6 h-6" />
                                    <span>Pantalla de Cocina</span>
                                </button>

                                <button
                                    onClick={() => handleRoleClick('admin')}
                                    className="w-full bg-gradient-to-r from-brand-green to-brand-green-dark hover:from-brand-green-light hover:to-brand-green text-white font-bold py-4 rounded-xl shadow-lg transition-all transform hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-3"
                                >
                                    <Shield className="w-6 h-6" />
                                    <span>Panel de Administración</span>
                                </button>
                            </div>

                            {/* Footer info */}
                            <div className="px-8 pb-6 text-center">
                                <p className="text-[10px] text-brand-warm-gray/40">
                                    Por defecto: usuario <span className="font-bold text-brand-gold">admin</span> / contraseña <span className="font-bold text-brand-gold">admin</span>
                                </p>
                            </div>
                        </>
                    ) : (
                        <>
                            {/* Header */}
                            <div className="bg-gradient-to-r from-brand-gold to-brand-gold-dark p-8 text-center">
                                <div className="w-20 h-20 mx-auto bg-white rounded-full flex items-center justify-center mb-4 shadow-lg">
                                    <IconComponent className="w-10 h-10 text-brand-green-dark" />
                                </div>
                                <h2 className="text-2xl font-bold text-brand-green-dark capitalize">
                                    Acceso: {roleLabel}
                                </h2>
                                <p className="text-brand-warm-gray/60 text-sm mt-2">
                                    Ingresa tus credenciales para continuar
                                </p>
                            </div>

                            {/* Login Form */}
                            <div className="p-8">
                                <form onSubmit={handleLogin} className="space-y-6">
                                    {/* Username */}
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
                                                autoFocus
                                            />
                                        </div>
                                    </div>

                                    {/* Password */}
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

                                    {/* Error */}
                                    {error && (
                                        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-red-600 text-sm font-semibold text-center animate-pulse">
                                            {error}
                                        </div>
                                    )}

                                    {/* Submit */}
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

                                    {/* Back button */}
                                    <button
                                        type="button"
                                        onClick={handleGoBack}
                                        className="w-full text-brand-warm-gray/60 hover:text-brand-gold text-sm font-semibold py-2 transition-colors flex items-center justify-center gap-2"
                                    >
                                        <ArrowLeft className="w-4 h-4" />
                                        <span>Volver a selección de sección</span>
                                    </button>
                                </form>
                            </div>
                        </>
                    )}
                </>
            )}
        </ModalWrapper>
    );
};
