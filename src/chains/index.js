// Chain registry — TON + BSC + Solana (tek bot).

const ton = require('./ton');
const bsc = require('./bsc');
const solana = require('./solana');

const REGISTRY = {
  [ton.id]: ton,
  [bsc.id]: bsc,
  [solana.id]: solana,
};

const DEFAULT_CHAIN = 'solana';

function getChain(chainId = DEFAULT_CHAIN) {
  return REGISTRY[chainId] || REGISTRY[DEFAULT_CHAIN];
}

function listChains() {
  return Object.values(REGISTRY);
}

function listEnabledChains() {
  return listChains().filter((c) => c.config?.enabled !== false);
}

module.exports = {
  getChain,
  listChains,
  listEnabledChains,
  DEFAULT_CHAIN,
  CHAINS: REGISTRY,
};
