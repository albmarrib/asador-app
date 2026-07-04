const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

exports.createStripePaymentIntent = functions.https.onCall(async (data, context) => {
  try {
    const { total, stripeAccountId } = data;

    if (!total || total <= 0) {
      throw new functions.https.HttpsError('invalid-argument', 'El total debe ser mayor a 0');
    }

    // Stripe expects amount in cents
    const amountInCents = Math.round(total * 100);

    const paymentIntentConfig = {
      amount: amountInCents,
      currency: 'eur',
      payment_method_types: ['card'],
      // For future SaaS commission, you could add:
      // application_fee_amount: 100, // 1€ in cents
    };

    let paymentIntent;

    // Si pasamos el ID de la cuenta conectada del asador, hacemos un Direct Charge (el dinero va a él).
    // Si no, lo hacemos en la cuenta principal de la plataforma (útil para pruebas antes de conectar al asador).
    if (stripeAccountId) {
      paymentIntent = await stripe.paymentIntents.create(paymentIntentConfig, {
        stripeAccount: stripeAccountId,
      });
    } else {
      paymentIntent = await stripe.paymentIntents.create(paymentIntentConfig);
    }

    return {
      clientSecret: paymentIntent.client_secret,
    };
  } catch (error) {
    console.error('Error creando PaymentIntent:', error);
    throw new functions.https.HttpsError('internal', 'Error al procesar el pago.');
  }
});
