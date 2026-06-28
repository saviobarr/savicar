import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    allowedHosts: ['all', 'www.savicar.com.br', ' 1790-200-50-219-64.ngrok-free.app'],
    proxy: {
      // Forward all API calls to the local Go backend.
      // This means the browser only needs to reach the Vite (ngrok) origin —
      // the Go server never has to be exposed externally.
      '^/(auth|service-orders|service-order-images|service-order-products|service-order-payments|services|payment-methods|payments|technicians|customers|contacts|customer-models|makes|fuels|models|countries|states|cities|unities|inventory|product-images|resources|appointments|appointment-resources|operational-costs|cost-categories|reports|tenant-config|whatsapp|users|audit)': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        secure: false,
        bypass(req) {
          // Browser navigation requests must be served by the SPA, not proxied.
          if (req.headers.accept?.includes('text/html')) return '/index.html'
        },
      },
    },
  },
})
