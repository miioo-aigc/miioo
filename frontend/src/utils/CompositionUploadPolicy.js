const FORMATS = {
  jpg: ["image", "image/jpeg"], jpeg: ["image", "image/jpeg"],
  png: ["image", "image/png"], gif: ["image", "image/gif"], webp: ["image", "image/webp"],
  mp4: ["video", "video/mp4"], mov: ["video", "video/quicktime"],
  mp3: ["audio", "audio/mpeg", "audio/mp3"],
  wav: ["audio", "audio/wav", "audio/x-wav", "audio/wave"],
};
const LIMITS = { image: 20, video: 50, audio: 15 };
const LABELS = { image: "图片", video: "视频", audio: "音频" };

export function compositionUploadAccept(type) {
  return Object.entries(FORMATS).filter(([, values]) => values[0] === type)
    .map(([extension]) => "." + extension).join(",");
}

function matchesHeader(bytes, extension) {
  const text = (offset, length) => String.fromCharCode(...bytes.slice(offset, offset + length));
  if (extension === "jpg" || extension === "jpeg") return bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  if (extension === "png") return [137, 80, 78, 71, 13, 10, 26, 10].every((value, i) => bytes[i] === value);
  if (extension === "gif") return ["GIF87a", "GIF89a"].includes(text(0, 6));
  if (extension === "webp") return text(0, 4) === "RIFF" && text(8, 4) === "WEBP";
  if (extension === "wav") return text(0, 4) === "RIFF" && text(8, 4) === "WAVE";
  if (extension === "mp3") {
    if (text(0, 3) === "ID3") return bytes.length >= 10 && [2, 3, 4].includes(bytes[3]);
    return bytes.length >= 4 && bytes[0] === 255 && (bytes[1] & 224) === 224
      && (bytes[1] & 24) !== 8 && (bytes[1] & 6) === 2
      && (bytes[2] & 240) !== 0 && (bytes[2] & 240) !== 240 && (bytes[2] & 12) !== 12;
  }
  // 空类型只兼容可明确识别的容器；HEIF/AVIF同属ftyp，不能仅凭ftyp放行。
  if (bytes.length < 16 || text(4, 4) !== "ftyp") return false;
  const brand = text(8, 4);
  return extension === "mov" ? brand === "qt  "
    : ["isom", "iso2", "iso3", "iso4", "iso5", "iso6", "mp41", "mp42", "avc1", "M4V ", "MSNV"].includes(brand);
}

/** 仅素材箱本地上传使用。空MIME须识别文件头，补齐规范类型供后端校验。 */
export async function validateCompositionUpload(file, type) {
  const extension = /.([^.]+)$/.exec(file.name)?.[1].toLowerCase();
  const format = FORMATS[extension];
  if (!LIMITS[type] || !format || format[0] !== type) {
    throw new Error(`当前${LABELS[type] || "素材"}标签仅支持 ${compositionUploadAccept(type)}，请选择匹配的文件`);
  }
  if (!Number.isFinite(file.size) || file.size <= 0) throw new Error("文件为空，无法上传");
  if (file.size > LIMITS[type] * 1024 * 1024) throw new Error(`${LABELS[type]}文件不能超过 ${LIMITS[type]} MB`);
  const mime = (file.type || "").toLowerCase();
  if (mime && !format.slice(1).includes(mime)) throw new Error("文件类型与扩展名不匹配，或格式不受支持");
  if (mime) return file;
  let bytes;
  try { bytes = new Uint8Array(await file.slice(0, 64).arrayBuffer()); }
  catch { throw new Error("无法读取文件格式，请重新选择文件"); }
  if (!matchesHeader(bytes, extension)) throw new Error("无法确认文件格式，文件内容与扩展名不匹配或格式不受支持");
  return new File([file], file.name, { type: format[1], lastModified: file.lastModified });
}
