/**
 * @file SubjectCertificationAdapter.js
 * @structure-index
 * 主体真人素材认证绑定响应的纯数据适配，不调用 API 或读取页面状态。
 */

const APPROVED = new Set(['active', 'approved', 'success', 'succeeded', 'completed', 'complete', 'ready', 'done']);
const FAILED = new Set(['failed', 'rejected', 'reject', 'invalid', 'error']);

export function unwrapSubjectBindings(payload) {
  if (Array.isArray(payload)) return payload;
  return payload?.list ?? payload?.items ?? payload?.data ?? payload?.bindings ?? [];
}

export function getSubjectCertificationStatus(binding) {
  if (!binding) return 'unverified';
  const status = String(binding.asset?.status || binding.status || '').trim().toLowerCase();
  if (APPROVED.has(status)) return 'approved';
  if (FAILED.has(status)) return 'failed';
  return 'pending';
}

export function buildSubjectCertificationMap(payload) {
  return unwrapSubjectBindings(payload).reduce((map, binding) => {
    const subjectType = String(binding?.subject_type || binding?.subjectType || '').toLowerCase();
    if (!binding?.subject_id || (subjectType && !['character', 'char', 'role'].includes(subjectType))) return map;
    map[binding.subject_id] = { status: getSubjectCertificationStatus(binding), binding };
    return map;
  }, {});
}
