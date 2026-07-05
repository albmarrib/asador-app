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
      payment_method_types: ['card'], // Incluye Apple Pay y Google Pay en Checkout
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
      success_url: `${returnUrl}?success=true&ticketId=${ticketId}`,
      cancel_url: `${returnUrl}?cancel=true&ticketId=${ticketId}`,
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
