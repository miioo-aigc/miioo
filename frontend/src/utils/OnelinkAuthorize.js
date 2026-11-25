// 与平台文档一致：三个 Base64 字段按 iv:authTag:ciphertext 拼接。
function toBase64(bytes) {
  return btoa(Array.from(bytes, byte => String.fromCharCode(byte)).join(''));
}

export async function encryptOnelinkPayload(data, keyString, webCrypto = globalThis.crypto) {
  if (typeof keyString !== 'string' || !keyString.trim()) {
    throw new Error('账号授权参数尚未配置，请先使用其他登录方式');
  }
  // 新交接契约要求原始密钥恰好 32 字节，不截取、不补位。
  const keyBytes = new TextEncoder().encode(keyString);
  if (keyBytes.length !== 32) throw new Error('账号授权参数配置有误，请联系管理员');
  if (!webCrypto?.subtle) throw new Error('当前环境不支持安全授权，请使用安全连接访问');
  const key = await webCrypto.subtle.importKey('raw', keyBytes, 'AES-GCM', false, ['encrypt']);
  const iv = webCrypto.getRandomValues(new Uint8Array(12));
  const encrypted = new Uint8Array(await webCrypto.subtle.encrypt(
    { name: 'AES-GCM', iv, tagLength: 128 }, key, new TextEncoder().encode(JSON.stringify(data)),
  ));
  return [iv, encrypted.slice(-16), encrypted.slice(0, -16)].map(toBase64).join(':');
}

export async function buildOnelinkAuthorizeUrl({ authorizeUrl, payload, allowedOrigin, keyString }) {
  const target = new URL(authorizeUrl);
  if (target.protocol !== 'https:' || target.origin !== new URL(allowedOrigin).origin
    || target.username || target.password || target.hash) throw new Error('授权地址配置有误，请稍后重试');
  if (!payload || typeof payload.state !== 'string' || !payload.state
    || !Number.isFinite(payload.timestamp) || typeof payload.callback !== 'string') {
    throw new Error('授权服务返回参数不完整，请稍后重试');
  }
  const callback = new URL(payload.callback);
  if (callback.protocol !== 'https:' || callback.username || callback.password || callback.hash
    || callback.pathname !== '/api/auth/callback/onelink'
    || callback.searchParams.getAll('state').length !== 1
    || callback.searchParams.get('state') !== payload.state) throw new Error('授权回调配置有误，请联系管理员');
  const enc = await encryptOnelinkPayload({ ...payload, clientType: 'web', clientName: 'miioo', name: 'miioo' }, keyString);
  target.searchParams.set('enc', enc);
  return target.href;
}
