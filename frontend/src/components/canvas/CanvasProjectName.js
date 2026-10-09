export const PROJECT_NAME_MAX_LENGTH = 50;
const PROJECT_NAME_CHARACTER_PATTERN = /^[\p{L}\p{N}\p{P}\p{Zs}]$/u;

export function normalizeProjectName(value) {
  return Array.from(String(value ?? ''))
    .filter((character) => PROJECT_NAME_CHARACTER_PATTERN.test(character))
    .slice(0, PROJECT_NAME_MAX_LENGTH)
    .join('');
}

export function validateProjectName(value) {
  const name = String(value ?? '');
  if (!name.trim()) return '项目名称不能为空';
  if (Array.from(name).length > PROJECT_NAME_MAX_LENGTH) return `项目名称不能超过${PROJECT_NAME_MAX_LENGTH}个字`;
  if (Array.from(name).some((character) => !PROJECT_NAME_CHARACTER_PATTERN.test(character))) return '项目名称只允许中文、英文、数字、空格和普通标点符号';
  return '';
}
