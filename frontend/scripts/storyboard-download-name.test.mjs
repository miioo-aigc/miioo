import test from 'node:test';
import assert from 'node:assert/strict';
import { storyboardVideoDownloadName } from '../src/utils/StoryboardDownloadName.js';
const first = { id: 'a', media_type: 'video' };
const second = { id: 'b', media_type: 'video' };
const context = { projectName: '项目名', episode: { title: '分集名' }, shot: { number: 3 }, media: second, candidates: [first, { id: 'image', media_type: 'image' }, second] };
test('视频序号排除图片，分镜编号补齐两位并保留前缀', () => {
  assert.equal(storyboardVideoDownloadName(context), '项目名-分集名-分镜03-02.mp4');
});
test('详情对象按身份匹配，跟随候选当前展示顺序', () => {
  assert.equal(storyboardVideoDownloadName({ ...context, media: { ...second }, candidates: [second, first] }), '项目名-分集名-分镜03-01.mp4');
});
test('清理非法文件名字符，兼容字符串分集与超过三位的编号', () => {
  assert.equal(storyboardVideoDownloadName({ ...context, projectName: '项目/名', episode: '第1集:开端', shot: { number: 1001 } }), '项目_名-第1集_开端-分镜1001-02.mp4');
});
test('未知候选不伪造序号', () => {
  assert.throws(() => storyboardVideoDownloadName({ ...context, media: { id: 'missing', media_type: 'video' } }), /未找到/);
});

test('分镜编号与列表两位格式一致', () => {
  assert.equal(storyboardVideoDownloadName({ ...context, shot: { number: '001' } }), '项目名-分集名-分镜01-02.mp4');
});
