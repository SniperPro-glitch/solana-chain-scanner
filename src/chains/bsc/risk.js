// ──────────────────────────────────────────────────────────────────────
// BSC Risk Scanner
//   • BscScan: kontrat verified mi? Source code temiz mi?
//   • Honeypot.is: alım/satım simülasyonu
//   • GoPlus: token_security API (ücretsiz, key yok — rate limit var)
//
// Üç kaynak paralel çağrılır. Sonuç token.contract.* alanına yazılır →
// mevcut auditor.js zaten contract.* alanlarına bakıyor, sıfır iş gücü.
// ──────────────────────────────────────────────────────────────────────

const axios = require('axios');
const config = require('./config');

const http = axios.create({
  timeout: 10_000,
  headers: { Accept: 'application/json', 'User-Agent': 'multi-chain-scanner/bsc-risk' },
});

const BSCSCAN_API_KEY = process.env.BSCSCAN_API_KEY || '';

// In-memory cache (15 dk TTL) — aynı token için tekrar çağrılırsa tasarruf
const _cache = new Map(); // tokenAddr -> { result, fetchedAt }
const CACHE_TTL_MS = 15 * 60 * 1000;

// ─────────────────────────────────────────────────────────────
// 1. BscScan: kontrat verified check
// ─────────────────────────────────────────────────────────────
async function checkBscScanVerified(tokenAddr) {
  if (!BSCSCAN_API_KEY) {
    return { verified: null, error: 'no_api_key' };
  }
  try {
    const { data } = await http.get(config.api.bscScanBase, {
      params: {
        module: 'contract',
        action: 'getsourcecode',
        address: tokenAddr,
        apikey: BSCSCAN_API_KEY,
      },
    });
    const result = data?.result?.[0];
    if (!result) return { verified: null, error: 'empty_result' };

    const isVerified = !!(result.SourceCode && result.SourceCode.length > 0);
    return {
      verified: isVerified,
      contractName: result.ContractName || null,
      compilerVersion: result.CompilerVersion || null,
      proxy: result.Proxy === '1',
    };
  } catch (e) {
    return { verified: null, error: e.message };
  }
}

// ─────────────────────────────────────────────────────────────
// 2. Honeypot.is: alınıp satılabilir mi?
// ─────────────────────────────────────────────────────────────
async function checkHoneypot(tokenAddr, pairAddr = null) {
  try {
    // pair adresini geçirmiyoruz — Honeypot.is en uygun pair'i kendi seçsin
    // (kötü pair → simulationSuccess=false veya yanlış sonuç riski)
    const params = { address: tokenAddr, chainID: 56 }; // BSC = 56
    const { data } = await http.get(`${config.api.honeypotBase}/IsHoneypot`, { params });

    return {
      isHoneypot: !!data?.honeypotResult?.isHoneypot,
      honeypotReason: data?.honeypotResult?.honeypotReason || null,
      simulationSuccess: data?.simulationSuccess !== false,
      buyTax: data?.simulationResult?.buyTax ?? null,
      sellTax: data?.simulationResult?.sellTax ?? null,
      transferTax: data?.simulationResult?.transferTax ?? null,
      buyGas: data?.simulationResult?.buyGas ?? null,
      sellGas: data?.simulationResult?.sellGas ?? null,
      flags: data?.summary?.flags || data?.flags || [],
      // Honeypot.is summary.risk: 'very_low' | 'low' | 'medium' | 'high' | 'honeypot'
      summaryRisk: data?.summary?.risk ?? null,
      // summary.riskLevel: 0-100 numerik
      summaryRiskLevel: data?.summary?.riskLevel ?? null,
      // Holders bilgisi de gelir
      totalHolders: data?.token?.totalHolders ?? null,
      // Kontrat detayları — BscScan'e ek bilgi
      openSource: data?.contractCode?.openSource ?? null,
      isProxy: data?.contractCode?.isProxy ?? null,
    };
  } catch (e) {
    return { isHoneypot: null, error: e.message };
  }
}

// ─────────────────────────────────────────────────────────────
// 2b) GoPlus Labs: token_security (BSC chain_id=56) — ücretsiz, key yok
//     https://api.gopluslabs.io/api/v1/token_security/56?contract_addresses=0x...
// ─────────────────────────────────────────────────────────────
async function checkGoPlusSecurity(tokenAddr) {
  if (!tokenAddr) return { error: 'no_address' };
  const addr = String(tokenAddr).trim();
  const addrLower = addr.toLowerCase();
  try {
    const { data } = await http.get(`${config.api.goplusBase}/api/v1/token_security/56`, {
      params: { contract_addresses: addrLower },
    });
    if (data?.code !== 1 || !data?.result || typeof data.result !== 'object') {
      return { error: 'bad_response', code: data?.code, message: data?.message };
    }
    const row = data.result[addrLower] || data.result[addr] || data.result[tokenAddr];
    const fallbackKey = Object.keys(data.result).find((k) => k.toLowerCase() === addrLower);
    const r = row || (fallbackKey ? data.result[fallbackKey] : null);
    if (!r) return { error: 'no_row' };

    return {
      is_honeypot: r.is_honeypot ?? null,
      is_mintable: r.is_mintable ?? null,
      buy_tax: r.buy_tax ?? null,
      sell_tax: r.sell_tax ?? null,
      transfer_tax: r.transfer_tax ?? null,
      hidden_owner: r.hidden_owner ?? null,
      can_take_back_ownership: r.can_take_back_ownership ?? null,
      is_proxy: r.is_proxy ?? null,
      is_open_source: r.is_open_source ?? null,
      is_blacklisted: r.is_blacklisted ?? null,
      is_whitelisted: r.is_whitelisted ?? null,
      cannot_sell_all: r.cannot_sell_all ?? null,
      cannot_buy: r.cannot_buy ?? null,
      owner_percent: r.owner_percent ?? null,
      creator_percent: r.creator_percent ?? null,
      holder_count: r.holder_count ?? null,
      is_true_token: r.is_true_token ?? null,
      is_in_dex: r.is_in_dex ?? null,
      selfdestruct: r.selfdestruct ?? null,
      external_call: r.external_call ?? null,
      is_airdrop_scam: r.is_airdrop_scam ?? null,
    };
  } catch (e) {
    return { error: e.message };
  }
}

// ─────────────────────────────────────────────────────────────
// 3. PARALEL TARAMA — tek çağrıda üç kaynak
// ─────────────────────────────────────────────────────────────
async function scanToken(tokenAddr, pairAddr = null) {
  if (!tokenAddr) return null;
  const cacheKey = `${tokenAddr}::${pairAddr || ''}`;
  const cached = _cache.get(cacheKey);
  if (cached && (Date.now() - cached.fetchedAt) < CACHE_TTL_MS) {
    return cached.result;
  }

  const [verifiedRes, honeypotRes, goplusRes] = await Promise.all([
    checkBscScanVerified(tokenAddr),
    checkHoneypot(tokenAddr, pairAddr),
    checkGoPlusSecurity(tokenAddr),
  ]);

  // Honeypot.is simulationSuccess=false ise sonuç güvenilir değil — isHoneypot'a güvenme
  const honeypotReliable = honeypotRes?.simulationSuccess !== false && !honeypotRes?.error;
  const goplusHp = goplusRes && !goplusRes.error && String(goplusRes.is_honeypot) === '1';
  const isHoneypotSafe = (honeypotReliable && honeypotRes?.isHoneypot === true)
    || (!honeypotReliable && goplusHp);

  const result = {
    address: tokenAddr,
    pair: pairAddr,
    bscScan: verifiedRes,
    honeypot: honeypotRes,
    goplus: goplusRes,
    // Özet bayraklar — auditor için
    isHoneypot: isHoneypotSafe,
    isVerified: verifiedRes?.verified === true,
    honeypotReliable,
    riskLevel: _deriveRiskLevel(verifiedRes, honeypotRes, honeypotReliable, goplusRes),
    fetchedAt: Date.now(),
  };

  _cache.set(cacheKey, { result, fetchedAt: Date.now() });
  return result;
}

function _deriveRiskLevel(verifiedRes, honeypotRes, honeypotReliable, goplusRes) {
  const goplusHp = goplusRes && !goplusRes.error && String(goplusRes.is_honeypot) === '1';
  const gpMint = goplusRes && !goplusRes.error && String(goplusRes.is_mintable) === '1';
  const gpHidden = goplusRes && !goplusRes.error && String(goplusRes.hidden_owner) === '1';
  const gpTakeBack = goplusRes && !goplusRes.error && String(goplusRes.can_take_back_ownership) === '1';

  // SCAM: honeypot kesin (simülasyon güvenilir) veya simülasyon güvensizken GoPlus honeypot=1
  if (honeypotReliable && honeypotRes?.isHoneypot === true) return 'scam';
  if (!honeypotReliable && goplusHp) return 'scam';
  // Simülasyon "temiz" ama GoPlus honeypot — ihtiyatlı: critical (yanlış pozitif ihtimali)
  if (honeypotReliable && honeypotRes?.isHoneypot === false && goplusHp) return 'critical';
  // CRITICAL: yüksek risk skoru (riskLevel numerik 0-100)
  const riskScore = parseInt(honeypotRes?.summaryRiskLevel) || 0;
  if (honeypotReliable && riskScore >= 80) return 'critical';
  if (gpMint || gpHidden || gpTakeBack) return 'critical';
  // RISK: verified değil veya yüksek buy/sell tax (>15%)
  const buyTax = parseFloat(honeypotRes?.buyTax) || 0;
  const sellTax = parseFloat(honeypotRes?.sellTax) || 0;
  if (verifiedRes?.verified === false) return 'risk';
  if (honeypotReliable && (buyTax > 15 || sellTax > 15)) return 'risk';
  if (honeypotReliable && riskScore >= 50) return 'risk';
  const gBuy = parseFloat(goplusRes?.buy_tax) || 0;
  const gSell = parseFloat(goplusRes?.sell_tax) || 0;
  if (!goplusRes?.error && (gBuy > 15 || gSell > 15)) return 'risk';
  // SAFE: hepsi temiz
  if (verifiedRes?.verified === true && honeypotReliable && honeypotRes?.isHoneypot === false) return 'safe';
  return 'unknown';
}

// ─────────────────────────────────────────────────────────────
// 4. Token nesnesini ZENGİNLEŞTİR — mevcut Token.contract şemasıyla uyumlu
// ─────────────────────────────────────────────────────────────
async function enrichToken(token, opts = {}) {
  if (!token || token.chain !== 'bsc' || !token.tokenAddress) return token;
  const includeSybil = opts.includeSybil !== false;

  const risk = await scanToken(token.tokenAddress, token.poolAddress);
  if (!risk) return token;

  const fromHp = risk.honeypot?.totalHolders;
  // Kart/yorum: yalnızca Honeypot.is holder; GoPlus holder_count audit için bsc_extra.goplus'ta kalır.
  const combinedHolders = (fromHp && fromHp > 0) ? fromHp : null;

  // auditor.js ortak token alanlarına bakar; BSC için doldurulan alanlar:
  //   - verified: kontrat doğrulanmış mı
  //   - holders_count: holder sayısı
  //   - is_scam: honeypot mu
  //   - admin: null (BSC'de owner concept'i farklı)
  token.contract = {
    verified: risk.isVerified === true,
    is_scam: risk.isHoneypot === true,
    holders_count: combinedHolders ?? risk.honeypot?.totalHolders ?? null,
    // channels.js / auditor ile uyumlu alan adları
    holdersCount: combinedHolders ?? risk.honeypot?.totalHolders ?? null,
    admin: null,
    // BSC ek bilgileri
    bsc_extra: {
      contractName: risk.bscScan?.contractName,
      isProxy: risk.bscScan?.proxy,
      buyTax: risk.honeypot?.buyTax,
      sellTax: risk.honeypot?.sellTax,
      transferTax: risk.honeypot?.transferTax,
      honeypotReason: risk.honeypot?.honeypotReason,
      summaryRisk: risk.honeypot?.summaryRisk,
      summaryRiskLevel: risk.honeypot?.summaryRiskLevel,
      flags: risk.honeypot?.flags,
      riskLevel: risk.riskLevel,
      goplus: risk.goplus && !risk.goplus.error ? risk.goplus : null,
      goplusError: risk.goplus?.error || null,
    },
  };

  if (combinedHolders && !token.holdersCount) {
    token.holdersCount = combinedHolders;
  }

  if (includeSybil && token.poolAddress && process.env.BSC_SYBIL_ENABLED !== '0') {
    try {
      const sybil = require('./sybilDetector');
      token.sybilAnalysis = await sybil.analyzePool(token.poolAddress, 6);
    } catch (e) {
      console.warn('[bsc] sybil analiz fail:', e.message);
      token.sybilAnalysis = {
        buyersAnalyzed: 0,
        largestClusterSize: 0,
        clusterRatio: 0,
        sharedFunder: null,
        sybilDetected: false,
        source: 'unknown',
      };
    }
  }

  return token;
}

module.exports = {
  checkBscScanVerified,
  checkHoneypot,
  checkGoPlusSecurity,
  scanToken,
  enrichToken,
};
