<script setup>
import { useRouter } from 'vue-router';
import { ArrowRight, Boxes, ChartNoAxesColumn, CircleDollarSign, Layers3, ShieldCheck, Sparkles } from 'lucide-vue-next';
const props = defineProps({ modulo: {type:String,required:true} });
const router=useRouter();
const detalhe={
  Financeiro:{icone:CircleDollarSign,descricao:'Receitas, custos de viagem, rentabilidade de manifesto e prestação de contas.',etapas:['Fechamento de viagens','Receitas por CT-e e nota fiscal','Custos e margem por operação']},
  Relatórios:{icone:ChartNoAxesColumn,descricao:'Indicadores consolidados, auditoria, produtividade e comparativos da operação.',etapas:['Visão por filial','Relatórios de frota e motoristas','Exportação de indicadores']},
  Configurações:{icone:Layers3,descricao:'Parâmetros gerais, segurança, identidade visual e integrações da plataforma.',etapas:['Configurações por filial','Papéis e permissões','Preferências de sistema']}
};
const atual=detalhe[props.modulo]||detalhe.Configurações;
</script>
<template>
  <section class="future">
    <div class="future__hero"><span class="future__eyebrow"><Sparkles :size="15"/> NOVA ÁREA DE TRABALHO</span><div class="future__symbol"><component :is="atual.icone" :size="35"/></div><h1>{{ modulo }}</h1><p>{{ atual.descricao }}</p><span class="future__status">Estrutura de navegação pronta · Módulo em planejamento</span></div>
    <div class="future__cards"><article v-for="(etapa,i) in atual.etapas" :key="i"><div><b>0{{i+1}}</b><ShieldCheck :size="20"/></div><h2>{{ etapa }}</h2><p>A funcionalidade será integrada ao backend após a definição dos processos.</p></article></div>
    <button type="button" class="future__back" @click="router.push({name:'visao-geral'})">Voltar à visão geral <ArrowRight :size="18"/></button>
  </section>
</template>

<style scoped src="@/styles/pages/shared/future_module_page.css"></style>
