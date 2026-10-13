import { podeAcessar } from './roles.js';

/**
 * Ações de tela por papel (esconder/bloquear botões). O backend continua sendo a barreira
 * real. Admin pode tudo; a tela da portaria nunca tem aceite, nem para o admin.
 */
export function permissoesDeAcao(papeis) {
    const pode = (...exigidos) => podeAcessar(papeis, exigidos);
    return {
        registrarPortaria: pode('porteiro'),
        operarConferencia: pode('conferente'),
        aceitarComoMotorista: pode('motorista'),
        operarRecebimento: pode('equipe_ct'),
        tratarOcorrencia: pode('sac', 'roteirizador'),
        reportarOcorrencia: pode('motorista', 'conferente', 'equipe_ct', 'porteiro', 'sac', 'roteirizador'),
    };
}
