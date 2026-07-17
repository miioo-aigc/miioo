/**
 * @file SubjectGenerationParams.js
 * @structure-index
 *
 * ─── 纯数据转换 ─────────────────────────────────────────────────────
 *   buildSubjectGenerationParams  组装主体生图 API 参数
 *
 * ─── 依赖边界 ───────────────────────────────────────────────────────
 *   只接收表单值并返回新对象；不引用 React、页面、API、Store 或 Toast
 *
 * ─── 更新记录 ───────────────────────────────────────────────────────
 *   2026-07-15  从 SubjectPage 抽离主体生图参数组装逻辑
 */

export function buildSubjectGenerationParams({
  model,
  ratio,
  resolution,
  prompt,
  generationMode,
  refImageIds = [],
}) {
  const params = {
    model,
    ratio,
    resolution,
    size: resolution,
    prompt,
    generation_mode: generationMode,
  };

  if (Array.isArray(refImageIds) && refImageIds.length > 0) {
    params.reference_mode = 'use_reference';
    params.reference_images = refImageIds.map((item) => (
      typeof item === 'object' && item?.url ? item.url : String(item)
    ));
  }

  return params;
}

