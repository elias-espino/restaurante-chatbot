const { PrismaClient } = require('@prisma/client');
const { success, error } = require('../utils/response');
const logger = require('../utils/logger');

const prisma = new PrismaClient();

// ── CATEGORÍAS ──────────────────────────────────────────────

const getCategories = async (req, res) => {
  try {
    const categories = await prisma.category.findMany({
      where: { restaurantId: req.restaurantId, isActive: true },
      include: {
        items: {
          where: { isActive: true },
          orderBy: { sortOrder: 'asc' },
        },
      },
      orderBy: { sortOrder: 'asc' },
    });
    return success(res, categories);
  } catch (err) {
    logger.error('getCategories:', err);
    return error(res, 'Error al obtener categorías', 500);
  }
};

const createCategory = async (req, res) => {
  try {
    const { name, emoji, sortOrder } = req.body;
    if (!name) return error(res, 'Nombre requerido', 400);

    const category = await prisma.category.create({
      data: { restaurantId: req.restaurantId, name, emoji, sortOrder: sortOrder || 0 },
    });
    return success(res, category, 'Categoría creada', 201);
  } catch (err) {
    logger.error('createCategory:', err);
    return error(res, 'Error al crear categoría', 500);
  }
};

const updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, emoji, sortOrder, isActive } = req.body;

    const category = await prisma.category.findFirst({
      where: { id, restaurantId: req.restaurantId },
    });
    if (!category) return error(res, 'Categoría no encontrada', 404);

    const updated = await prisma.category.update({
      where: { id },
      data: { name, emoji, sortOrder, isActive },
    });
    return success(res, updated, 'Categoría actualizada');
  } catch (err) {
    logger.error('updateCategory:', err);
    return error(res, 'Error al actualizar categoría', 500);
  }
};

const deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.category.update({
      where: { id },
      data: { isActive: false },
    });
    return success(res, {}, 'Categoría eliminada');
  } catch (err) {
    return error(res, 'Error al eliminar categoría', 500);
  }
};

// ── ITEMS ───────────────────────────────────────────────────

const getItems = async (req, res) => {
  try {
    const { categoryId, available } = req.query;
    const where = { restaurantId: req.restaurantId, isActive: true };
    if (categoryId) where.categoryId = categoryId;
    if (available === 'true') where.isAvailable = true;

    const items = await prisma.menuItem.findMany({
      where,
      include: {
        category: { select: { id: true, name: true, emoji: true } },
        printer: { select: { id: true, name: true } },
      },
      orderBy: [{ categoryId: 'asc' }, { sortOrder: 'asc' }],
    });
    return success(res, items);
  } catch (err) {
    logger.error('getItems:', err);
    return error(res, 'Error al obtener items', 500);
  }
};

const createItem = async (req, res) => {
  try {
    const { categoryId, name, description, price, imageUrl, options, sortOrder, printerId } = req.body;
    if (!categoryId || !name || price === undefined) {
      return error(res, 'categoryId, name y price son requeridos', 400);
    }

    const category = await prisma.category.findFirst({
      where: { id: categoryId, restaurantId: req.restaurantId },
    });
    if (!category) return error(res, 'Categoría no encontrada', 404);

    // Validar que la impresora pertenece al restaurante (si se especificó)
    if (printerId) {
      const printer = await prisma.printer.findFirst({
        where: { id: printerId, restaurantId: req.restaurantId },
      });
      if (!printer) return error(res, 'Impresora no encontrada', 404);
    }

    const item = await prisma.menuItem.create({
      data: {
        restaurantId: req.restaurantId,
        categoryId,
        name,
        description,
        price,
        imageUrl,
        options,
        sortOrder: sortOrder || 0,
        printerId: printerId || null,
      },
      include: {
        category: { select: { id: true, name: true, emoji: true } },
        printer: { select: { id: true, name: true } },
      },
    });
    return success(res, item, 'Item creado', 201);
  } catch (err) {
    logger.error('createItem:', err);
    return error(res, 'Error al crear item', 500);
  }
};

const updateItem = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, price, imageUrl, options, sortOrder, isAvailable, categoryId, printerId } = req.body;

    const item = await prisma.menuItem.findFirst({
      where: { id, restaurantId: req.restaurantId },
    });
    if (!item) return error(res, 'Item no encontrado', 404);

    // Validar impresora si se especificó
    if (printerId !== undefined && printerId !== null) {
      const printer = await prisma.printer.findFirst({
        where: { id: printerId, restaurantId: req.restaurantId },
      });
      if (!printer) return error(res, 'Impresora no encontrada', 404);
    }

    const data = {};
    if (name !== undefined) data.name = name;
    if (description !== undefined) data.description = description;
    if (price !== undefined) data.price = price;
    if (imageUrl !== undefined) data.imageUrl = imageUrl;
    if (options !== undefined) data.options = options;
    if (sortOrder !== undefined) data.sortOrder = sortOrder;
    if (isAvailable !== undefined) data.isAvailable = isAvailable;
    if (categoryId !== undefined) data.categoryId = categoryId;
    data.printerId = printerId ?? null;

    const updated = await prisma.menuItem.update({
      where: { id },
      data,
      include: {
        category: { select: { id: true, name: true, emoji: true } },
        printer: { select: { id: true, name: true } },
      },
    });
    return success(res, updated, 'Item actualizado');
  } catch (err) {
    logger.error('updateItem:', err);
    return error(res, 'Error al actualizar item', 500);
  }
};

const toggleAvailability = async (req, res) => {
  try {
    const { id } = req.params;
    const item = await prisma.menuItem.findFirst({
      where: { id, restaurantId: req.restaurantId },
    });
    if (!item) return error(res, 'Item no encontrado', 404);

    const updated = await prisma.menuItem.update({
      where: { id },
      data: { isAvailable: !item.isAvailable },
    });
    return success(res, updated, `Item ${updated.isAvailable ? 'disponible' : 'no disponible'}`);
  } catch (err) {
    return error(res, 'Error al cambiar disponibilidad', 500);
  }
};

const deleteItem = async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.menuItem.update({ where: { id }, data: { isActive: false } });
    return success(res, {}, 'Item eliminado');
  } catch (err) {
    return error(res, 'Error al eliminar item', 500);
  }
};

// Menú público para el bot (sin autenticación)
const getPublicMenu = async (req, res) => {
  try {
    const { restaurantId } = req.params;
    const categories = await prisma.category.findMany({
      where: { restaurantId, isActive: true },
      include: {
        items: {
          where: { isActive: true, isAvailable: true },
          orderBy: { sortOrder: 'asc' },
          select: { id: true, name: true, description: true, price: true, options: true },
        },
      },
      orderBy: { sortOrder: 'asc' },
    });
    return success(res, categories);
  } catch (err) {
    return error(res, 'Error al obtener menú', 500);
  }
};

module.exports = {
  getCategories, createCategory, updateCategory, deleteCategory,
  getItems, createItem, updateItem, toggleAvailability, deleteItem,
  getPublicMenu,
};
