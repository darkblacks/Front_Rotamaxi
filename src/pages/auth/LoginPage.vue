<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { MENSAGEM_SEM_PERMISSAO, MENSAGEM_SESSAO_ENCERRADA, useAuthStore } from '@/stores/auth.store.js';
import logoSimbolo from '@/assets/images/brand/rotamaxi-simbolo.png';
import pista from '@/assets/images/brand/rotamaxi-pista.png';
import { ArrowRight, Eye, EyeOff, Fingerprint, LockKeyhole, PackageCheck, ShieldCheck, Truck, UserRound, ChartNoAxesColumn } from 'lucide-vue-next';
const mostrarPin = ref(false);

const auth = useAuthStore();
const route = useRoute();
const router = useRouter();

const cpf = ref('');
const pin = ref('');
const erro = ref('');
const errosDeCampo = ref({});
const segundosBloqueado = ref(0);

let temporizador = null;

const bloqueado = computed(() => segundosBloqueado.value > 0);
const podeEnviar = computed(() => ! auth.entrando && ! bloqueado.value && somenteDigitos(cpf.value).length === 11 && pin.value.length === 6);

/**
 * Motivos que o guard de rota anexa ao voltar para cá. Sem isso o usuário seria devolvido
 * ao login sem explicação nenhuma.
 */
const MOTIVOS = {
    'sem-permissao': MENSAGEM_SEM_PERMISSAO,
    'sessao-encerrada': MENSAGEM_SESSAO_ENCERRADA,
};

onMounted(() => {
    const motivo = route.query.motivo;

    if (typeof motivo === 'string' && motivo in MOTIVOS) {
        erro.value = MOTIVOS[motivo];
    }
});

onBeforeUnmount(() => {
    pararContagem();
});

function somenteDigitos(valor) {
    return valor.replace(/\D/g, '');
}

/**
 * Máscara de CPF aplicada enquanto se digita: o campo aceita só dígitos e os agrupa em
 * `000.000.000-00`. O servidor recebe a máscara sem problema — ele normaliza para dígitos.
 */
function aoDigitarCpf(evento) {
    const digitos = somenteDigitos(evento.target.value).slice(0, 11);

    const partes = [
        digitos.slice(0, 3),
        digitos.slice(3, 6),
        digitos.slice(6, 9),
    ].filter((parte) => parte !== '');

    const verificador = digitos.slice(9, 11);

    cpf.value = partes.join('.') + (verificador !== '' ? '-'.concat(verificador) : '');
    evento.target.value = cpf.value;
}

function aoDigitarPin(evento) {
    pin.value = somenteDigitos(evento.target.value).slice(0, 6);
    evento.target.value = pin.value;
}

/**
 * Contagem regressiva do bloqueio por rate limit: o 429 do login informa em quantos
 * segundos o CPF volta a poder tentar, e a tela mostra esse tempo correndo.
 */
function iniciarContagem(segundos) {
    pararContagem();
    segundosBloqueado.value = segundos;

    temporizador = window.setInterval(() => {
        segundosBloqueado.value -= 1;

        if (segundosBloqueado.value <= 0) {
            pararContagem();
        }
    }, 1000);
}

function pararContagem() {
    if (temporizador !== null) {
        window.clearInterval(temporizador);
        temporizador = null;
    }

    segundosBloqueado.value = 0;
}

const tempoRestante = computed(() => {
    const minutos = Math.floor(segundosBloqueado.value / 60);
    const segundos = segundosBloqueado.value % 60;

    if (minutos === 0) {
        return `${segundos}s`;
    }

    return `${minutos}min ${String(segundos).padStart(2, '0')}s`;
});

async function enviar() {
    if (! podeEnviar.value) {
        return;
    }

    erro.value = '';
    errosDeCampo.value = {};

    const { ok, falha } = await auth.entrar({ cpf: cpf.value, pin: pin.value });

    if (ok) {
        const destino = typeof route.query.destino === 'string' ? route.query.destino : null;

        router.replace(destino ?? { name: 'visao-geral' });

        return;
    }

    erro.value = falha.mensagem;
    errosDeCampo.value = falha.errors ?? {};
    pin.value = '';

    if (falha.status === 429 && falha.tentarEm !== null) {
        iniciarContagem(falha.tentarEm);
    }
}
</script>

<template>
  <div class="login">
    <div class="login__story">
      <div class="login__ambient" aria-hidden="true" :style="{backgroundImage:`url(${pista})`}"></div>
      <div class="login__story-content">
        <div class="login__brand">
          <img :src="logoSimbolo" alt=""/>
          <span><strong>ROTA<span>MAXI</span></strong><small>T M S · TRANSPORTE RODOVIÁRIO</small></span>
        </div>
        <div class="login__story-title"><span class="login__tiny">PLATAFORMA DE GESTÃO LOGÍSTICA</span><h1>O transporte em movimento.<br/><em>O controle em suas mãos.</em></h1><p>Gestão de transportes, viagens, entregas e pallets em um só lugar.</p></div>
        <div class="login__advantages">
          <div><span class="login__advantage-icon"><Truck :size="20"/></span><span><b>Mais controle</b><small>Da saída até a entrega</small></span></div>
          <div><span class="login__advantage-icon"><PackageCheck :size="20"/></span><span><b>Mais visibilidade</b><small>Da carga e dos pallets</small></span></div>
          <div><span class="login__advantage-icon"><ChartNoAxesColumn :size="20"/></span><span><b>Mais eficiência</b><small>Em toda a operação</small></span></div>
        </div>
        <p class="login__bottom">Conectando pessoas, cargas e resultados.<span>RotaMaxi TMS</span></p>
      </div>
    </div>

    <div class="login__auth-side">
      <div class="login__auth-top"><span class="login__locale">🇧🇷 PT-BR</span></div>
      <form class="login__card" novalidate @submit.prevent="enviar">
        <div class="login__mobile-brand"><img :src="logoSimbolo" alt=""/> <strong>ROTA<span>MAXI</span> TMS</strong></div>
        <div class="login__welcome"><span class="login__eyebrow">BEM-VINDO DE VOLTA</span><h2>Acesse o RotaMaxi</h2><p>Informe suas credenciais para continuar.</p></div>

        <label class="login__field" for="cpf">
          <span>Documento / CPF</span>
          <div class="login__input-wrap"><UserRound :size="19"/>
            <input id="cpf" name="cpf" type="text" inputmode="numeric" autocomplete="username" placeholder="Digite seu CPF" :value="cpf" :disabled="auth.entrando" maxlength="14" @input="aoDigitarCpf" />
          </div>
          <small v-if="errosDeCampo.cpf" class="login__field-error">{{ errosDeCampo.cpf[0] }}</small>
        </label>

        <label class="login__field" for="pin"><span>Senha / PIN</span>
          <div class="login__input-wrap"><LockKeyhole :size="19"/>
            <input id="pin" name="pin" :type="mostrarPin ? 'text' : 'password'" inputmode="numeric" pattern="[0-9]*" autocomplete="current-password" maxlength="6" placeholder="Digite seu PIN de 6 dígitos" :value="pin" :disabled="auth.entrando" @input="aoDigitarPin" />
            <button type="button" class="login__show-pin" :aria-label="mostrarPin ? 'Ocultar PIN' : 'Mostrar PIN'" @click="mostrarPin=!mostrarPin"><EyeOff v-if="mostrarPin" :size="20"/><Eye v-else :size="20"/></button>
          </div>
          <small v-if="errosDeCampo.pin" class="login__field-error">{{ errosDeCampo.pin[0] }}</small>
        </label>

        <p class="login__access-help">Precisa de acesso? Solicite ao administrador da sua empresa.</p>
        <p v-if="erro" class="login__error" role="alert">{{ erro }}</p>
        <p v-if="bloqueado" class="login__blocking" role="status">Novas tentativas liberadas em {{ tempoRestante }}.</p>
        <button type="submit" class="login__submit" :disabled="!podeEnviar"><span>{{auth.entrando ? 'Entrando...' : 'Entrar na plataforma'}}</span><ArrowRight :size="19"/></button>
        <div class="login__divider"><span>ACESSO ADMINISTRATIVO</span></div>
        <div class="login__secure"><ShieldCheck :size="29"/><div><b>Ambiente protegido</b><p>Seus dados são protegidos e o acesso é restrito a usuários autorizados.</p></div></div>
        <div class="login__legal">© 2026 RotaMaxi TMS · Plataforma de transporte rodoviário</div>
      </form>
    </div>
  </div>
</template>

<style scoped src="@/styles/pages/auth/login_page.css"></style>
