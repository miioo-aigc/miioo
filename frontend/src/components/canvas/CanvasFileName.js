/** 本地文件标题仅移除最后一段扩展名。 */
export function getCanvasFileName(name = '') {
  const value = String(name).trim();
  const dot = value.lastIndexOf('.');
  return (dot > 0 ? value.slice(0, dot) : value).trim() || value;
}
