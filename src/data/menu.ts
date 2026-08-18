import { Product, CategoryId } from '../types';

export const CATEGORIES: { id: CategoryId; name: string; icon: string; description: string; image?: string }[] = [
  { id: 'especiales', name: 'Destacados', icon: '✨', description: 'Lo mejor del día', image: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&auto=format&fit=crop&q=60' },
  { id: 'bebidas', name: 'Bebidas', icon: '☕', description: 'Cafés, jugos y más', image: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=600&auto=format&fit=crop&q=60' },
  { id: 'desayunos', name: 'Desayunos y Cenas', icon: '🍳', description: 'Omelettes, chilaquiles y huevos', image: 'https://images.unsplash.com/photo-1494597564530-871f2b93ac55?w=600&auto=format&fit=crop&q=60' },
  { id: 'antojitos', name: 'Antojitos', icon: '🌮', description: 'Tacos, quesadillas, sándwiches', image: 'https://images.unsplash.com/photo-1567234669003-dce7a7a88821?w=600&auto=format&fit=crop&q=60' },
  { id: 'sopas', name: 'Sopas', icon: '🥣', description: 'Sopas del día y caldos', image: 'https://images.unsplash.com/photo-1547592165-e1d17fed6005?w=600&auto=format&fit=crop&q=60' },
  { id: 'mariscos', name: 'Mariscos', icon: '🍤', description: 'Cocteles, camarones y pescado', image: 'https://images.unsplash.com/photo-1551248429-40975aa4de74?w=600&auto=format&fit=crop&q=60' },
  { id: 'carnes', name: 'Carnes y Pollo', icon: '🥩', description: 'Milanesas, tampiqueña y alambres', image: 'https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?w=600&auto=format&fit=crop&q=60' },
  { id: 'paninos', name: 'Paninos', icon: '🥪', description: 'Paninos calientes y crujientes', image: 'https://images.unsplash.com/photo-1509722747041-616f39b57569?w=600&auto=format&fit=crop&q=60' },
  { id: 'ensaladas', name: 'Ensaladas', icon: '🥗', description: 'Ensaladas frescas', image: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=600&auto=format&fit=crop&q=60' },
  { id: 'postres', name: 'Postres', icon: '🍰', description: 'Flanes, crepas y pasteles', image: 'https://images.unsplash.com/photo-1551024506-0bccd828d307?w=600&auto=format&fit=crop&q=60' }
];

// Acentos sutiles por categoría (terrosos, coherentes con la identidad café)
export const CATEGORY_ACCENTS: Record<CategoryId, { dot: string; border: string; text: string }> = {
  especiales: { dot: 'bg-brand-gold',          border: 'border-brand-gold/40',     text: 'text-brand-gold' },
  bebidas:   { dot: 'bg-amber-500',             border: 'border-amber-700/40',      text: 'text-amber-400' },
  desayunos: { dot: 'bg-yellow-500',           border: 'border-yellow-700/40',     text: 'text-yellow-400' },
  antojitos: { dot: 'bg-orange-500',           border: 'border-orange-700/40',     text: 'text-orange-400' },
  sopas:     { dot: 'bg-red-500',              border: 'border-red-700/40',        text: 'text-red-400' },
  mariscos:  { dot: 'bg-teal-500',             border: 'border-teal-700/40',       text: 'text-teal-400' },
  carnes:    { dot: 'bg-rose-500',             border: 'border-rose-700/40',       text: 'text-rose-400' },
  paninos:   { dot: 'bg-amber-400',            border: 'border-amber-600/40',      text: 'text-amber-300' },
  ensaladas: { dot: 'bg-lime-500',             border: 'border-lime-700/40',       text: 'text-lime-400' },
  postres:   { dot: 'bg-pink-500',             border: 'border-pink-700/40',       text: 'text-pink-400' },
};

export const PRODUCTS: Product[] = [
  // Especiales / Destacados
  {
    id: 'menu_ejecutivo',
    name: 'Menú Ejecutivo',
    description: 'Incluye sopa del día, plato principal (a elegir) y agua de frutas fresca de temporada. Disponible de Lunes a Sábado.',
    price: 140,
    category: 'especiales',
    popular: true,
    image: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&auto=format&fit=crop&q=60',
    calories: 650,
    prepTime: 20,
    options: [
      {
        name: 'Plato Principal',
        required: true,
        choices: [
          { name: 'Milanesa de pollo', extraPrice: 0 },
          { name: 'Bistec a la mexicana', extraPrice: 0 },
          { name: 'Pechuga a la plancha', extraPrice: 0 },
          { name: 'Milanesa de cerdo', extraPrice: 0 }
        ]
      },
      {
        name: 'Sopa',
        required: true,
        choices: [
          { name: 'Consomé de pollo', extraPrice: 0 },
          { name: 'Sopa del día', extraPrice: 0 },
          { name: 'Crema de verduras', extraPrice: 0 }
        ]
      }
    ]
  },
  
  // Bebidas (Café y Chocolate)
  {
    id: 'cafe_americano',
    name: 'Café Americano',
    description: 'Café de grano selecto, recién molido para un aroma intenso.',
    price: 40,
    category: 'bebidas',
    image: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=600&auto=format&fit=crop&q=60',
    calories: 5,
    prepTime: 3,
    options: [
      {
        name: '¿Descafeinado?',
        required: false,
        choices: [
          { name: 'Regular', extraPrice: 0 },
          { name: 'Descafeinado', extraPrice: 8 }
        ]
      }
    ]
  },
  {
    id: 'cafe_lechero',
    name: 'Café Lechero',
    description: 'Café expreso concentrado servido con leche caliente vertida desde lo alto, al estilo tradicional.',
    price: 55,
    category: 'bebidas',
    popular: true,
    image: 'https://images.unsplash.com/photo-1570968915860-54d5c301fc9f?w=600&auto=format&fit=crop&q=60',
    calories: 80,
    prepTime: 5,
    options: [
      {
        name: '¿Descafeinado?',
        required: false,
        choices: [
          { name: 'Regular', extraPrice: 0 },
          { name: 'Descafeinado', extraPrice: 8 }
        ]
      },
      {
        name: 'Tipo de Leche',
        required: true,
        choices: [
          { name: 'Entera', extraPrice: 0 },
          { name: 'Deslactosada', extraPrice: 0 },
          { name: 'Almendras', extraPrice: 10 }
        ]
      }
    ]
  },
  {
    id: 'capuchino_moka',
    name: 'Capuchino Moka',
    description: 'Combinación perfecta de espresso, chocolate, leche vaporizada y espuma cremosa.',
    price: 65,
    category: 'bebidas',
    image: 'https://images.unsplash.com/photo-1534778101976-62847782c213?w=600&auto=format&fit=crop&q=60',
    calories: 120,
    prepTime: 6,
    options: [
      {
        name: '¿Descafeinado?',
        required: false,
        choices: [
          { name: 'Regular', extraPrice: 0 },
          { name: 'Descafeinado', extraPrice: 8 }
        ]
      },
      {
        name: 'Tipo de Leche',
        required: true,
        choices: [
          { name: 'Entera', extraPrice: 0 },
          { name: 'Deslactosada', extraPrice: 0 },
          { name: 'Almendras', extraPrice: 10 }
        ]
      }
    ]
  },
  {
    id: 'capuchino_irlandes',
    name: 'Capuchino Irlandés',
    description: 'Deliciosa fusión de espresso, notas de crema irlandesa, leche vaporizada y canela.',
    price: 70,
    category: 'bebidas',
    image: 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=600&auto=format&fit=crop&q=60',
    calories: 150,
    prepTime: 6,
    options: [
      {
        name: '¿Descafeinado?',
        required: false,
        choices: [
          { name: 'Regular', extraPrice: 0 },
          { name: 'Descafeinado', extraPrice: 8 }
        ]
      }
    ]
  },
  {
    id: 'licuado_leche',
    name: 'Licuado de Leche',
    description: 'Licuado fresco preparado con fruta de tu elección.',
    price: 70,
    category: 'bebidas',
    calories: 200,
    prepTime: 5,
    options: [
      {
        name: 'Fruta',
        required: true,
        choices: [
          { name: 'Fresa', extraPrice: 0 },
          { name: 'Melón', extraPrice: 0 },
          { name: 'Papaya', extraPrice: 0 },
          { name: 'Chocomilk', extraPrice: 0 }
        ]
      }
    ]
  },
  {
    id: 'jugo_verde',
    name: 'Jugo Verde',
    description: 'Bebida saludable de pepino, piña y apio fresco exprimido al momento.',
    price: 65,
    category: 'bebidas',
    image: 'https://images.unsplash.com/photo-1610970881699-44a5587caa90?w=600&auto=format&fit=crop&q=60',
    calories: 80,
    prepTime: 3,
    vegetarian: true
  },
  {
    id: 'refresco_600',
    name: 'Refresco de 600ml',
    description: 'Bebidas carbonatadas embotelladas frías.',
    price: 33,
    category: 'bebidas',
    calories: 150,
    prepTime: 1,
    options: [
      {
        name: 'Sabor',
        required: true,
        choices: [
          { name: 'Coca-Cola original', extraPrice: 0 },
          { name: 'Coca-Cola Sin Azúcar', extraPrice: 0 },
          { name: 'Fanta', extraPrice: 0 },
          { name: 'Sidral Mundet', extraPrice: 0 },
          { name: 'Sprite', extraPrice: 0 }
        ]
      }
    ]
  },

  // Desayunos y Cenas
  {
    id: 'omelette_jamon_queso',
    name: 'Omelette con Jamón y Queso',
    description: 'Preparado con 3 huevos frescos de granja, jamón de pavo seleccionado y queso derretido, acompañado de frijolitos refritos.',
    price: 100,
    category: 'desayunos',
    popular: true,
    image: 'https://images.unsplash.com/photo-1494597564530-871f2b93ac55?w=600&auto=format&fit=crop&q=60',
    calories: 450,
    prepTime: 12
  },
  {
    id: 'chilaquiles_pollo',
    name: 'Chilaquiles con Pollo',
    description: 'Totopos crujientes bañados en salsa verde o roja, crema, queso fresco, cebolla y pechuga de pollo deshebrada.',
    price: 105,
    category: 'desayunos',
    image: 'https://images.unsplash.com/photo-1600335895229-6e755118925f?w=600&auto=format&fit=crop&q=60',
    calories: 520,
    prepTime: 15,
    spicy: true,
    options: [
      {
        name: 'Salsa',
        required: true,
        choices: [
          { name: 'Salsa Verde', extraPrice: 0 },
          { name: 'Salsa Roja', extraPrice: 0 }
        ]
      }
    ]
  },
  {
    id: 'chilaquiles_arrachera',
    name: 'Chilaquiles con Arrachera',
    description: 'Los tradicionales chilaquiles con jugosas tiras de arrachera asada a la parrilla.',
    price: 140,
    category: 'desayunos',
    popular: true,
    image: 'https://images.unsplash.com/photo-1599974579688-8dbdd335c77f?w=600&auto=format&fit=crop&q=60',
    calories: 580,
    prepTime: 18,
    spicy: true,
    options: [
      {
        name: 'Salsa',
        required: true,
        choices: [
          { name: 'Salsa Verde', extraPrice: 0 },
          { name: 'Salsa Roja', extraPrice: 0 }
        ]
      },
      {
        name: 'Término de la Arrachera',
        required: true,
        choices: [
          { name: 'Bien cocido', extraPrice: 0 },
          { name: 'Término medio', extraPrice: 0 },
          { name: 'Tres cuartos', extraPrice: 0 }
        ]
      }
    ]
  },
  {
    id: 'huevos_al_gusto',
    name: 'Huevos al Gusto',
    description: 'Tres piezas de huevo revueltos o estrellados con el ingrediente de tu preferencia, acompañados de frijoles refritos.',
    price: 100,
    category: 'desayunos',
    calories: 400,
    prepTime: 10,
    options: [
      {
        name: 'Ingrediente',
        required: true,
        choices: [
          { name: 'Jamón', extraPrice: 0 },
          { name: 'Chorizo', extraPrice: 0 },
          { name: 'Salchicha', extraPrice: 0 },
          { name: 'Estrellados', extraPrice: 0 }
        ]
      }
    ]
  },

  // Antojitos
  {
    id: 'club_sandwich',
    name: 'Club Sándwich con Papas',
    description: 'Sándwich de tres pisos con pollo, jamón, tocino crujiente, queso, lechuga y tomate. Servido con papas a la francesa.',
    price: 95,
    category: 'antojitos',
    popular: true,
    image: 'https://images.unsplash.com/photo-1567234669003-dce7a7a88821?w=600&auto=format&fit=crop&q=60',
    calories: 600,
    prepTime: 12
  },
  {
    id: 'hamburguesa_papas',
    name: 'Hamburguesa con Papas',
    description: 'Carne de res de primera calidad, queso fundido, lechuga, tomate y aderezos en pan brioche artesanal con papas.',
    price: 95,
    category: 'antojitos',
    image: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600&auto=format&fit=crop&q=60',
    calories: 700,
    prepTime: 12
  },
  {
    id: 'quesadillas_jamon_champi',
    name: 'Quesadillas (4 pzas)',
    description: 'Tortillas de harina o maíz rellenas de queso derretido con jamón o champiñones frescos.',
    price: 95,
    category: 'antojitos',
    calories: 480,
    prepTime: 10,
    options: [
      {
        name: 'Ingrediente',
        required: true,
        choices: [
          { name: 'Con Jamón', extraPrice: 0 },
          { name: 'Con Champiñones', extraPrice: 0 },
          { name: 'Combinadas', extraPrice: 0 }
        ]
      },
      {
        name: 'Tortilla',
        required: true,
        choices: [
          { name: 'Harina', extraPrice: 0 },
          { name: 'Maíz', extraPrice: 0 }
        ]
      }
    ]
  },

  // Sopas
  {
    id: 'sopa_del_dia',
    name: 'Sopa del Día o Consomé',
    description: 'Caliente y reconfortante sopa tradicional preparada diariamente por nuestra cocina.',
    price: 60,
    category: 'sopas',
    image: 'https://images.unsplash.com/photo-1547592165-e1d17fed6005?w=600&auto=format&fit=crop&q=60',
    calories: 250,
    prepTime: 8
  },

  // Mariscos
  {
    id: 'coctel_camaron',
    name: 'Coctel de Camarón',
    description: 'Camarones frescos en una salsa especial coctelera de catsup, cilantro, cebolla, aguacate y un toque de limón.',
    price: 190,
    category: 'mariscos',
    popular: true,
    image: 'https://images.unsplash.com/photo-1551248429-40975aa4de74?w=600&auto=format&fit=crop&q=60',
    calories: 350,
    prepTime: 10
  },
  {
    id: 'angeles_caballo',
    name: 'Ángeles a Caballo',
    description: 'Camarones gigantes envueltos en tocino crujiente, rellenos de queso y cocinados a la perfección.',
    price: 220,
    category: 'mariscos',
    image: 'https://images.unsplash.com/photo-1535401991746-da3d9055713e?w=600&auto=format&fit=crop&q=60',
    calories: 450,
    prepTime: 15
  },

  // Carnes y Pollo
  {
    id: 'milanesa_res',
    name: 'Milanesa de Res',
    description: 'Corte delgado de res empanizado y frito, servido con arroz, frijoles refritos y ensalada fresca.',
    price: 130,
    category: 'carnes',
    image: 'https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?w=600&auto=format&fit=crop&q=60',
    calories: 650,
    prepTime: 15
  },
  {
    id: 'tampiquena_res',
    name: 'Tampiqueña de Res',
    description: 'Sabrosa tira de filete de res asada acompañada de una enchilada, guacamole, frijoles y arroz.',
    price: 140,
    category: 'carnes',
    popular: true,
    image: 'https://images.unsplash.com/photo-1544025162-d76694265947?w=600&auto=format&fit=crop&q=60',
    calories: 550,
    prepTime: 18
  },

  // Paninos
  {
    id: 'panino_mexicano',
    name: 'Panino Mexicano',
    description: 'Deliciosa combinación de milanesa de res o pollo, lechuga, tomate fresco, queso derretido y frijolitos untados.',
    price: 130,
    category: 'paninos',
    image: 'https://images.unsplash.com/photo-1509722747041-616f39b57569?w=600&auto=format&fit=crop&q=60',
    calories: 600,
    prepTime: 10,
    options: [
      {
        name: 'Proteína',
        required: true,
        choices: [
          { name: 'Milanesa de Res', extraPrice: 0 },
          { name: 'Milanesa de Pollo', extraPrice: 0 }
        ]
      }
    ]
  },
  {
    id: 'panino_casa',
    name: 'Panino de la Casa',
    description: 'Nuestra especialidad con jugosa arrachera, frijolitos untados, lechuga, jitomate, queso manchego fundido y papas.',
    price: 150,
    category: 'paninos',
    popular: true,
    image: 'https://images.unsplash.com/photo-1553909489-cd47e0907980?w=600&auto=format&fit=crop&q=60',
    calories: 650,
    prepTime: 12
  },

  // Ensaladas
  {
    id: 'ensalada_mediterranea',
    name: 'Ensalada Mediterránea',
    description: 'Cama fresca de lechuga orgánica con manzana crocante, nueces, queso de cabra cremoso y arándanos secos.',
    price: 110,
    category: 'ensaladas',
    image: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=600&auto=format&fit=crop&q=60',
    calories: 280,
    prepTime: 8,
    vegetarian: true
  },

  // Postres
  {
    id: 'flan_vainilla',
    name: 'Flan de Vainilla o Elote',
    description: 'Tradicional postre casero con un suave caramelo dorado. ¡Delicioso!',
    price: 48,
    category: 'postres',
    calories: 250,
    prepTime: 5,
    options: [
      {
        name: 'Sabor',
        required: true,
        choices: [
          { name: 'Vainilla', extraPrice: 0 },
          { name: 'Elote', extraPrice: 0 }
        ]
      }
    ]
  },
  {
    id: 'crepas_dulces',
    name: 'Crepas Dulces',
    description: 'Crepas calientes y delgadas bañadas con el dulce de tu elección.',
    price: 50,
    category: 'postres',
    calories: 300,
    prepTime: 8,
    options: [
      {
        name: 'Sabor Principal',
        required: true,
        choices: [
          { name: 'Nutella', extraPrice: 0 },
          { name: 'Hershey', extraPrice: 0 },
          { name: 'Cajeta', extraPrice: 0 },
          { name: 'Fresa', extraPrice: 0 },
          { name: 'Lechera', extraPrice: 0 },
          { name: 'Zarzamora', extraPrice: 0 }
        ]
      }
    ]
  }
];
