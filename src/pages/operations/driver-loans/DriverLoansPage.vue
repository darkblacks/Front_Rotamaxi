<script setup>
import { useRouter } from 'vue-router';
import { ArrowRight, ArrowRightLeft, CircleAlert, ShieldCheck, Truck } from 'lucide-vue-next';
const router=useRouter();
</script>
<template>
  <section class="emp-real">
    <div class="emp-real__hero">
      <div class="emp-real__icone"><ArrowRightLeft :size="28"/></div>
      <small>OPERAÇÕES · CONTROLE DE MOTORISTAS</small>
      <h1>Empréstimos entre filiais</h1>
      <p>Solicitações, aprovações e encerramentos precisam de registro e validação no servidor. O fluxo de simulação no navegador foi desativado para não gerar falsas autorizações.</p>
      <div class="emp-real__alerta"><CircleAlert :size="20"/><span><b>Operação ainda indisponível.</b> O backend atual de cadastros não fornece endpoints de aprovação de empréstimos. Nenhuma solicitação local será tratada como válida.</span></div>
      <button class="emp-real__botao" type="button" @click="router.push({name:'cadastros-item',params:{tipo:'pessoas'},query:{aba:'motoristas'}})"><Truck :size="17"/> Consultar motoristas cadastrados <ArrowRight :size="17"/></button>
    </div>
    <div class="emp-real__rodape"><ShieldCheck :size="17"/> Pessoas e matrizes agora são registros reais no RotaMaxi; esta operação somente será habilitada quando existirem permissões e histórico transacional no backend.</div>
  </section>
</template>

<style scoped src="@/styles/pages/operations/driver-loans/driver_loans_page.css"></style>
