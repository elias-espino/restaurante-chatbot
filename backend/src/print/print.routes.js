const router = require('express').Router();
const { PrismaClient } = require('@prisma/client');
const { authenticate, authorize } = require('../middleware/auth');
const { flushPendingJobs } = require('./print.service');
const { success, error } = require('../utils/response');

const prisma = new PrismaClient();

router.use(authenticate);

// Obtener impresoras del restaurante
router.get('/printers', async (req, res) => {
  try {
    const printers = await prisma.printer.findMany({
      where: { restaurantId: req.restaurantId },
    });
    return success(res, printers);
  } catch (err) {
    return error(res, 'Error al obtener impresoras', 500);
  }
});

// Crear impresora
router.post('/printers', authorize('ADMIN'), async (req, res) => {
  try {
    const { name, type, host, port } = req.body;
    const printer = await prisma.printer.create({
      data: { restaurantId: req.restaurantId, name, type: type || 'USB', host, port },
    });
    return success(res, printer, 'Impresora creada', 201);
  } catch (err) {
    return error(res, 'Error al crear impresora', 500);
  }
});

// Ver jobs de impresión
router.get('/jobs', async (req, res) => {
  try {
    const jobs = await prisma.printJob.findMany({
      where: { restaurantId: req.restaurantId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return success(res, jobs);
  } catch (err) {
    return error(res, 'Error al obtener jobs', 500);
  }
});

// Eliminar impresora
router.delete('/printers/:id', authorize('ADMIN'), async (req, res) => {
  try {
    const printer = await prisma.printer.findFirst({
      where: { id: req.params.id, restaurantId: req.restaurantId },
    });
    if (!printer) return error(res, 'Impresora no encontrada', 404);
    await prisma.printJob.deleteMany({ where: { printerId: req.params.id } });
    await prisma.printer.delete({ where: { id: req.params.id } });
    return success(res, {}, 'Impresora eliminada');
  } catch (err) {
    return error(res, 'Error al eliminar impresora', 500);
  }
});

// Reencolar jobs de una impresora
router.post('/printers/:id/flush', authorize('ADMIN', 'STAFF'), async (req, res) => {
  try {
    await flushPendingJobs(req.params.id);
    return success(res, {}, 'Jobs reencolados');
  } catch (err) {
    return error(res, 'Error al reencolar', 500);
  }
});

module.exports = router;
