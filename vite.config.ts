import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import tailwindcss from '@tailwindcss/vite';
import Icons from 'unplugin-icons/vite';

export default defineConfig({
  // Icons are resolved at build time from @iconify-json/heroicons and inlined as
  // Vue components, so only the ones actually imported reach the bundle — no runtime
  // and no request to the Iconify API.
  plugins: [vue(), tailwindcss(), Icons({ compiler: 'vue3' })],
});
