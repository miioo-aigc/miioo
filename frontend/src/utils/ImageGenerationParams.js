export function imageModelOptions(models) {
  return models.filter((m) => m.enabled !== false && m.is_enabled !== false).map((m) => {
    const caps = m.capabilities || {};
    return {
      value: m.model_id || m.id,
      label: m.name || m.model_id || m.id,
      is_default: m.is_default,
      resolutions: caps.supported_resolutions?.length ? caps.supported_resolutions : (caps.supported_sizes || []),
      resolutionSizeMap: caps.resolution_size_map || {},
      ratios: caps.supported_aspect_ratios || [],
    };
  });
}

export function imageRatios(model, resolution) {
  const mapped = Object.keys(model?.resolutionSizeMap?.[resolution] || {});
  return mapped.length ? mapped : (model?.ratios || []);
}

export function matchImageParams(models, source) {
  const model = models.find((m) => m.value === source.model) || models.find((m) => m.is_default);
  if (!model || !source.ratio || !source.resolution) return null;
  const resolutions = model.resolutions.filter((r) => imageRatios(model, r).includes(source.ratio));
  const exact = resolutions.find((r) => String(r).toUpperCase() === String(source.resolution).toUpperCase());
  if (exact) return { model: model.value, ratio: source.ratio, resolution: exact };
  const size = (r) => /^\d+(\.\d+)?k$/i.test(String(r)) ? parseFloat(r) : NaN;
  const target = size(source.resolution);
  if (!Number.isFinite(target)) return null;
  const closest = resolutions.filter((r) => Number.isFinite(size(r)))
    .sort((a, b) => Math.abs(size(a) - target) - Math.abs(size(b) - target) || size(a) - size(b))[0];
  return closest ? { model: model.value, ratio: source.ratio, resolution: closest } : null;
}
