const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando seed...');

  // Restaurante de ejemplo
  const restaurant = await prisma.restaurant.upsert({
    where: { slug: 'restaurante-demo' },
    update: {},
    create: {
      id: 'demo-restaurant-id',
      name: 'Restaurante Demo',
      slug: 'restaurante-demo',
      address: 'Calle Principal 123',
      phone: '+521234567890',
      currency: 'MXN',
      timezone: 'America/Mexico_City',
    },
  });

  // Horarios (Lun-Sab 8am-10pm, Dom cerrado)
  for (let day = 0; day <= 6; day++) {
    await prisma.restaurantSchedule.upsert({
      where: { restaurantId_dayOfWeek: { restaurantId: restaurant.id, dayOfWeek: day } },
      update: {},
      create: {
        restaurantId: restaurant.id,
        dayOfWeek: day,
        openTime: '08:00',
        closeTime: '22:00',
        isOpen: day !== 0, // Domingo cerrado
      },
    });
  }

  // Configuración WhatsApp (placeholder)
  await prisma.whatsappConfig.upsert({
    where: { restaurantId: restaurant.id },
    update: {},
    create: {
      restaurantId: restaurant.id,
      phoneNumberId: 'TU_PHONE_NUMBER_ID',
      phoneNumber: '+521234567890',
      accessToken: 'TU_ACCESS_TOKEN',
      webhookVerifyToken: 'mi-token-secreto-demo-' + uuidv4().slice(0, 8),
      welcomeMessage: '¡Hola! Bienvenido a Restaurante Demo 🍽️ ¿Qué te gustaría ordenar hoy?',
    },
  });

  // Impresora USB
  await prisma.printer.create({
    data: {
      restaurantId: restaurant.id,
      name: 'Cocina Principal',
      type: 'USB',
    },
  }).catch(() => {}); // Ignorar si ya existe

  // Mesas
  for (let i = 1; i <= 10; i++) {
    await prisma.table.upsert({
      where: { restaurantId_number: { restaurantId: restaurant.id, number: String(i) } },
      update: {},
      create: { restaurantId: restaurant.id, number: String(i), capacity: 4 },
    });
  }

  // Categorías
  const categoriesData = [
    { name: 'Entradas', emoji: '🥗', sortOrder: 1 },
    { name: 'Platos Fuertes', emoji: '🍽️', sortOrder: 2 },
    { name: 'Bebidas', emoji: '🥤', sortOrder: 3 },
    { name: 'Postres', emoji: '🍰', sortOrder: 4 },
  ];

  const categories = {};
  for (const cat of categoriesData) {
    const c = await prisma.category.create({
      data: { restaurantId: restaurant.id, ...cat },
    }).catch(async () => {
      return prisma.category.findFirst({ where: { restaurantId: restaurant.id, name: cat.name } });
    });
    categories[cat.name] = c;
  }

  // Items del menú
  const menuItems = [
    { category: 'Entradas', name: 'Ensalada César', description: 'Lechuga romana, crutones, parmesano', price: 89 },
    { category: 'Entradas', name: 'Sopa del día', description: 'Pregunta al mesero por la sopa de hoy', price: 65 },
    { category: 'Entradas', name: 'Guacamole', description: 'Con totopos artesanales', price: 79 },
    { category: 'Platos Fuertes', name: 'Pollo a la plancha', description: 'Con verduras salteadas y arroz', price: 145 },
    { category: 'Platos Fuertes', name: 'Filete de res', description: '250g con papas y ensalada', price: 220 },
    { category: 'Platos Fuertes', name: 'Pasta Alfredo', description: 'Pasta fresca con salsa cremosa', price: 130 },
    { category: 'Platos Fuertes', name: 'Tacos de carnitas', description: '3 tacos con salsa, cebolla y cilantro', price: 110 },
    { category: 'Bebidas', name: 'Refresco', description: 'Coca-Cola, Sprite, Fanta', price: 35 },
    { category: 'Bebidas', name: 'Agua fresca', description: 'Jamaica, Horchata o Limón', price: 30 },
    { category: 'Bebidas', name: 'Cerveza', description: 'Nacional 355ml', price: 55 },
    { category: 'Bebidas', name: 'Café americano', description: 'Grano de origen local', price: 45 },
    { category: 'Postres', name: 'Flan napolitano', description: 'Con caramelo y crema', price: 65 },
    { category: 'Postres', name: 'Pastel de chocolate', description: 'Brownie caliente con helado', price: 85 },
  ];

  for (const item of menuItems) {
    const cat = categories[item.category];
    if (cat) {
      await prisma.menuItem.create({
        data: {
          restaurantId: restaurant.id,
          categoryId: cat.id,
          name: item.name,
          description: item.description,
          price: item.price,
        },
      }).catch(() => {});
    }
  }

  // Usuario admin
  const hashedPassword = await bcrypt.hash('admin123', 10);
  await prisma.user.upsert({
    where: { restaurantId_email: { restaurantId: restaurant.id, email: 'admin@demo.com' } },
    update: {},
    create: {
      restaurantId: restaurant.id,
      name: 'Administrador',
      email: 'admin@demo.com',
      password: hashedPassword,
      role: 'ADMIN',
    },
  });

  console.log('✅ Seed completado');
  console.log('   Restaurante:', restaurant.name, '(slug:', restaurant.slug + ')');
  console.log('   Admin login: admin@demo.com / admin123');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
