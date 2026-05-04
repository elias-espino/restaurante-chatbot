const { GoogleGenerativeAI } = require('@google/generative-ai');
const { PrismaClient } = require('@prisma/client');
const logger = require('../utils/logger');

const prisma = new PrismaClient();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY, {
  httpOptions: {
    headers: {
      Referer: `https://${process.env.APP_DOMAIN || 'app.espino-software.online'}/`,
    },
  },
});

// ─────────────────────────────────────────────
// Construir system prompt dinámico con el menú
// ─────────────────────────────────────────────
const buildSystemPrompt = (restaurant, menu, config, currentOrder = null) => {
  const personality = restaurant.aiPersonality ||
    'Sé amigable, servicial y usa algunos emojis. Mantén respuestas cortas y claras.';

  const menuText = menu.map(cat =>
    `### ${cat.emoji ? cat.emoji + ' ' : ''}${cat.name}\n` +
    cat.items.map(item =>
      `- [ID: ${item.id}] ${item.name} — ${restaurant.currency} ${Number(item.price).toFixed(2)}` +
      (item.description ? ` | ${item.description}` : '')
    ).join('\n')
  ).join('\n\n');

  const orderSection = currentOrder ? `
## ORDEN ACTIVA (puede modificarse aún)
Número: #${currentOrder.orderNumber}
Estado: ${currentOrder.status}
Items actuales:
${currentOrder.items.map(i => `- ${i.name} x${i.quantity} — ${restaurant.currency} ${Number(i.price).toFixed(2)}`).join('\n')}
Tipo: ${currentOrder.serviceType}
${currentOrder.deliveryAddress ? `Dirección: ${currentOrder.deliveryAddress}` : ''}
` : '';

  return `Eres el asistente de WhatsApp de *${restaurant.name}*.
Tu trabajo es tomar pedidos de comida de manera natural y conversacional.

## PERSONALIDAD
${personality}

## IDIOMA
Responde siempre en español, a menos que el cliente te escriba en otro idioma.

## MENÚ DISPONIBLE
Solo puedes vender items de este menú. No inventes productos ni precios.
${menuText}

## REGLAS IMPORTANTES
1. Si el cliente menciona un item ambiguo (ej: "una agua" cuando hay varios tipos), PREGUNTA cuál quiere.
2. Nunca confirmes una orden sin antes mostrar el resumen completo con precios y total.
3. OBLIGATORIO: Antes de emitir el bloque ---ACTION--- de una orden nueva, DEBES tener el nombre del cliente. Si no lo sabes, pregúntalo antes de confirmar. Ejemplo: "¿Me das tu nombre para la orden? 😊". Sin nombre no puedes confirmar.
4. Cuando el cliente confirme la orden Y ya tienes su nombre, incluye el bloque ---ACTION--- con el JSON exacto.
5. Si ya hay una orden activa y el cliente quiere modificar, usa action "modify_order".
6. Si la orden ya está en PREPARING o más avanzado, informa que ya no se puede modificar.
7. Moneda del restaurante: ${restaurant.currency}
8. CANTIDADES: Cada item debe aparecer UNA SOLA VEZ en el array "items" con su cantidad en el campo "quantity". NUNCA repitas el mismo menuItemId en dos entradas distintas. Si el cliente pide 2 sodas, el resultado correcto es: {"menuItemId":"xxx","name":"Soda","price":35,"quantity":2}. El resultado INCORRECTO sería dos entradas separadas con quantity:1.
9. NOMBRE DEL PRODUCTO EN LA ORDEN: El campo "name" del item SIEMPRE debe ser el nombre EXACTO del producto en el menú. Si el producto tiene variantes listadas en su descripción (ej: descripción dice "Coca-Cola, Sprite, Fanta"), DEBES preguntar al cliente cuál variante quiere ANTES de confirmar, y luego incluir la variante en el nombre así: "Refresco (Coca-Cola)". Nunca abrevies ni cambies el nombre base del menú.
10. OBSERVACIONES POR ITEM: Si el cliente indica algo especial para un producto (ej: "sin cebolla", "término medio", "sin picante", "extra salsa", "sin hielo"), captúralo en el campo "notes" de ese item. Si aplica a todos los items, ponlo en cada uno que corresponda. Si no hay observaciones, omite el campo "notes" o ponlo en null.
11. ESCALACIÓN: Si el cliente pregunta algo que no puedes responder con seguridad (quejas, situaciones especiales, preguntas sobre alérgenos específicos, solicitudes fuera del menú, problemas con órdenes previas, o cualquier tema que requiera criterio humano), debes escalar al equipo del restaurante. En ese caso, avisa al cliente que avisaste al equipo y usa el bloque ---ACTION--- con action "escalate_to_human".
${orderSection}

## FORMATO DE RESPUESTA AL CONFIRMAR O MODIFICAR UNA ORDEN
Cuando el cliente confirme una orden nueva, responde normalmente y agrega al final:

---ACTION---
{
  "action": "place_order",
  "customerName": "nombre del cliente",
  "serviceType": "DINE_IN" | "TAKEAWAY" | "DELIVERY",
  "tableNumber": "número de mesa o null",
  "deliveryAddress": "dirección o null",
  "items": [
    { "menuItemId": "id exacto del item", "name": "nombre", "price": precio_numerico, "quantity": cantidad, "notes": "observaciones del cliente o null" }
  ]
}

IMPORTANTE sobre items: cada menuItemId debe aparecer solo una vez. Agrupa las unidades en "quantity". Incluye "notes" solo si el cliente indicó algo especial para ese item.

Cuando el cliente quiera modificar una orden existente:

---ACTION---
{
  "action": "modify_order",
  "orderId": "${currentOrder?.id || 'id_de_la_orden'}",
  "items": [
    { "menuItemId": "id exacto", "name": "nombre", "price": precio_numerico, "quantity": cantidad, "notes": "observaciones o null" }
  ],
  "deliveryAddress": "nueva dirección o null si no cambia"
}

IMPORTANTE: El bloque ---ACTION--- es solo para el sistema. El cliente NO lo ve. Escribe primero tu mensaje al cliente y luego el bloque.

Cuando necesites escalar a un humano:

---ACTION---
{
  "action": "escalate_to_human",
  "question": "descripción clara de lo que el cliente necesita, en una oración"
}`;

};

// ─────────────────────────────────────────────
// Cargar menú completo del restaurante
// ─────────────────────────────────────────────
const loadMenu = async (restaurantId) => {
  return prisma.category.findMany({
    where: { restaurantId, isActive: true },
    include: {
      items: {
        where: { isActive: true, isAvailable: true },
        orderBy: { sortOrder: 'asc' },
        select: { id: true, name: true, description: true, price: true },
      },
    },
    orderBy: { sortOrder: 'asc' },
  });
};

// ─────────────────────────────────────────────
// Parsear respuesta — separa mensaje del ACTION
// ─────────────────────────────────────────────
const parseResponse = (rawText) => {
  const [messagePart, actionPart] = rawText.split('---ACTION---');
  const message = messagePart.trim();

  let action = null;
  if (actionPart) {
    try {
      const jsonMatch = actionPart.match(/\{[\s\S]*\}/);
      if (jsonMatch) action = JSON.parse(jsonMatch[0]);
    } catch (err) {
      logger.error('[Gemini] Error parseando ACTION JSON:', err.message);
    }
  }

  return { message, action };
};

// ─────────────────────────────────────────────
// Llamada principal a Gemini
// ─────────────────────────────────────────────
const chat = async ({ restaurant, whatsappConfig, conversationHistory, newMessage, currentOrder }) => {
  try {
    const menu = await loadMenu(restaurant.id);

    const systemPrompt = buildSystemPrompt(restaurant, menu, whatsappConfig, currentOrder);

    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      systemInstruction: systemPrompt,
    });

    // Convertir historial al formato de Gemini
    const history = conversationHistory.map(msg => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }],
    }));

    const chatSession = model.startChat({ history });

    const result = await chatSession.sendMessage(newMessage);
    const rawText = result.response.text();

    logger.info(`[Gemini] Restaurante ${restaurant.id} | Tokens: input=${result.response.usageMetadata?.promptTokenCount} output=${result.response.usageMetadata?.candidatesTokenCount}`);

    return parseResponse(rawText);
  } catch (err) {
    logger.error('[Gemini] Error en chat:', err.message);
    throw err;
  }
};

module.exports = { chat };
