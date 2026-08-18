import React from 'react';
import { Product } from '../types';
import { X, Clock, Star } from 'lucide-react';
import { ModalWrapper } from './ModalWrapper';

interface ProductDetailModalProps {
  product: Product;
  isOpen: boolean;
  onClose: () => void;
}

export const ProductDetailModal: React.FC<ProductDetailModalProps> = ({ product, isOpen, onClose }) => {
  return (
    <ModalWrapper
      isOpen={isOpen}
      variant="slideUp"
      overlayClass="items-end sm:items-center p-0 sm:p-4"
      cardClass="relative bg-[#1A2E1A] w-full sm:max-w-md max-h-[92vh] sm:max-h-[85vh] rounded-t-2xl sm:rounded-2xl overflow-y-auto flex flex-col shadow-2xl pb-6 border border-[#2A452A]"
    >
      {() => (
        <>
          <button
            onClick={onClose}
            className="absolute top-4 right-4 z-10 bg-black/40 hover:bg-black/60 text-white p-2 rounded-full transition-colors backdrop-blur-sm"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="relative h-64 sm:h-56 bg-[#0F1A0F] overflow-hidden">
            {product.image ? (
              <img src={product.image} alt={product.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-brand-crema p-6 text-center bg-gradient-to-br from-[#0F1A0F] to-brand-green">
                <span className="text-5xl mb-2">🍽️</span>
                <span className="font-display italic text-lg">{product.name}</span>
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-[#0F1A0F]/95 via-black/20 to-transparent" />
            <div className="absolute bottom-4 left-5 right-5 text-white">
              <span className="bg-brand-gold text-[#0F1A0F] text-[9px] font-bold px-2 py-1 rounded-full uppercase tracking-wider">{product.category}</span>
              <h2 className="text-2xl font-display font-bold tracking-tight mt-2">{product.name}</h2>
            </div>
          </div>
          <div className="p-5 flex-1 space-y-5">
            {product.description && (
              <p className="text-[#B8C4B8] text-sm leading-relaxed font-display italic text-base">{product.description}</p>
            )}
            <div className="flex items-center justify-between border-b border-[#2A452A] pb-4">
              <span className="text-sm text-[#B8C4B8] font-medium">Precio Unitario</span>
              <span className="text-2xl font-bold text-brand-gold font-mono">${product.price.toFixed(2)}</span>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs text-[#B8C4B8]">
              {product.prepTime && (
                <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-brand-gold" /><span>{product.prepTime} min de preparación</span></span>
              )}
              {product.calories && (<span>{product.calories} kcal</span>)}
              {product.popular && (
                <span className="flex items-center gap-1.5"><Star className="w-3.5 h-3.5 text-brand-gold fill-brand-gold" /><span>Popular</span></span>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {product.spicy && (
                <span className="text-[9px] font-bold px-2 py-0.5 rounded-md bg-red-500/10 text-red-400 border border-red-500/20 uppercase">Picante 🌶️</span>
              )}
              {product.vegetarian && (
                <span className="text-[9px] font-bold px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase">Vegetariano</span>
              )}
            </div>
          </div>
        </>
      )}
    </ModalWrapper>
  );
};