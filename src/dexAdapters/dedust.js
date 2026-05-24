// DeDust v2 adapter
// Factory: EQBfBWT7X2BHg9tXAxzhz2aKiNTU1tpt5NsiK0uSDW_YAJ67
// Op codes (Factory.js):
//   CREATE_VAULT = 0x21cfe02b  → yeni token vault
//   CREATE_VOLATILE_POOL = 0x97d51f2f  → yeni AMM pool launch (asıl aradığımız)
//
// Mantık: factory'ye gelen tx'in in_op'u CREATE_VOLATILE_POOL ise → yeni pool.
// Out_msg'lerden state_init taşıyan destination = yeni pool adresi.

const { getTransaction, getInOp, extractDeployedAddresses, addressEquals } = require('./_common');

const FACTORY = 'EQBfBWT7X2BHg9tXAxzhz2aKiNTU1tpt5NsiK0uSDW_YAJ67';

const OP = {
  CREATE_VAULT: '0x21cfe02b',
  CREATE_VOLATILE_POOL: '0x97d51f2f',
};

const TRACKED_OPS = new Set([OP.CREATE_VOLATILE_POOL]);

/**
 * SSE event'inden gelen { account_id, lt, tx_hash } ile tx'i çek + filtrele.
 * @returns {Promise<{dex:'dedust', poolAddress:string, factoryTxHash:string}|null>}
 */
async function handleSseEvent({ account_id, tx_hash }) {
  if (!addressEquals(account_id, FACTORY)) return null;

  const tx = await getTransaction(tx_hash);
  if (!tx) return null;

  const inOp = getInOp(tx);
  if (!TRACKED_OPS.has(inOp)) return null;

  // Yeni deploy edilen kontrat(lar)dan birini pool olarak al
  const deployed = extractDeployedAddresses(tx);
  if (deployed.length === 0) return null;

  // DeDust factory CREATE_VOLATILE_POOL'da tek bir pool kontrat deploy eder
  const poolAddress = deployed[0];

  return {
    dex: 'dedust',
    poolAddress,
    factoryTxHash: tx_hash,
    detectedAt: Date.now(),
    rawOp: inOp,
  };
}

module.exports = {
  FACTORY,
  OP,
  TRACKED_OPS,
  handleSseEvent,
};
