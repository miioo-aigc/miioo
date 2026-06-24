/**
 * 分镜数据工具 / Storyboard data utilities.
 * 纯函数和常量，无 React 依赖。
 */

const EPISODES = ['第一集', '第二集'];

function makeShot(number, overrides = {}) {
  return {
    id: `shot-${number}-${Date.now()}-${Math.random()}`,
    number,
    description: '',
    params: { framing: '全景', cameraMotion: '固定机位', angle: '平视拍摄', composition: '三分法构图', duration: '3s' },
    lightShadow: '',
    ambientSound: '',
    narration: { segments: [] },
    mainRefs: [],
    storyboardImage: null,
    storyboardVideo: null,
    ...overrides,
  };
}

// 初始示例分镜（目前未被引用，保留供未来重置/模板使用）
const INITIAL_SHOTS = [
  makeShot(1, {
    description: '夜晚，城市街道，霓虹灯闪烁。主角独自走在雨中，雨水打湿了他的外套，他停下脚步，抬头望向远处的高楼大厦，若有所思。',
    params: { framing: '远景', cameraMotion: '缓慢拉近', angle: '平视', composition: '三分线构图', duration: '3s' },
    lightShadow: '全局柔光，阳光穿过树叶缝隙',
    ambientSound: '微微的风声',
  }),
  makeShot(2, {
    description: '室内，咖啡馆，午后阳光斜射进来。女主角坐在窗边，手捧咖啡，目光落在窗外的行人身上，嘴角微微上扬。',
    params: { framing: '中景', cameraMotion: '固定', angle: '平视', composition: '三分线构图', duration: '3s' },
    lightShadow: '全局柔光，阳光穿过树叶缝隙',
    ambientSound: '微微的风声',
  }),
  makeShot(3, {
    description: '黄昏，公园小径，落叶飘零。两人并肩而行，偶尔对视，空气中弥漫着淡淡的暧昧与不舍。',
    params: { framing: '全景', cameraMotion: '跟随', angle: '平视', composition: '三分线构图', duration: '3s' },
    lightShadow: '黄昏暖光',
    ambientSound: '微微的风声',
  }),
];

export { EPISODES, makeShot, INITIAL_SHOTS };
