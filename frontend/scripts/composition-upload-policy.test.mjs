import test from "node:test";
import assert from "node:assert/strict";
import { compositionUploadAccept, validateCompositionUpload as validate } from "../src/utils/CompositionUploadPolicy.js";

test("分类白名单、大小写及音频类型别名", async () => {
  assert.equal(compositionUploadAccept("video"), ".mp4,.mov");
  for (const [name, mime, tab] of [["a.JPG", "image/jpeg", "image"], ["a.mp4", "video/mp4", "video"], ["a.mov", "video/quicktime", "video"], ...["audio/mpeg", "audio/mp3"].map(m => ["a.mp3", m, "audio"]), ...["audio/wav", "audio/x-wav", "audio/wave"].map(m => ["a.wav", m, "audio"])]) {
    const file = new File(["data"], name, { type: mime });
    assert.equal(await validate(file, tab), file);
  }
});
test("跨标签、非白名单及矛盾类型在读取内容前拒绝", async () => {
  for (const [name, mime, tab] of [["a.mp4", "video/mp4", "image"], ["a.png", "image/png", "audio"], ["a.svg", "image/svg+xml", "image"], ["a.webm", "video/webm", "video"], ["a.m4a", "audio/mp4", "audio"], ["a.jpg", "video/mp4", "image"], ["a.png", "image/jpeg", "image"], ["a.mp3", "application/octet-stream", "audio"]]) {
    await assert.rejects(validate({ name, type: mime, size: 4, slice() { throw new Error("不应读取"); } }, tab));
  }
});
test("文件上限允许等值，超限与空文件拒绝", async () => {
  for (const [name, type, tab, mb] of [["a.jpg", "image/jpeg", "image", 20], ["a.mp4", "video/mp4", "video", 50], ["a.mp3", "audio/mpeg", "audio", 15]]) {
    const file = { name, type, size: mb * 1024 * 1024 };
    assert.equal(await validate(file, tab), file);
    await assert.rejects(validate({ ...file, size: file.size + 1 }, tab), /不能超过/);
    await assert.rejects(validate({ ...file, size: 0 }, tab), /文件为空/);
  }
});
test("空类型检查文件头并补齐类型，保持名称与内容", async () => {
  for (const [name, data, tab, mime] of [["a.png", [137,80,78,71,13,10,26,10], "image", "image/png"], ["a.jpg", [255,216,255,224], "image", "image/jpeg"], ["a.gif", "GIF89a1234", "image", "image/gif"], ["a.webp", "RIFF0000WEBP", "image", "image/webp"], ["a.wav", "RIFF0000WAVE", "audio", "audio/wav"], ["a.mp3", [73,68,51,4,0,0,0,0,0,0], "audio", "audio/mpeg"], ["a.mp4", "0000ftypisom0000", "video", "video/mp4"], ["a.mov", "0000ftypqt  0000", "video", "video/quicktime"]]) {
    const file = new File([typeof data === "string" ? data : new Uint8Array(data)], name, { lastModified: 123 });
    const result = await validate(file, tab);
    assert.equal(result.type, mime);
    assert.equal(result.name, name);
    assert.equal(result.lastModified, 123);
    assert.deepEqual(await result.arrayBuffer(), await file.arrayBuffer());
  }
});
test("空类型伪装、未知容器及读取失败拒绝", async () => {
  await assert.rejects(validate(new File(["data"], "png", { type: "image/png" }), "image"), /仅支持/);
  await assert.rejects(validate(new File(["0000ftypavif0000"], "a.mp4"), "video"), /无法确认/);
  await assert.rejects(validate(new File(["not an image"], "a.jpg"), "image"), /无法确认/);
  await assert.rejects(validate({ name: "a.png", size: 10, type: "", slice() { throw new Error("读取失败"); } }, "image"), /无法读取/);
});
