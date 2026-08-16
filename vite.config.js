import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const authHost = env.VITE_FIREBASE_AUTH_DOMAIN || 'classhub-40881.firebaseapp.com'
  const authProxy = {
    '/__/auth': {
      target: `https://${authHost}`,
      changeOrigin: true,
      secure: true,
    },
    '/__/firebase': {
      target: `https://${authHost}`,
      changeOrigin: true,
      secure: true,
    },
  }

  return {
    plugins: [react()],
    server: { proxy: authProxy },
    preview: { proxy: authProxy },
  }
})
