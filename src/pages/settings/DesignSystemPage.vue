<script setup>
import BadgeDeStatus from '@/components/all/ui/StatusBadge.vue';
import BarraDeProgresso from '@/components/all/ui/ProgressBar.vue';
import EstadoVazio from '@/components/all/ui/EmptyState.vue';
import PainelCard from '@/components/all/ui/BaseCard.vue';
import TabelaDoPainel from '@/components/all/tables/BaseTable.vue';
import TileKpi from '@/components/all/ui/KpiTile.vue';
import { useUiStore } from '@/stores/ui.store.js';

const ui = useUiStore();

const COLUNAS = [
    { chave: 'componente', rotulo: 'Componente', largura: '180px' },
    { chave: 'uso', rotulo: 'Onde aparece' },
    { chave: 'tom', rotulo: 'Tom', largura: '120px', alinhamento: 'right' },
];

const TONS = ['ok', 'warn', 'bad', 'info'];
</script>

<template>
    <section class="amostras">
        <header class="amostras__cabecalho">
            <h1 class="amostras__titulo">Componentes do painel</h1>
            <button type="button" class="amostras__botao" @click="ui.alternarTema()">
                Ver no tema {{ ui.tema === 'escuro' ? 'claro' : 'escuro' }}
            </button>
        </header>

        <div class="amostras__tiles">
            <TileKpi rotulo="Manifestos em viagem" valor="18" complemento="4 filiais" />
            <TileKpi rotulo="Divergências abertas" valor="3" tom="bad" complemento="aguardando decisão" como-botao />
            <TileKpi rotulo="Entregas concluídas" valor="127" tom="ok" complemento="hoje" />
        </div>

        <PainelCard titulo="Barras de progresso">
            <div v-for="tom in TONS" :key="tom" class="amostras__linha">
                <span class="amostras__rotulo">{{ tom }}</span>
                <BarraDeProgresso :valor="TONS.indexOf(tom) + 1" :total="TONS.length" :tom="tom" />
            </div>
        </PainelCard>

        <PainelCard titulo="Badges de status">
            <div class="amostras__badges">
                <BadgeDeStatus v-for="tom in TONS" :key="tom" :rotulo="tom" :tom="tom" />
            </div>
        </PainelCard>

        <TabelaDoPainel :colunas="COLUNAS" :largura-minima="520" altura-maxima="260px">
            <tr v-for="tom in TONS" :key="tom">
                <td>BadgeDeStatus</td>
                <td>Tabelas e cartões do painel</td>
                <td style="text-align: right"><BadgeDeStatus :rotulo="tom" :tom="tom" /></td>
            </tr>
        </TabelaDoPainel>

        <PainelCard titulo="Estado vazio">
            <EstadoVazio mensagem="Nenhum manifesto neste filtro." tracejado />
        </PainelCard>
    </section>
</template>

<style scoped src="@/styles/pages/settings/design_system_page.css"></style>
