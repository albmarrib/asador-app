import React, { useState } from 'react';
import {
  PaymentElement,
  useStripe,
  useElements
} from '@stripe/react-stripe-js';

export default function StripeCheckout({ onPagoExitoso, onVolver, montoTotal }) {
  const stripe = useStripe();
  const elements = useElements();
  const [errorMessage, setErrorMessage] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setIsProcessing(true);

    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      redirect: 'if_required', // No redirigir de página completa si se puede evitar
      confirmParams: {
        // En una app real de producción aquí podrías poner la URL de retorno
        // return_url: window.location.origin + '/pago-completado',
      },
    });

    if (error) {
      setErrorMessage(error.message);
      setIsProcessing(false);
    } else if (paymentIntent && paymentIntent.status === 'succeeded') {
      setIsProcessing(false);
      onPagoExitoso(paymentIntent);
    }
  };

  return (
    <div className="bg-white rounded-3xl p-6 shadow-xl border border-orange-100 max-w-md w-full text-center space-y-6">
      <h3 className="text-xl font-black text-slate-800">Finalizar Pago</h3>
      <p className="text-slate-500 text-sm">Total a pagar: <span className="font-bold text-orange-600">{montoTotal.toFixed(2)}€</span></p>
      
      <form onSubmit={handleSubmit} className="space-y-6 text-left">
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 min-h-[60px]">
          <PaymentElement />
        </div>
        
        {errorMessage && (
          <div className="text-red-500 text-sm bg-red-50 p-3 rounded-lg text-center">
            {errorMessage}
          </div>
        )}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onVolver}
            disabled={isProcessing}
            className="flex-1 py-4 font-bold rounded-2xl bg-slate-100 text-slate-600 hover:bg-slate-200 transition-all"
          >
            Volver
          </button>
          
          <button
            type="submit"
            disabled={!stripe || isProcessing}
            className="flex-1 py-4 font-black rounded-2xl bg-orange-500 text-white shadow-lg shadow-orange-500/30 hover:bg-orange-600 transition-all disabled:opacity-50"
          >
            {isProcessing ? 'Procesando...' : `Pagar ${montoTotal.toFixed(2)}€`}
          </button>
        </div>
      </form>
    </div>
  );
}
