import { defineStore } from 'pinia';
import { enviarParaUrlAssinada, motoristaService, ocorrenciasMapaService } from '@/services/api/operations.api.js';
import { aplicarDelta } from '@/domain/map/merge.js';
import { lerPresign, pendenciasDaConclusao, proximaEtapa, validarArquivoDoCanhoto } from '@/domain/operations/driver.js';

/** Tela "Meu manifesto" do motorista (contrato V2 / Android). */
export const useMotoristaStore = defineStore('motorista', {
    state: () => ({
        dados: null,
        carregando: false,
        falha: null,
        semManifesto: false,
        ocupado: false,
        erroDaAcao: null,
        aviso: null,
        passo: null,
    }),

    getters: {
        manifesto: (state) => state.dados?.manifesto ?? null,
        manifestoId: (state) => state.dados?.manifesto?.id ?? null,
        etapas: (state) => state.dados?.etapas ?? [],
        servicos: (state) => state.dados?.servicos ?? [],
        aAceitar(state) {
            const lista = state.dados?.a_aceitar ?? state.dados?.manifesto?.a_aceitar ?? [];
            return lista.filter((a) => !a.aceito_em && !a.aceito);
        },
        proxima() {
            return proximaEtapa(this.etapas);
        },
        ocorrenciaRelevante(state) {
            const abertas = (state.dados?.ocorrencias ?? []).filter((o) => (o.status ?? 'aberta') === 'aberta');
            const peso = { critico: 3, risco: 2, atencao: 1 };
            return [...abertas].sort((a, b) => (peso[b.severidade] ?? 0) - (peso[a.severidade] ?? 0))[0] ?? null;
        },
    },

    actions: {
        async carregar() {
            this.carregando = this.dados === null;
            const { ok, dados, falha } = await motoristaService.meuManifesto();
            if (ok) {
                this.dados = dados?.data ?? null;
                this.semManifesto = this.dados === null;
                this.falha = null;
            } else if (falha.status === 404) {
                this.dados = null;
                this.semManifesto = true;
                this.falha = null;
            } else {
                this.falha = falha;
            }
            this.carregando = false;
            return ok;
        },

        /** Aplica deltas baratos (ETA, atraso, posição, status de etapa) sem reler tudo. */
        aplicarDelta(nome, payload) {
            if (!this.dados || (payload?.manifest_id != null && payload.manifest_id !== this.manifestoId)) return;
            this.dados = aplicarDelta(this.dados, nome, payload);
        },

        /** Aceite do motorista ao assumir carga/pallets. */
        async aceitar(item, ator) {
            this.ocupado = true;
            this.erroDaAcao = null;
            const { ok, falha } = await motoristaService.aceitarPallets(item.etapa_id, { ator, quantidade: Number(item.quantidade) });
            this.ocupado = false;
            if (!ok) {
                this.erroDaAcao = falha;
                return false;
            }
            this.aviso = 'Carga aceita. Você assumiu a custódia dos pallets.';
            await this.carregar();
            return true;
        },

        /**
         * Conclui o serviço: sobe o canhoto (presign -> PUT -> confirmar) quando houver
         * arquivo e envia a conclusão com descarga.
         */
        async concluirServico(servico, { descarga, arquivo, canhotoAnexoId = null }) {
            this.erroDaAcao = null;
            let anexoId = canhotoAnexoId ?? servico.canhoto_anexo_id ?? null;

            if (arquivo) {
                const invalido = validarArquivoDoCanhoto(arquivo);
                if (invalido) {
                    this.erroDaAcao = { mensagem: invalido };
                    return false;
                }
            }

            const faltas = pendenciasDaConclusao(servico, { descarga, canhotoAnexoId: anexoId ?? (arquivo ? 'novo' : null) });
            if (faltas.length) {
                this.erroDaAcao = { mensagem: faltas.join(' ') };
                return false;
            }

            this.ocupado = true;
            try {
                if (arquivo) {
                    this.passo = 'Preparando envio do canhoto…';
                    const presign = await motoristaService.presignCanhoto(servico.id, { content_type: arquivo.type, tamanho: arquivo.size });
                    if (!presign.ok) { this.erroDaAcao = presign.falha; return false; }
                    const alvo = lerPresign(presign.dados);
                    if (!alvo.url || !alvo.anexoId) {
                        this.erroDaAcao = { mensagem: 'O servidor não devolveu o destino do upload do canhoto.' };
                        return false;
                    }
                    this.passo = 'Enviando o canhoto…';
                    const envio = await enviarParaUrlAssinada(alvo, arquivo);
                    if (!envio.ok) { this.erroDaAcao = { mensagem: envio.mensagem }; return false; }
                    this.passo = 'Confirmando o canhoto…';
                    const confirmado = await motoristaService.confirmarCanhoto(servico.id, alvo.anexoId);
                    if (!confirmado.ok) { this.erroDaAcao = confirmado.falha; return false; }
                    anexoId = alvo.anexoId;
                }

                this.passo = 'Concluindo o serviço…';
                const corpo = { descarga_concluida: true };
                if (anexoId) corpo.canhoto_anexo_id = anexoId;
                const { ok, falha } = await motoristaService.concluirServico(servico.id, corpo);
                if (!ok) { this.erroDaAcao = falha; return false; }
                this.aviso = 'Serviço concluído.';
                await this.carregar();
                return true;
            } finally {
                this.ocupado = false;
                this.passo = null;
            }
        },

        async reportarOcorrencia(corpo) {
            this.ocupado = true;
            this.erroDaAcao = null;
            const { ok, falha } = await ocorrenciasMapaService.criar({ manifesto_id: this.manifestoId, ...corpo });
            this.ocupado = false;
            if (!ok) {
                this.erroDaAcao = falha;
                return false;
            }
            this.aviso = 'Ocorrência registrada. O SAC foi avisado.';
            await this.carregar();
            return true;
        },
    },
});
