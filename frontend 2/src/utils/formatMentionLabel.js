export default function formatMentionLabel(name) {
  const dotIdx = name.lastIndexOf('.');
  if (dotIdx === -1) return name.length > 9 ? name.slice(0, 9) + '…' : name;
  const base = name.slice(0, dotIdx);
  const ext = name.slice(dotIdx);
  const truncBase = base.length > 9 ? base.slice(0, 9) + '…' : base;
  return truncBase + ext;
}
