const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

exports.createStripePaymentIntent = functions.https.onCall(async (data, context) => {
  try {
    const { total, stripeAccountId, returnUrl, ticketId } = data;

    if (!total || total <= 0) {
      throw new functions.https.HttpsError('invalid-argument', 'El total debe ser mayor a 0');
    }

    if (!returnUrl || !ticketId) {
      throw new functions.https.HttpsError('invalid-argument', 'Faltan parámetros de redirección');
    }

    const amountInCents = Math.round(total * 100);

    const sessionConfig = {
      line_items: [
        {
          price_data: {
            currency: 'eur',
            product_data: {
              name: 'Pedido de comida - Asador',
            },
            unit_amount: amountInCents,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: returnUrl.includes('?') 
        ? `${returnUrl}&success=true&ticketId=${ticketId}` 
        : `${returnUrl}?success=true&ticketId=${ticketId}`,
      cancel_url: returnUrl.includes('?') 
        ? `${returnUrl}&cancel=true&ticketId=${ticketId}`
        : `${returnUrl}?cancel=true&ticketId=${ticketId}`,
      client_reference_id: ticketId,
    };

    let session;

    if (stripeAccountId) {
      session = await stripe.checkout.sessions.create(sessionConfig, {
        stripeAccount: stripeAccountId,
      });
    } else {
      session = await stripe.checkout.sessions.create(sessionConfig);
    }

    return {
      url: session.url,
    };
  } catch (error) {
    console.error('Error creando Checkout Session:', error);
    throw new functions.https.HttpsError('internal', 'Error al procesar el pago.');
  }
});

exports.markOrderAsPaid = functions.https.onCall(async (data, context) => {
  const { ticketId } = data;
  if (!ticketId) throw new functions.https.HttpsError('invalid-argument', 'Falta el ID del ticket');
  try {
    await admin.firestore().collection('pedidos').doc(ticketId).update({
      cobrado: true,
      metodoPago: 'stripe'
    });
    return { success: true };
  } catch (error) {
    console.error('Error actualizando pedido:', error);
    throw new functions.https.HttpsError('internal', 'Error al actualizar pedido');
  }
});

// Endpoint del Webhook oficial de Stripe
exports.stripeWebhook = functions.https.onRequest(async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.rawBody, 
      sig, 
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error(`Webhook Error: ${err.message}`);
    res.status(400).send(`Webhook Error: ${err.message}`);
    return;
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const ticketId = session.client_reference_id;

    if (ticketId) {
      try {
        await admin.firestore().collection('pedidos').doc(ticketId).update({
          cobrado: true,
          metodoPago: 'stripe'
        });
        console.log(`Pedido ${ticketId} marcado como cobrado exitosamente desde Webhook.`);
      } catch (error) {
        console.error('Error actualizando pedido desde webhook:', error);
      }
    }
  }

  res.json({ received: true });
});

