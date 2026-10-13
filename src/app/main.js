import '@/styles/global.css';

import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from '@/app/App.vue';
import router from '@/app/router/index.js';
import { configurarHttp } from '@/services/api/http.js';
import { useAuthStore } from '@/stores/auth.store.js';
import { useUiStore } from '@/stores/ui.store.js';

const app = createApp(App);
const pinia = createPinia();

app.use(pinia);

// O tema é lido antes de montar para a primeira pintura já sair no tema escolhido,
// sem o piscar do tema claro por baixo.
useUiStore().restaurar();

const auth = useAuthStore();
auth.restaurar();

configurarHttp({ authStore: auth, router });

app.use(router);
app.mount('#app');
