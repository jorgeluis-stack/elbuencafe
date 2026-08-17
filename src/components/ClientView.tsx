import React, { useState } from 'react';
import { useOrders } from '../context/OrderContext';
import { CATEGORIES, PRODUCTS } from '../data/menu';
import { Product, CategoryId } from '../types';
import { ProductDetailModal } from './ProductDetailModal';
import {
  Search,
  Menu as MenuIcon,
  Home,
  Coffee,
  Sparkles,
  Flame,
  UtensilsCrossed,
  Clock,
  ChevronRight
} from 'lucide-react';
import { motion } from 'motion/react';

export const ClientView: React.FC = () => {
  const {
    selectedProduct,
    setSelectedProduct
  } = useOrders();

  const [activeTab, setActiveTab] = useState<'inicio' | 'menu'>('inicio');
  const [activeCategory, setActiveCategory] = useState<CategoryId>('especiales');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredProducts = PRODUCTS.filter(product => {
    const matchesCategory = product.category === activeCategory;
    const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (product.description && product.description.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  const activeCategoryName = CATEGORIES.find(c => c.id === activeCategory)?.name || 'Menú';

  return (
    <div id="client-view" className="min-h-screen bg-[#0F1A0F] text-white pb-32">

      {/* ═══════════════ HEADER TIPO DOMINO'S ═══════════════ */}
      <header className="sticky top-0 z-40 bg-[#0F1A0F]/95 backdrop-blur-xl border-b border-[#2A452A] px-4 md:px-8 py-3.5 flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 md:w-12 md:h-12 rounded-full overflow-hidden border-2 border-brand-gold/60 bg-[#1A2E1A] shadow-md flex items-center justify-center">
            <img
              src="/assets/logo.png"
              alt="El Buen Café"
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          </div>
          <div>
            <span className="font-display text-lg md:text-xl font-bold text-white tracking-tight block">El Buen Café</span>
            <span className="text-[10px] md:text-xs text-brand-gold font-medium uppercase tracking-widest block">Menú Digital en Mesa</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setActiveTab('inicio')}
            className={`px-4 py-2 rounded-xl text-xs md:text-sm font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'inicio'
                ? 'bg-brand-gold text-[#0F1A0F] shadow-lg shadow-brand-gold/20'
                : 'bg-[#1A2E1A] text-[#B8C4B8] border border-[#2A452A] hover:border-brand-gold/40'
            }`}
          >
            <Home className="w-4 h-4" />
            <span>Inicio</span>
          </button>
          <button
            onClick={() => setActiveTab('menu')}
            className={`px-4 py-2 rounded-xl text-xs md:text-sm font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'menu'
                ? 'bg-brand-gold text-[#0F1A0F] shadow-lg shadow-brand-gold/20'
                : 'bg-[#1A2E1A] text-[#B8C4B8] border border-[#2A452A] hover:border-brand-gold/40'
            }`}
          >
            <UtensilsCrossed className="w-4 h-4" />
            <span>Menú</span>
          </button>
        </div>
      </header>

      {/* ═══════════════ MAIN CONTAINER ═══════════════ */}
      <main className="max-w-7xl mx-auto px-4 md:px-8 pt-6 space-y-8">

        {/* ═══════════════ VISTA DE INICIO (ESTILO BANNERS DOMINO'S) ═══════════════ */}
        {activeTab === 'inicio' && (
          <div className="space-y-8 animate-fadeIn">

            {/* HERO BANNER PRINCIPAL */}
            <div className="relative rounded-3xl overflow-hidden bg-gradient-to-r from-[#162916] to-[#1A381A] border border-[#2A452A] shadow-2xl p-6 md:p-12 text-center md:text-left flex flex-col md:flex-row items-center justify-between gap-8">
              <div className="space-y-4 max-w-xl">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-gold/20 text-brand-gold font-bold text-xs uppercase tracking-wider border border-brand-gold/30">
                  <Sparkles className="w-3.5 h-3.5" /> Menú Oficial 2026
                </span>
                <h1 className="text-3xl md:text-5xl font-display font-black text-white tracking-tight leading-tight">
                  ¡BIENVENIDOS A <span className="text-brand-gold">EL BUEN CAFÉ!</span>
                </h1>
                <p className="text-[#B8C4B8] text-sm md:text-base leading-relaxed">
                  Disfruta de nuestros desayunos artesanales, cafés de grano selecto, antojitos y especialidades de la casa. Consulta nuestros platillos y pídelos directamente a tu mesero.
                </p>
                <div className="pt-2 flex flex-wrap gap-3 justify-center md:justify-start">
                  <button
                    onClick={() => setActiveTab('menu')}
                    className="px-8 py-3.5 bg-brand-gold text-[#0F1A0F] font-bold rounded-2xl shadow-xl shadow-brand-gold/25 hover:scale-105 transition-all text-sm md:text-base flex items-center gap-2"
                  >
                    <span>Ver Menú Completo</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="w-full md:w-[420px] h-[240px] md:h-[280px] rounded-2xl overflow-hidden shadow-2xl border border-brand-gold/30 shrink-0 relative group">
                <img
                  src="https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&auto=format&fit=crop&q=80"
                  alt="Platillo Destacado"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex items-end p-5">
                  <div>
                    <span className="text-brand-gold font-bold text-xs uppercase tracking-widest bg-black/50 px-2.5 py-1 rounded-md border border-brand-gold/30">Especialidad</span>
                    <h3 className="text-white font-bold text-lg mt-1">Gastronomía Artesanal del Día</h3>
                  </div>
                </div>
              </div>
            </div>

            {/* BANNERS PROMOCIONALES SECUNDARIOS (ESTILO DOMINO'S) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div 
                onClick={() => { setActiveCategory('especiales'); setActiveTab('menu'); }}
                className="relative rounded-2xl overflow-hidden bg-[#1A2E1A] border border-[#2A452A] p-6 cursor-pointer hover:border-brand-gold/50 hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 flex items-center gap-6 group"
              >
                <div className="w-32 h-32 rounded-xl overflow-hidden shrink-0 border border-brand-gold/20">
                  <img
                    src="https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=600&auto=format&fit=crop&q=80"
                    alt="Bebidas"
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-brand-gold font-bold text-[10px] uppercase tracking-widest bg-brand-gold/10 px-2 py-0.5 rounded border border-brand-gold/20">Destacados</span>
                  <h3 className="font-display font-bold text-white text-lg mt-1.5">Cafés y Bebidas Selectas</h3>
                  <p className="text-[#B8C4B8] text-xs mt-1 line-clamp-2">Granos recién molidos, capuchinos cremosos y jugos naturales.</p>
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-brand-gold mt-3 group-hover:translate-x-1 transition-transform">
                    Ver categoría <ChevronRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </div>

              <div 
                onClick={() => { setActiveCategory('desayunos'); setActiveTab('menu'); }}
                className="relative rounded-2xl overflow-hidden bg-[#1A2E1A] border border-[#2A452A] p-6 cursor-pointer hover:border-brand-gold/50 hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 flex items-center gap-6 group"
              >
                <div className="w-32 h-32 rounded-xl overflow-hidden shrink-0 border border-brand-gold/20">
                  <img
                    src="https://images.unsplash.com/photo-1494597564530-871f2b93ac55?w=600&auto=format&fit=crop&q=80"
                    alt="Desayunos"
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-brand-gold font-bold text-[10px] uppercase tracking-widest bg-brand-gold/10 px-2 py-0.5 rounded border border-brand-gold/20">Mañanas</span>
                  <h3 className="font-display font-bold text-white text-lg mt-1.5">Desayunos y Cenas</h3>
                  <p className="text-[#B8C4B8] text-xs mt-1 line-clamp-2">Omelettes frescos, chilaquiles crujientes y huevos al gusto.</p>
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-brand-gold mt-3 group-hover:translate-x-1 transition-transform">
                    Ver categoría <ChevronRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </div>
            </div>

            {/* SECCIÓN DE CATEGORÍAS EN GRID AMPLIO (ESTILO DOMINO'S MENÚ) */}
            <div className="space-y-4 pt-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-display font-bold text-white tracking-tight">Explora por Categoría</h3>
                <button 
                  onClick={() => setActiveTab('menu')}
                  className="text-xs font-bold text-brand-gold hover:underline flex items-center gap-1"
                >
                  Ver todo el menú <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
                {CATEGORIES.map((cat) => (
                  <div
                    key={cat.id}
                    onClick={() => { setActiveCategory(cat.id); setActiveTab('menu'); }}
                    className="group relative bg-[#1A2E1A] rounded-2xl overflow-hidden border border-[#2A452A] hover:border-brand-gold cursor-pointer transition-all duration-300 hover:shadow-2xl hover:-translate-y-1.5 flex flex-col text-center p-4 items-center"
                  >
                    <div className="w-20 h-20 rounded-full overflow-hidden mb-3 bg-[#0F1A0F] border border-brand-gold/30 shadow-md group-hover:scale-105 transition-transform duration-500">
                      {cat.image ? (
                        <img src={cat.image} alt={cat.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-2xl">☕</div>
                      )}
                    </div>
                    <span className="font-display font-bold text-white text-sm group-hover:text-brand-gold transition-colors">
                      {cat.name}
                    </span>
                    <span className="text-[11px] text-[#B8C4B8] mt-1 line-clamp-1">
                      {cat.description}
                    </span>
                  </div>
                ))}
              </div>
            </div>

          </div>
        )}

        {/* ═══════════════ VISTA DE MENÚ (CATÁLOGO COMPLETO) ═══════════════ */}
        {activeTab === 'menu' && (
          <div className="space-y-8 animate-fadeIn">

            {/* SEARCH BAR & CATEGORY TABS */}
            <div className="space-y-4">
              <div className="max-w-xl mx-auto">
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#7A8A7A]" />
                  <input
                    type="text"
                    placeholder="Buscar platillos, bebidas, postres..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-12 pr-4 py-3.5 bg-[#1A2E1A] text-white placeholder-[#7A8A7A] rounded-2xl text-sm md:text-base border border-[#2A452A] focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/20 outline-hidden transition-all shadow-inner"
                  />
                </div>
              </div>

              {/* Category selector pills */}
              <div className="flex gap-2.5 overflow-x-auto pb-3 pt-2 no-scrollbar scroll-smooth snap-x">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setActiveCategory(cat.id)}
                    className={`snap-start shrink-0 px-5 py-3 rounded-2xl text-xs md:text-sm font-bold transition-all duration-300 border flex items-center gap-2 shadow-sm ${
                      activeCategory === cat.id
                        ? 'bg-brand-gold text-[#0F1A0F] border-brand-gold shadow-lg shadow-brand-gold/20 scale-105'
                        : 'bg-[#1A2E1A] text-[#B8C4B8] border-[#2A452A] hover:border-brand-gold/40'
                    }`}
                  >
                    <span>{cat.icon}</span>
                    <span>{cat.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* PRODUCT GRID (RESPONSIVE: 1 COL EN MÓVIL, 2 EN TABLET, 3 EN PC) */}
            <div className="space-y-6">
              <div className="flex items-center justify-between border-b border-[#2A452A] pb-3">
                <h3 className="text-xl md:text-2xl font-display font-bold text-white tracking-tight flex items-center gap-2">
                  <span>{searchQuery ? 'Resultados de Búsqueda' : activeCategoryName}</span>
                </h3>
                <span className="text-xs md:text-sm text-[#7A8A7A] font-mono bg-[#1A2E1A] px-3 py-1 rounded-xl border border-[#2A452A]">
                  {filteredProducts.length} {filteredProducts.length === 1 ? 'disponible' : 'disponibles'}
                </span>
              </div>

              {filteredProducts.length === 0 ? (
                <div className="bg-[#1A2E1A] rounded-3xl p-16 text-center border border-[#2A452A] shadow-2xl">
                  <span className="text-6xl">🍽️</span>
                  <h4 className="font-display font-bold text-white text-lg mt-4">No encontramos platillos</h4>
                  <p className="text-sm text-[#7A8A7A] mt-1 max-w-md mx-auto">Prueba buscando con otro término o selecciona otra categoría superior en el menú.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredProducts.map((product, idx) => (
                    <motion.div
                      key={product.id}
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.03, duration: 0.3 }}
                      className="bg-[#1A2E1A] rounded-3xl overflow-hidden border border-[#2A452A] hover:border-brand-gold/60 hover:shadow-2xl hover:shadow-brand-gold/10 hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between cursor-pointer group"
                      onClick={() => setSelectedProduct(product)}
                    >
                      {/* Product image container */}
                      <div className="w-full h-52 sm:h-56 bg-[#0F1A0F] overflow-hidden relative">
                        {product.image ? (
                          <img
                            src={product.image}
                            alt={product.name}
                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-4xl bg-gradient-to-br from-[#243D24] to-[#1A2E1A]">
                            ☕
                          </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-[#1A2E1A] via-transparent to-transparent opacity-80" />

                        {/* Top badges */}
                        <div className="absolute top-3 left-3 flex flex-wrap gap-2">
                          {product.popular && (
                            <span className="bg-brand-gold text-[#0F1A0F] font-bold text-[10px] px-2.5 py-1 rounded-lg uppercase tracking-wider shadow-md">
                              ⭐ Popular
                            </span>
                          )}
                        </div>

                        {/* Price tag overlay */}
                        <div className="absolute bottom-3 right-3 bg-[#0F1A0F]/90 backdrop-blur-md px-3.5 py-1.5 rounded-xl border border-brand-gold/40 shadow-xl">
                          <span className="font-display font-extrabold text-brand-gold text-lg">
                            ${product.price.toFixed(2)}
                          </span>
                        </div>
                      </div>

                      {/* Content info */}
                      <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                        <div className="space-y-2">
                          <h4 className="font-display font-bold text-white text-lg tracking-tight group-hover:text-brand-gold transition-colors leading-snug">
                            {product.name}
                          </h4>
                          {product.description && (
                            <p className="text-[#B8C4B8] text-xs line-clamp-3 leading-relaxed">
                              {product.description}
                            </p>
                          )}
                        </div>

                        <div className="pt-2 border-t border-[#2A452A]/60 flex items-center justify-between text-xs text-[#7A8A7A]">
                          <div className="flex items-center gap-3">
                            {product.prepTime && (
                              <span className="flex items-center gap-1 font-mono">
                                <Clock className="w-3.5 h-3.5 text-brand-gold" />
                                {product.prepTime} min
                              </span>
                            )}
                            {product.calories && (
                              <span className="font-mono">
                                {product.calories} kcal
                              </span>
                            )}
                          </div>

                          <span className="text-brand-gold font-bold text-xs uppercase tracking-wider group-hover:underline">
                            Ver detalles +
                          </span>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>

          </div>
        )}

      </main>

      {/* ═══════════════ PRODUCT DETAIL MODAL ═══════════════ */}
      {selectedProduct && (
        <ProductDetailModal
          product={selectedProduct}
          onClose={() => setSelectedProduct(null)}
        />
      )}

      {/* ═══════════════ BOTTOM NAVIGATION (MÓVIL) ═══════════════ */}
      <nav className="fixed bottom-0 inset-x-0 z-50 bg-[#0F1A0F]/95 backdrop-blur-xl border-t border-[#2A452A] px-6 py-3 flex items-center justify-around md:hidden shadow-2xl">
        <button
          onClick={() => setActiveTab('inicio')}
          className={`flex flex-col items-center gap-1 px-6 py-1 rounded-xl transition-all ${
            activeTab === 'inicio' ? 'text-brand-gold scale-105' : 'text-[#7A8A7A] hover:text-[#B8C4B8]'
          }`}
        >
          <Home className="w-5 h-5" />
          <span className="text-[11px] font-bold">Inicio</span>
        </button>
        <button
          onClick={() => setActiveTab('menu')}
          className={`flex flex-col items-center gap-1 px-6 py-1 rounded-xl transition-all ${
            activeTab === 'menu' ? 'text-brand-gold scale-105' : 'text-[#7A8A7A] hover:text-[#B8C4B8]'
          }`}
        >
          <UtensilsCrossed className="w-5 h-5" />
          <span className="text-[11px] font-bold">Menú</span>
        </button>
      </nav>
    </div>
  );
};
