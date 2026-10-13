import { requisitar } from '@/services/api/http.js';

export const saudeService = {
    /**
     * Estado da API. Serve de sonda quando o painel volta de uma queda de conexão.
     */
    verificarSaude() {
        return requisitar((http) => http.get('/health'));
    },
};
