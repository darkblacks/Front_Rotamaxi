import logoPadrao from '@/assets/images/brand/rotamaxi-logo-horizontal.png';

const nomeConfigurado = String(import.meta.env.VITE_EMPRESA_NOME || '').trim();
const logoConfigurada = String(import.meta.env.VITE_EMPRESA_LOGO || '').trim();

export const EMPRESA_ATUAL = Object.freeze({
  nome: nomeConfigurado || 'RotaMaxi',
  logo: logoConfigurada || logoPadrao,
});
