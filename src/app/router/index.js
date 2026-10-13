import { createRouter, createWebHistory } from 'vue-router';
import {
    Boxes,
    DoorOpen,
    FileText,
    LayoutDashboard,
    Map as MapaIcone,
    Scale,
    Smartphone,
    TriangleAlert,
} from 'lucide-vue-next';
import PainelLayout from '@/app/layouts/MainLayout.vue';
import { redirecionamentosCadastroAntigo, rotaCadastro } from '@/domain/registrations/navigation.js';
import { papeisDaRota, podeAcessar, primeiraRotaPermitida } from '@/domain/access/roles.js';
import { useAuthStore } from '@/stores/auth.store.js';

/**
 * Os destinos do painel, na ordem do design. A navegação lateral lê daqui, então rota e
 * menu nunca saem de sincronia.
 *
 * As cinco primeiras são as telas do design; as duas últimas são as telas de administração
 * — divergências e dispositivos —, que o design não desenha mas que precisam de um caminho
 * na navegação, já que ninguém chega a elas por uma linha de operação.
 *
 * O `icone` é o componente que a navegação lateral desenha antes do rótulo. Ele mora aqui, e
 * não no layout, porque destino e símbolo são a mesma decisão: quem acrescenta uma tela à
 * lista escolhe o ícone dela no mesmo lugar, sem precisar abrir o `PainelLayout`.
 *
 * Qual item acende não é decidido pela classe do `RouterLink`, e sim pelo `meta.menu` de
 * cada rota — ver `PainelLayout`. A ativação embutida casa pela cadeia de registros, e a
 * cadeia aqui não corresponde ao menu por duas razões opostas: a visão geral é a rota
 * índice do painel, ancestral de todas, e acenderia em qualquer tela; e o detalhe do
 * manifesto é irmão da lista de manifestos, não filho, então não acenderia em nenhuma.
 */
export const destinosDoPainel = [
    { nome: 'visao-geral', rotulo: 'Visão geral', icone: LayoutDashboard },
    { nome: 'manifestos', rotulo: 'Manifestos', icone: FileText },
    { nome: 'fila-portaria', rotulo: 'Fila da portaria', icone: DoorOpen },
    { nome: 'mapa-operacional', rotulo: 'Mapa operacional', icone: MapaIcone },
    { nome: 'saldo-pallets', rotulo: 'Saldo de pallets', icone: Boxes },
    { nome: 'ocorrencias', rotulo: 'Ocorrências', icone: TriangleAlert },
    { nome: 'divergencias', rotulo: 'Divergências', icone: Scale },
    { nome: 'dispositivos', rotulo: 'Dispositivos', icone: Smartphone },
];

const routes = [
    {
        path: '/',
        redirect: { name: 'visao-geral' },
    },
    {
        path: '/operacoes/mapa',
        redirect: (para) => ({ name: 'mapa-operacional', query: para.query }),
    },
    {
        path: '/login',
        name: 'login',
        component: () => import('@/pages/auth/LoginPage.vue'),
        meta: { publico: true },
    },
    {
        path: '/painel',
        component: PainelLayout,
        children: [
            {
                path: 'cadastros',
                redirect: rotaCadastro('pessoas', 'pessoas'),
            },
            {
                path: 'cadastros/pessoas/nova',
                name: 'pessoa-nova',
                component: () => import('@/pages/registrations/people/PersonFormPage.vue'),
                meta: { titulo: 'Nova pessoa', contexto: 'cadastros', secaoCadastro: 'pessoas' },
            },
            {
                path: 'cadastros/pessoas/editar/:id',
                name: 'pessoa-editar',
                component: () => import('@/pages/registrations/people/PersonFormPage.vue'),
                meta: { titulo: 'Editar pessoa', contexto: 'cadastros', secaoCadastro: 'pessoas' },
            },
            {
                path: 'cadastros/veiculos/novo',
                name: 'veiculo-novo',
                component: () => import('@/pages/registrations/vehicles/VehicleFormPage.vue'),
                meta: { titulo:'Novo veículo', contexto:'cadastros', secaoCadastro:'veiculos' },
            },
            {
                path: 'cadastros/veiculos/editar/:id',
                name: 'veiculo-editar',
                component: () => import('@/pages/registrations/vehicles/VehicleFormPage.vue'),
                meta: { titulo:'Editar veículo', contexto:'cadastros', secaoCadastro:'veiculos' },
            },
            {
                path: 'cadastros/veiculos/importar-esl',
                name: 'veiculo-importar-esl',
                component: () => import('@/pages/registrations/vehicles/VehicleImportPage.vue'),
                meta: { titulo:'Importar veículos ESL', contexto:'cadastros', secaoCadastro:'veiculos' },
            },
            {
                path: 'cadastros/veiculos/consulta-fipe',
                name: 'veiculo-consulta-fipe',
                component: () => import('@/pages/registrations/vehicles/FipeLookupPage.vue'),
                meta: { titulo: 'Consulta FIPE', contexto: 'cadastros', secaoCadastro: 'veiculos' },
            },
            {
                // Depois das rotas estáticas (novo, editar, importar-esl, consulta-fipe).
                path: 'cadastros/veiculos/:id(\\d+)',
                name: 'veiculo-detalhe',
                component: () => import('@/pages/registrations/vehicles/VehicleDetailsPage.vue'),
                meta: { titulo: 'Detalhe do veículo', contexto: 'cadastros', secaoCadastro: 'veiculos' },
            },
            {
                // Veículos (placas) abre a Central de Frota; ver CadastrosRaizPage.
                path: 'cadastros/:tipo',
                name: 'cadastros-item',
                component: () => import('@/pages/registrations/RegistrationsRootPage.vue'),
                meta: { titulo: 'Cadastros', contexto: 'cadastros' },
            },
            {
                path: 'financeiro',
                name: 'financeiro',
                component: () => import('@/pages/shared/FutureModulePage.vue'),
                props: { modulo: 'Financeiro' },
                meta: { titulo: 'Visão financeira', contexto: 'financeiro' },
            },
            {
                path: 'relatorios',
                name: 'relatorios',
                component: () => import('@/pages/shared/FutureModulePage.vue'),
                props: { modulo: 'Relatórios' },
                meta: { titulo: 'Central de relatórios', contexto: 'relatorios' },
            },
            {
                path: 'configuracoes',
                name: 'configuracoes',
                component: () => import('@/pages/shared/FutureModulePage.vue'),
                props: { modulo: 'Configurações' },
                meta: { titulo: 'Preferências', contexto: 'configuracoes' },
            },
            {
                path: '',
                name: 'visao-geral',
                component: () => import('@/pages/overview/OverviewPage.vue'),
                meta: { titulo: 'Visão geral', contexto: 'visao-geral' },
            },
            {
                path: 'operacoes/emprestimos',
                name: 'emprestimos-operacionais',
                component: () => import('@/pages/operations/driver-loans/DriverLoansPage.vue'),
                meta: { contexto: 'operacoes', titulo: 'Empréstimos de motoristas' },
            },
            {
                path: 'manifestos',
                name: 'manifestos',
                component: () => import('@/pages/operations/manifests/ManifestsPage.vue'),
                meta: { contexto: 'operacoes', titulo: 'Manifestos' },
            },
            {
                // Detalhe do manifesto: destino da linha da lista. Fora do menu, porque se
                // chega a ele por um manifesto, e não pela navegação.
                path: 'manifestos/:manifesto',
                name: 'manifesto',
                component: () => import('@/pages/operations/manifests/ManifestDetailsPage.vue'),
                meta: { contexto: 'operacoes', titulo: 'Manifesto', menu: 'manifestos' },
            },
            {
                path: 'operacoes/mapa',
                name: 'mapa-operacional',
                component: () => import('@/pages/operations/map/OperationalMapPage.vue'),
                meta: { contexto: 'operacoes', titulo: 'Mapa operacional' },
            },
            {
                path: 'operacoes/planejamento',
                name: 'planejamento',
                component: () => import('@/pages/operations/planning/PlanningPage.vue'),
                meta: { contexto: 'operacoes', titulo: 'Planejamento / Serviços' },
            },
            {
                path: 'operacoes/conferencia',
                name: 'conferencia',
                component: () => import('@/pages/operations/conference/ConferencePage.vue'),
                meta: { contexto: 'operacoes', titulo: 'Conferência / Coletas' },
            },
            {
                path: 'operacoes/recebimentos',
                name: 'recebimentos',
                component: () => import('@/pages/operations/receiving/ReceivingPage.vue'),
                meta: { contexto: 'operacoes', titulo: 'Recebimentos CT' },
            },
            {
                path: 'operacoes/meu-manifesto',
                name: 'meu-manifesto',
                component: () => import('@/pages/operations/driver/DriverManifestPage.vue'),
                meta: { contexto: 'operacoes', titulo: 'Meu manifesto' },
            },
            {
                path: 'manifestos/novo',
                name: 'manifesto-novo',
                component: () => import('@/pages/operations/planning/ManifestPlannerPage.vue'),
                meta: { contexto: 'operacoes', titulo: 'Novo manifesto', menu: 'planejamento' },
            },
            {
                path: 'manifestos/:manifesto(\\d+)/planejar',
                name: 'manifesto-planejar',
                component: () => import('@/pages/operations/planning/ManifestPlannerPage.vue'),
                meta: { contexto: 'operacoes', titulo: 'Planejar manifesto', menu: 'planejamento' },
            },
            {
                path: 'fila-portaria',
                name: 'fila-portaria',
                component: () => import('@/pages/operations/gate/GateQueuePage.vue'),
                meta: { contexto: 'operacoes', titulo: 'Fila da portaria' },
            },
            {
                path: 'saldo-pallets',
                name: 'saldo-pallets',
                component: () => import('@/pages/operations/pallets/PalletBalancePage.vue'),
                meta: { contexto: 'operacoes', titulo: 'Saldo de pallets' },
            },
            {
                path: 'ocorrencias',
                name: 'ocorrencias',
                component: () => import('@/pages/operations/incidents/IncidentsPage.vue'),
                meta: { contexto: 'operacoes', titulo: 'Ocorrências' },
            },
            {
                path: 'divergencias',
                name: 'divergencias',
                component: () => import('@/pages/operations/divergences/DivergencesPage.vue'),
                meta: { contexto: 'operacoes', titulo: 'Divergências' },
            },
            {
                path: 'dispositivos',
                name: 'dispositivos',
                component: () => import('@/pages/settings/DevicesPage.vue'),
                meta: { titulo: 'Dispositivos', contexto: 'configuracoes' },
            },
            {
                // Destino do link do cartão "Divergências abertas" e da lista de
                // divergências. Fora do menu: chega-se a ela por uma divergência.
                path: 'divergencias/:divergencia',
                name: 'divergencia',
                component: () => import('@/pages/operations/divergences/DivergenceDetailsPage.vue'),
                meta: { contexto: 'operacoes', titulo: 'Divergência', menu: 'divergencias' },
            },
            {
                // Amostra dos componentes compartilhados nos dois temas. Fora do menu:
                // serve de referência de design, não é destino da operação.
                path: 'design-system',
                name: 'design-system',
                component: () => import('@/pages/settings/DesignSystemPage.vue'),
                meta: { titulo: 'Componentes do painel', contexto: 'configuracoes' },
            },
        ],
    },
    {
        path: '/:caminhoNaoEncontrado(.*)*',
        redirect: { name: 'visao-geral' },
    },
];

if (import.meta.env.DEV) {
    // Somente desenvolvimento: harness visual do modal de revisão ESL (fixtures, sem API).
    routes.splice(routes.length - 1, 0, {
        path: '/__harness/revisao-modal',
        name: 'harness-revisao-modal',
        component: () => import('@/pages/dev/ReviewModalHarnessPage.vue'),
        meta: { publico: true },
    });
}

const router = createRouter({
    history: createWebHistory(),
    routes,
});

/**
 * Guard das rotas do painel: token e papel `admin` são exigidos **antes** de montar a
 * página, nunca depois de a tela já ter pedido dados.
 *
 * - sem token: volta ao login guardando o destino pedido;
 * - com token mas sem perfil (caso do refresh da página): busca o perfil; token inválido
 *   ou revogado responde 401, o interceptor limpa o estado e o login recebe o motivo;
 * - autenticado sem o papel: o token é revogado e o login explica por que não entrou —
 *   esse usuário só tomaria 403 em todos os endpoints do painel.
 */
router.beforeEach(async (para) => {
    const auth = useAuthStore();

    // Compatibilidade V5: empréstimos saíram de Cadastros e foram para Operações.
    if (para.name === 'cadastros-item' && para.params.tipo === 'pessoas' && para.query.aba === 'emprestimos') {
        return { name: 'emprestimos-operacionais' };
    }

    if (para.name === 'cadastros-item' && redirecionamentosCadastroAntigo[para.params.tipo]) {
        const [secao, aba] = redirecionamentosCadastroAntigo[para.params.tipo];

        // Nunca redirecionar uma rota cadastral para ela mesma.
        // Isso evita loop de navegação quando um cadastro legado passa a ser
        // uma seção canônica do workspace (como aconteceu com Terceiros na V7.5).
        if (String(para.params.tipo) !== secao || String(para.query.aba || '') !== aba) {
            return { ...rotaCadastro(secao, aba), replace: true };
        }
    }

    if (para.meta.publico) {
        return true;
    }

    if (! auth.autenticado) {
        return { name: 'login', query: { destino: para.fullPath } };
    }

    if (! await auth.carregarPerfil()) {
        return { name: 'login', query: { motivo: 'sessao-encerrada', destino: para.fullPath } };
    }

    if (! auth.temPapelDoPainel) {
        await auth.sair();

        return { name: 'login', query: { motivo: 'sem-permissao' } };
    }

    // Guarda por papel: sem exigência declarada a rota é só do admin. Quem não pode ver a
    // tela vai para a primeira tela que o seu papel enxerga (nunca para o login).
    if (! podeAcessar(auth.papeis, papeisDaRota(para.meta, para.name))) {
        const destino = primeiraRotaPermitida(auth.papeis);

        return destino !== null && destino !== para.name ? { name: destino, replace: true } : { name: 'login', query: { motivo: 'sem-permissao' } };
    }

    return true;
});

export default router;
