<script setup>
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import CadastrosPage from '@/pages/registrations/RegistrationsWorkspacePage.vue';
import FrotaCentralPage from '@/pages/registrations/vehicles/FleetPage.vue';
import { ehCentralDeFrota } from '@/domain/vehicles/fleet-model.js';

/**
 * /painel/cadastros/:tipo. Veículos (aba "placas") abre a Central de Frota; todo o resto
 * — marcas, modelos, tipos e a lista clássica com `classe` — segue na CadastrosPage.
 */
const route = useRoute();
const central = computed(() => ehCentralDeFrota(route.params.tipo, route.query));
</script>

<template>
    <FrotaCentralPage v-if="central" />
    <CadastrosPage v-else />
</template>

<style scoped src="@/styles/pages/registrations/registrations_root_page.css"></style>
