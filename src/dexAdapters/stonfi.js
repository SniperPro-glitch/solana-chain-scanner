// STON.fi v2.x adapter
// Router (v2.2): EQCiypoBWNIEPlarBp04UePyEj5zH0ZDHxuRNqJ1WQx3FCY-
//
// STON.fi mimarisi DeDust'tan farklı:
//  - Router pool'u doğrudan deploy etmez; PROVIDE_LP geldiğinde pool oluşur.
//  - İlk kez bir token çifti için PROVIDE_LP gelirse → yeni pool launch.
//
// Op codes (chunk-CWGXHOMU.js):
//   SWAP                = 0x6664de2a (1717886506)
//   CROSS_SWAP          = 0x69cf1a5b (1775180379)
//   PROVIDE_LP          = 0x37c096df (935368415)   ← TAM ARANAN
//   DIRECT_ADD_LIQUIDITY= 0x0xff8bfc06 (267960262) (legacy add)
//
// Mantık: router'a gelen tx'in in_op'u PROVIDE_LP ise → pool deploy/init oluyor.
// Router'dan çıkan state_init taşıyan out_msg destination'ı yeni pool adresi.
// (Eğer pool önceden varsa state_init taşımaz; o zaman zaten "yeni" değildir.)

const { getTransaction, getInOp, extractDeployedAddresses, extractAllDestinations, addressEquals } = require('./_common');

const ROUTER = 'EQCiypoBWNIEPlarBp04UePyEj5zH0ZDHxuRNqJ1WQx3FCY-';

const OP = {
  SWAP: '0x6664de2a',
  CROSS_SWAP: '0x69cf1a5b',
  PROVIDE_LP: '0x37c096df',
  DIRECT_ADD_LIQUIDITY: '0x0ff8bfc06'.replace('0x0', '0x'), // 0x0ff8bfc06 → leave as 0x0ff8bfc06
};

// Sadece PROVIDE_LP'yi izle (yeni pool'u tek o tetikler)
const TRACKED_OPS = new Set([OP.PROVIDE_LP]);

/**
 * SSE event handler.
 * @returns {Promise<{dex:'stonfi', poolAddress:string, factoryTxHash:string}|null>}
 */
async function handleSseEvent({ account_id, tx_hash }) {
  if (!addressEquals(account_id, ROUTER)) return null;

  const tx = await getTransaction(tx_hash);
  if (!tx) return null;

  const inOp = getInOp(tx);
  if (!TRACKED_OPS.has(inOp)) return null;

  // 1) Yeni deploy edilen pool varsa (ilk PROVIDE_LP) — en güçlü sinyal
  const deployed = extractDeployedAddresses(tx);
  if (deployed.length > 0) {
    return {
      dex: 'stonfi',
      poolAddress: deployed[0],
      factoryTxHash: tx_hash,
      detectedAt: Date.now(),
      rawOp: inOp,
      fresh: true,
    };
  }

  // 2) Yoksa: pool zaten vardı — sadece likidite ekleniyor → atla (yeni değil)
  return null;
}

module.exports = {
  ROUTER,
  OP,
  TRACKED_OPS,
  handleSseEvent,
};
