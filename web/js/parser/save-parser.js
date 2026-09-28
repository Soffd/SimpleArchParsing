// ==== CORE-BEGIN ====
function readVarint(u8, p, end) {
  let result = 0, mult = 1;
  for (;;) {
    if (p >= end) throw new Error('varint overflow');
    const b = u8[p++];
    result += (b & 0x7f) * mult;
    if (!(b & 0x80)) return [result, p];
    mult *= 128;
    if (mult > Math.pow(2, 63)) throw new Error('varint too long');
  }
}
function* iterFields(u8, start, end) {
  if (end === undefined) end = u8.length;
  let p = start || 0;
  while (p < end) {
    let r = readVarint(u8, p, end); const tag = r[0]; p = r[1];
    const fno = Math.floor(tag / 8), wt = tag % 8;
    if (fno === 0) throw new Error('field 0');
    if (wt === 0) { r = readVarint(u8, p, end); p = r[1]; yield [fno, 0, r[0]]; }
    else if (wt === 1) { if (p + 8 > end) throw new Error('fixed64 overflow'); yield [fno, 1, u8.subarray(p, p + 8)]; p += 8; }
    else if (wt === 2) {
      r = readVarint(u8, p, end); p = r[1]; const ln = r[0];
      if (p + ln > end) throw new Error('len overflow');
      yield [fno, 2, u8.subarray(p, p + ln)]; p += ln;
    }
    else if (wt === 5) { if (p + 4 > end) throw new Error('fixed32 overflow'); yield [fno, 5, u8.subarray(p, p + 4)]; p += 4; }
    else throw new Error('wiretype ' + wt);
  }
}
const TD = new TextDecoder('utf-8');
function decStr(u8) { return TD.decode(u8); }
function hexOf(u8) { let s = ''; for (let i = 0; i < u8.length; i++) s += u8[i].toString(16).padStart(2, '0'); return s; }
function parseMapEntry(u8) {
  let key = null, value = null;
  for (const f of iterFields(u8, 0, u8.length)) {
    const fno = f[0], wt = f[1], v = f[2];
    if (fno === 1) key = (wt === 2) ? decStr(v) : v;
    else if (fno === 2) value = (wt === 0) ? !!v : v;
  }
  return [key, value];
}
const SCORE_INT_FIELDS = {1:'chapter',3:'hard',10:'perfect',11:'earlyGood',12:'lateGood',13:'earlyBad',14:'lateBad',15:'miss',16:'fullComboCount',17:'maxComboCount'};
function parseSongScore(u8) {
  const o = {chapter:0,musicName:'',hard:0,perfect:0,earlyGood:0,lateGood:0,earlyBad:0,lateBad:0,miss:0,fullComboCount:0,maxComboCount:0};
  const unknown = [];
  for (const f of iterFields(u8, 0, u8.length)) {
    const fno = f[0], wt = f[1], v = f[2];
    if (fno === 2 && wt === 2) o.musicName = decStr(v);
    else if (SCORE_INT_FIELDS[fno] !== undefined && wt === 0) o[SCORE_INT_FIELDS[fno]] = v;
    else unknown.push({field:fno, wiretype:wt, raw:(typeof v === 'number') ? v : hexOf(v)});
  }
  if (unknown.length) o._unknown = unknown;
  return o;
}
function parsePlayerInfo(u8) {
  const info = {playerName:'', scores:[], unlockedStatus:{}, unionId:'', deviceInfo:''};
  const unknown = [];
  for (const f of iterFields(u8, 0, u8.length)) {
    const fno = f[0], wt = f[1], v = f[2];
    if (fno === 1 && wt === 2) info.playerName = decStr(v);
    else if (fno === 2 && wt === 2) info.scores.push(parseSongScore(v));
    else if (fno === 3 && wt === 2) { const kv = parseMapEntry(v); if (kv[0] !== null) info.unlockedStatus[kv[0]] = kv[1]; }
    else if (fno === 4 && wt === 2) info.unionId = decStr(v);
    else if (fno === 5 && wt === 2) info.deviceInfo = decStr(v);
    else unknown.push({field:fno, wiretype:wt, raw:(typeof v === 'number') ? v : hexOf(v)});
  }
  if (unknown.length) info._unknown = unknown;
  return info;
}
function tryBase64Bytes(bytes) {
  if (bytes.length < 16 || bytes.length > 8 * 1024 * 1024) return null;
  let probe = '';
  const n = Math.min(bytes.length, 4096);
  for (let i = 0; i < n; i++) probe += String.fromCharCode(bytes[i]);
  if (!/^[A-Za-z0-9+/=\r\n \t]*$/.test(probe)) return null;
  try {
    let full = new TextDecoder('latin1').decode(bytes);
    full = full.replace(/[\r\n \t]/g, '');
    if (!full || full.length % 4 !== 0) return null;
    const bin = atob(full);
    const u = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    return u;
  } catch (e) { return null; }
}
function detectAndParse(bytes) {
  if (!bytes.length) throw new Error('存档为空');
  const b64 = tryBase64Bytes(bytes);
  const data = b64 || bytes;
  const info = parsePlayerInfo(data);
  info._container = b64 ? 'base64' : 'binary';
  return info;
}
// ==== CORE-END ====

function textToBytes(text) {
  const s = text.trim();
  if (!s) throw new Error('请输入存档码');
  const compact = s.replace(/[\r\n \t]/g, '');
  if (/^(?:0x)?[0-9a-fA-F]+$/.test(compact) && compact.replace(/^0x/i,'').length % 2 === 0) {
    const hex=compact.replace(/^0x/i,'');
    return Uint8Array.from(hex.match(/.{2}/g)||[],h=>parseInt(h,16));
  }
  if (compact.length >= 16 && compact.length % 4 === 0 && /^[A-Za-z0-9+/=]+$/.test(compact)) {
    try {
      const bin = atob(compact);
      const u = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
      return u;
    } catch (e) { /* try hex next */ }
  }
  const hex = compact.replace(/^0x/i, '');
  if (hex.length >= 16 && hex.length % 2 === 0 && /^[0-9a-fA-F]+$/.test(hex)) {
    const u = new Uint8Array(hex.length / 2);
    for (let i = 0; i < u.length; i++) u[i] = parseInt(hex.substr(i * 2, 2), 16);
    return u;
  }
  throw new Error('无法识别的输入（应为 Base64 存档码 / hex 或 .save 文件）');
}
