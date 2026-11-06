// This is a client-side guard, not a replacement for server-side filtering.
export function assertCanvasSharePrivacy(payload) {
  const document = payload?.document;
  if (!document || document.engine !== 'xyflow' || document.schemaVersion !== 1
    || !Array.isArray(document.records) || Object.hasOwn(document, 'nodes')
    || Object.hasOwn(document, 'schema_version')) {
    throw new Error('分享文档格式不符合公开协议，不支持开发草稿');
  }
  for (const record of payload?.document?.records || []) {
    const props = record?.props;
    if (!props || typeof props !== 'object') continue;
    if (Object.hasOwn(props, 'nodeResults') || Object.hasOwn(props, 'resultAssetViews')) {
      throw new Error('分享数据包含未公开的结果历史，请联系画布所有者');
    }
  }
}
