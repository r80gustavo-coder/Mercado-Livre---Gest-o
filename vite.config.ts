
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Carrega variáveis de ambiente baseadas no modo (development/production)
  const env = loadEnv(mode, (process as any).cwd(), '');

  return {
    plugins: [react()],
    // Importante: Permite que o código acesse variáveis que começam com NEXT_PUBLIC_
    envPrefix: ['VITE_', 'NEXT_PUBLIC_', 'API_KEY'],
    define: {
      // Polyfill para garantir compatibilidade com bibliotecas que usam process.env
      'process.env': env
    }
  };
});
