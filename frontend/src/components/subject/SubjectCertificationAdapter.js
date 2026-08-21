/**
 * @file SubjectCertificationAdapter.js
 * @structure-index
 * 主体真人素材认证绑定响应的纯数据适配，不调用 API 或读取页面状态。
 */

const APPROVED = new Set(['active', 'approved', 'success', 'succeeded', 'completed', 'complete', 'ready', 'done']);
const FAILED = new Set(['failed', 'rejected', 'reject', 'invalid', 'error']);

function getBindingSubjectId(binding) {
  return binding?.subject_id ?? binding?.subjectId ?? null;
}

function getBindingPrimaryAssetId(binding) {
  return binding?.primary_asset_id
    ?? binding?.primaryAssetId
    ?? binding?.asset?.primary_asset_id
    ?? binding?.asset?.primaryAssetId
    ?? binding?.asset?.metadata_json?.primary_asset_id
    ?? binding?.asset?.metadata_json?.primaryAssetId
    ?? binding?.asset?.metadataJson?.primary_asset_id
    ?? binding?.asset?.metadataJson?.primaryAssetId
    ?? null;
}

function getBindingUpdatedAt(binding) {
  return binding?.updated_at ?? binding?.updatedAt ?? binding?.created_at ?? binding?.createdAt ?? '';
}

function compareBindingsByRecency(left, right) {
  return String(getBindingUpdatedAt(right)).localeCompare(String(getBindingUpdatedAt(left)));
}

export function unwrapSubjectBindings(payload) {
  if (Array.isArray(payload)) return payload;
  return payload?.list ?? payload?.items ?? payload?.data ?? payload?.bindings ?? [];
}

export function getSubjectCertificationStatus(binding) {
  if (!binding) return 'unverified';
  const status = String(binding.status || binding.asset?.status || '').trim().toLowerCase();
  if (APPROVED.has(status)) return 'approved';
  if (FAILED.has(status)) return 'failed';
  return 'pending';
}

export function buildSubjectCertificationMap(payload) {
  return unwrapSubjectBindings(payload).reduce((map, binding) => {
    const subjectType = String(binding?.subject_type || binding?.subjectType || '').toLowerCase();
    const subjectId = getBindingSubjectId(binding);
    if (!subjectId || (subjectType && !['character', 'char', 'role'].includes(subjectType))) return map;

    const certification = { status: getSubjectCertificationStatus(binding), binding };
    const previous = map[subjectId];
    const records = [...(previous?.records ?? []), certification]
      .sort((left, right) => compareBindingsByRecency(left.binding, right.binding));

    map[subjectId] = { ...records[0], records };
    return map;
  }, {});
}

/**
 * 认证状态必须与角色当前定稿图一一对应。认证素材的类型或来源不参与可用性判断：
 * 任意 Seedance 素材库记录只要认证通过，当前定稿图即可使用。
 */
export function getCurrentSubjectCertificationStatus(subject, certification) {
  return getCurrentSubjectCertification(subject, certification)?.status ?? 'unverified';
}

export function getCurrentSubjectCertification(subject, certification) {
  const currentAssetId = subject?.primary_asset_id ?? subject?.primaryAssetId;
  if (!currentAssetId || !certification) return null;

  const records = certification.records ?? [certification];
  return records
    .filter((record) => String(getBindingPrimaryAssetId(record?.binding)) === String(currentAssetId))
    .sort((left, right) => compareBindingsByRecency(left.binding, right.binding))[0] ?? null;
}
