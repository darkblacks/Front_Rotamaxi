<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import * as maplibregl from 'maplibre-gl';
import workerMapaUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import 'maplibre-gl/dist/maplibre-gl.css';
import '@/styles/components/operations/map/operational_map_markers.css';
import { corHexDaEtapa, ordenarEtapas } from '@/domain/map/stages.js';
import { estadoDoSinal, formatarIdade, idadeDoSinal, posicaoValida, ROTULO_DO_SINAL } from '@/domain/map/positions.js';

/**
 * Mapa dominante da tela. Camadas GeoJSON: rota planejada (contínua) e trajeto realizado
 * (tracejado). Etapas, veículo e celular são marcadores HTML pequenos; veículo e celular são
 * entidades independentes (posições e idade de sinal distintas).
 */
const props = defineProps({
    etapas: { type: Array, default: () => [] },
    rota: { type: Object, default: null },
    trajeto: { type: Object, default: null },
    posicoes: { type: Object, default: null },
    // Resumos exibidos quando nenhum manifesto está selecionado.
    resumos: { type: Array, default: () => [] },
    manifestoId: { type: [Number, String], default: null },
    mostrar: { type: Object, default: () => ({ veiculos: true, celulares: true, pontos: true }) },
    etapaDestacadaId: { type: [Number, String], default: null },
    agora: { type: Number, default: () => Date.now() },
});

const emit = defineEmits(['selecionar-etapa', 'selecionar-manifesto']);

// maplibre 6 usa worker ESM; sem URL explícita o pré-bundle do Vite quebra o caminho relativo.
maplibregl.setWorkerUrl(workerMapaUrl);

// Único valor padrão de câmera: centro/zoom do Brasil. Nenhuma coordenada de negócio fixa.
const CENTRO_PADRAO = [-52, -14];
const ZOOM_PADRAO = 3.6;
const URL_TILES = import.meta.env.VITE_MAP_TILES_URL || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const ATRIBUICAO = import.meta.env.VITE_MAP_ATTRIBUTION || '© OpenStreetMap contributors';

const container = ref(null);
const pronto = ref(false);
const erroDoMapa = ref('');
let mapa = null;
const marcadores = new Map();
let manifestoEnquadrado = null;

const ICONE_CAMINHAO = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/></svg>';
const ICONE_CELULAR = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="20" x="5" y="2" rx="2" ry="2"/><path d="M12 18h.01"/></svg>';

const VAZIO = { type: 'FeatureCollection', features: [] };

function linhaParaFeature(geometry, props = {}) {
    return geometry?.coordinates?.length >= 2 ? { type: 'Feature', geometry, properties: props } : null;
}

function dadosDaRota() {
    const f = linhaParaFeature(props.rota?.geometry);
    return f ? { type: 'FeatureCollection', features: [f] } : VAZIO;
}

function dadosDoTrajeto() {
    const features = ['vehicle', 'phone']
        .map((tipo) => linhaParaFeature(props.trajeto?.[tipo], { tipo }))
        .filter(Boolean);
    return { type: 'FeatureCollection', features };
}

function criarMapa() {
    try {
        mapa = new maplibregl.Map({
            container: container.value,
            center: CENTRO_PADRAO,
            zoom: ZOOM_PADRAO,
            attributionControl: { compact: true },
            style: {
                version: 8,
                sources: {
                    base: { type: 'raster', tiles: [URL_TILES], tileSize: 256, attribution: ATRIBUICAO },
                },
                layers: [{ id: 'base', type: 'raster', source: 'base' }],
            },
        });
    } catch (e) {
        erroDoMapa.value = 'Não foi possível iniciar o mapa neste navegador (WebGL indisponível).';
        return;
    }

    mapa.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    mapa.on('error', (ev) => {
        if (!pronto.value) erroDoMapa.value = 'Falha ao carregar o mapa.';
        console.warn('[mapa]', ev?.error?.message ?? ev);
    });

    mapa.on('load', () => {
        mapa.addSource('rota', { type: 'geojson', data: dadosDaRota() });
        mapa.addSource('trajeto', { type: 'geojson', data: dadosDoTrajeto() });
        mapa.addLayer({
            id: 'rota-linha', type: 'line', source: 'rota',
            layout: { 'line-cap': 'round', 'line-join': 'round' },
            paint: { 'line-color': '#1a73e8', 'line-width': 4, 'line-opacity': 0.85 },
        });
        mapa.addLayer({
            id: 'trajeto-linha', type: 'line', source: 'trajeto',
            layout: { 'line-join': 'round' },
            paint: {
                'line-color': ['match', ['get', 'tipo'], 'phone', '#8e44ad', '#182435'],
                'line-width': 3,
                'line-dasharray': [2, 2],
            },
        });
        pronto.value = true;
        atualizarTudo();
    });
}

function elementoDoMarcador(classe, html, titulo) {
    const el = document.createElement('div');
    el.className = classe;
    el.innerHTML = html;
    el.title = titulo;
    return el;
}

function definirMarcador(chave, lngLat, fabricar, atualizar) {
    let m = marcadores.get(chave);
    if (!m) {
        const el = fabricar();
        m = { marker: new maplibregl.Marker({ element: el }).setLngLat(lngLat).addTo(mapa), el };
        marcadores.set(chave, m);
    } else {
        m.marker.setLngLat(lngLat);
    }
    atualizar?.(m.el);
    return m;
}

function textoDoSinal(rotulo, pos) {
    const estado = estadoDoSinal(pos, props.agora);
    const idade = formatarIdade(idadeDoSinal(pos, props.agora));
    const extra = estado === 'offline' ? `último sinal ${idade}` : `${ROTULO_DO_SINAL[estado]} · ${idade}`;
    return { estado, titulo: `${rotulo} — ${extra}` };
}

function sincronizarMarcadores() {
    if (!mapa || !pronto.value) return;
    const vivos = new Set();

    const temSelecao = props.manifestoId !== null && props.manifestoId !== undefined;

    if (temSelecao) {
        if (props.mostrar.pontos) {
            ordenarEtapas(props.etapas).forEach((e) => {
                if (e.latitude == null || e.longitude == null) return;
                const chave = `etapa:${e.id}`;
                vivos.add(chave);
                definirMarcador(
                    chave, [Number(e.longitude), Number(e.latitude)],
                    () => {
                        const el = elementoDoMarcador('mapa-ponto', '', e.nome ?? 'Etapa');
                        el.addEventListener('click', () => emit('selecionar-etapa', e.id));
                        return el;
                    },
                    (el) => {
                        el.style.background = corHexDaEtapa(e);
                        el.textContent = String(e.ordem ?? '');
                        el.title = `${e.ordem}. ${e.nome ?? 'Etapa'}`;
                        el.classList.toggle('mapa-ponto--destaque', e.id === props.etapaDestacadaId);
                        el.classList.toggle('mapa-ponto--concluido', e.status === 'CONCLUIDA');
                    },
                );
            });
        }

        [['vehicle', 'veiculos', ICONE_CAMINHAO, 'Veículo'], ['phone', 'celulares', ICONE_CELULAR, 'Celular']]
            .forEach(([tipo, flag, icone, rotulo]) => {
                const pos = props.posicoes?.[tipo];
                if (!props.mostrar[flag] || !posicaoValida(pos)) return;
                const chave = `obj:${tipo}`;
                vivos.add(chave);
                const { estado, titulo } = textoDoSinal(rotulo, pos);
                definirMarcador(
                    chave, [Number(pos.longitude), Number(pos.latitude)],
                    () => elementoDoMarcador(`mapa-objeto mapa-objeto--${tipo}`, icone, titulo),
                    (el) => {
                        el.title = titulo;
                        el.dataset.sinal = estado;
                        el.classList.toggle('mapa-objeto--offline', estado === 'offline');
                    },
                );
            });
    } else {
        // Visão geral: um marcador por manifesto, na posição mais recente conhecida.
        props.resumos.forEach((r) => {
            const pos = posicaoValida(r.ultima_posicao?.vehicle) ? r.ultima_posicao.vehicle
                : posicaoValida(r.ultima_posicao?.phone) ? r.ultima_posicao.phone : null;
            if (!pos || !props.mostrar.veiculos) return;
            const chave = `resumo:${r.id}`;
            vivos.add(chave);
            definirMarcador(
                chave, [Number(pos.longitude), Number(pos.latitude)],
                () => {
                    const el = elementoDoMarcador('mapa-objeto mapa-objeto--vehicle', ICONE_CAMINHAO, '');
                    el.addEventListener('click', () => emit('selecionar-manifesto', r.id));
                    return el;
                },
                (el) => {
                    el.title = `${r.placa ?? 'Veículo'} · MAN ${r.numero ?? r.id}`;
                    el.classList.toggle('mapa-objeto--offline', estadoDoSinal(pos, props.agora) === 'offline');
                },
            );
        });
    }

    for (const [chave, m] of [...marcadores.entries()]) {
        if (!vivos.has(chave)) {
            m.marker.remove();
            marcadores.delete(chave);
        }
    }
}

function enquadrar() {
    if (!mapa || !pronto.value) return;
    const bounds = new maplibregl.LngLatBounds();
    let n = 0;
    const add = (lng, lat) => { bounds.extend([Number(lng), Number(lat)]); n += 1; };

    if (props.manifestoId !== null && props.manifestoId !== undefined) {
        props.etapas.forEach((e) => { if (e.latitude != null && e.longitude != null) add(e.longitude, e.latitude); });
        props.rota?.geometry?.coordinates?.forEach(([lng, lat]) => add(lng, lat));
        ['vehicle', 'phone'].forEach((t) => { const p = props.posicoes?.[t]; if (posicaoValida(p)) add(p.longitude, p.latitude); });
    } else {
        props.resumos.forEach((r) => ['vehicle', 'phone'].forEach((t) => {
            const p = r.ultima_posicao?.[t];
            if (posicaoValida(p)) add(p.longitude, p.latitude);
        }));
    }

    if (n === 0) {
        mapa.easeTo({ center: CENTRO_PADRAO, zoom: ZOOM_PADRAO });
        return;
    }
    mapa.fitBounds(bounds, { padding: 60, maxZoom: 14, duration: 600 });
}

function atualizarTudo() {
    if (!mapa || !pronto.value) return;
    mapa.getSource('rota')?.setData(dadosDaRota());
    mapa.getSource('trajeto')?.setData(dadosDoTrajeto());
    mapa.setLayoutProperty('trajeto-linha', 'visibility', 'visible');
    sincronizarMarcadores();
}

onMounted(criarMapa);

onBeforeUnmount(() => {
    marcadores.forEach((m) => m.marker.remove());
    marcadores.clear();
    mapa?.remove();
    mapa = null;
});

watch(() => [props.rota, props.trajeto, props.posicoes, props.etapas, props.resumos, props.mostrar, props.etapaDestacadaId, props.agora],
    atualizarTudo, { deep: false });

// Enquadra ao trocar de manifesto, e uma vez quando o conteúdo dele chega (não a cada posição).
watch(() => [props.manifestoId, props.etapas.length > 0 || props.resumos.length > 0], () => {
    const chave = `${props.manifestoId}:${props.etapas.length > 0}`;
    if (chave === manifestoEnquadrado) return;
    manifestoEnquadrado = chave;
    atualizarTudo();
    enquadrar();
});

watch(() => props.mostrar, () => atualizarTudo(), { deep: true });

watch(pronto, (v) => { if (v) enquadrar(); });

defineExpose({
    enquadrar,
    focarEtapa(id) {
        const e = props.etapas.find((x) => x.id === id);
        if (mapa && e?.latitude != null && e?.longitude != null) {
            mapa.easeTo({ center: [Number(e.longitude), Number(e.latitude)], zoom: Math.max(mapa.getZoom(), 12) });
        }
    },
    redimensionar() { mapa?.resize(); },
});
</script>

<template>
    <div class="mapa">
        <div ref="container" class="mapa__canvas" role="application" aria-label="Mapa operacional"></div>
        <div v-if="erroDoMapa" class="mapa__erro" role="alert">{{ erroDoMapa }}</div>
        <slot />
    </div>
</template>

<style scoped src="@/styles/components/operations/map/operational_map.css"></style>
