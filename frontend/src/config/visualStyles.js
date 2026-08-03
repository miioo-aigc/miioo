import style3dNationalXianxia from '../assets/styles/3D国风仙侠@2x.avif';
import style3dCyberpunk from '../assets/styles/3D赛博科幻@2x.avif';
import style2dSuspenseDetective from '../assets/styles/2D悬疑推理@2x.avif';
import style3dNationalHistory from '../assets/styles/3D国风历史@2x.avif';
import style3dWesternFantasy from '../assets/styles/3D西方魔幻@2x.avif';
import style2dGothic from '../assets/styles/2D哥特风@2x.avif';
import style3dWuxia from '../assets/styles/3D武侠CG@2x.avif';
import style3dQVersion from '../assets/styles/3D Q版@2x.avif';
import style2dLineComic from '../assets/styles/2D线条漫@2x.avif';
import style3dModernRealistic from '../assets/styles/3D现代写实@2x.avif';
import style2dCartoon from '../assets/styles/2D卡通动画@2x.avif';
import styleAncientCostumeRealistic from '../assets/styles/古装写实@2x.avif';
import styleEraLife from '../assets/styles/年代生活@2x.avif';
import styleWorkplaceBattle from '../assets/styles/职场商战@2x.avif';
import styleXianxiaFantasy from '../assets/styles/仙侠奇幻@2x.avif';
import styleRepublicanSpy from '../assets/styles/民国谍战@2x.avif';
import styleWuxiaWar from '../assets/styles/武侠战争@2x.avif';
import styleUrbanEmotion from '../assets/styles/都市情感@2x.avif';
import stylePostApocalyptic from '../assets/styles/末日废土@2x.avif';
import styleSuspenseHorror from '../assets/styles/悬疑恐怖@2x.avif';
import styleFutureScifi from '../assets/styles/未来科幻@2x.avif';

// 复原的旧封面只用于历史项目展示，不进入新建项目风格库。
import legacyStyleSuspenseAnime from '../assets/styles/suspense-anime-2d-CbuZpR1F.avif';
import legacyStyleCyberpunk from '../assets/styles/cyberpunk-3d-BNBsCnmk.avif';
import legacyStyleGhibli from '../assets/styles/ghibli-style-DR0ghQp3.avif';
import legacyStyleShinkai from '../assets/styles/shinkai-style-BuE40VSJ.avif';
import legacyStyleAncientChinese from '../assets/styles/ancient-chinese-Dfx9iuti.avif';
import legacyStyleMagicEpic from '../assets/styles/magic-epic-3d-CebahL97.avif';
import legacyStylePixar from '../assets/styles/pixar-style-A2OcN7ym.avif';
import legacyStyleWuxia from '../assets/styles/wuxia-cg-DLtXU02V.avif';
import legacyStyleInkGuofeng from '../assets/styles/ink-guofeng-2d-BV32xmRp.avif';
import legacyStyleDarkGothic from '../assets/styles/dark-gothic-2d-BtjFzKj9.avif';
import legacyStyleLiveActionGufeng from '../assets/styles/live-action-gufeng-BP5UCRIo.avif';
import legacyStyleUrbanEmotion from '../assets/styles/urban-workplace-BVtVWwg7.avif';
import legacyStyleXianxiaFantasy from '../assets/styles/xianxia-fantasy-DDbFrlLW.avif';
import legacyStyleLiveActionHorror from '../assets/styles/live-action-horror-hu3sG1l5.avif';
import legacyStylePostApocalyptic from '../assets/styles/post-apocalyptic-Db3g9pW-.avif';
import legacyStyleRealisticEra from '../assets/styles/realistic-era-BNUAksog.avif';
import legacyStyleFutureScifi from '../assets/styles/future-scifi-CEnr5nlj.avif';
import legacyStyleWorkplace from '../assets/styles/workplace-drama-DuUy1D2j.avif';
import legacyStyleWuxiaWar from '../assets/styles/wuxia-war-B6ARfMm0.avif';
import legacyStyleRural from '../assets/styles/rural-style-Cwc5Zlkg.avif';
import legacyStyleLiveActionSuspense from '../assets/styles/live-action-suspense-BJDQkX-R.avif';

const STYLE = (value, label, coverImg) => ({ value, label, coverImg });

// 新建项目只使用这组风格。能对应旧风格的项目沿用旧 value；只有新增风格才使用 v2 value。
export const NEW_VISUAL_STYLE_GROUPS = [
  {
    category: '动漫风格',
    styles: [
      STYLE('xianxia-3d', '3D国风仙侠', style3dNationalXianxia),
      STYLE('cyberpunk-3d', '3D赛博科幻', style3dCyberpunk),
      STYLE('suspense-anime-2d', '2D悬疑推理', style2dSuspenseDetective),
      STYLE('historical-drama-3d', '3D国风历史', style3dNationalHistory),
      STYLE('fantasy-epic-3d', '3D西方魇幻', style3dWesternFantasy),
      STYLE('dark-gothic-anime', '2D哥特风', style2dGothic),
      STYLE('wuxia-cg', '3D武侠CG', style3dWuxia),
      STYLE('chibi-3d', '3D Q版', style3dQVersion),
      STYLE('webtoon-2d', '2D线条漫', style2dLineComic),
      STYLE('modern-3d', '3D现代写实', style3dModernRealistic),
      STYLE('anime', '2D卡通动画', style2dCartoon),
    ],
  },
  {
    category: '真人写实',
    styles: [
      STYLE('ancient-chinese-live-action', '古装写实', styleAncientCostumeRealistic),
      STYLE('period-drama-live-action', '年代生活', styleEraLife),
      STYLE('urban-workplace', '职场商战', styleWorkplaceBattle),
      STYLE('xianxia-fantasy-live-action', '仙侠奇幻', styleXianxiaFantasy),
      STYLE('republican-spy-live-action', '民国谍战', styleRepublicanSpy),
      STYLE('wuxia-war-live-action', '武侠战争', styleWuxiaWar),
      STYLE('urban-romance-live-action', '都市情感', styleUrbanEmotion),
      STYLE('post-apocalyptic-modern', '末日废土', stylePostApocalyptic),
      STYLE('live-action-suspense', '悬疑恐怖', styleSuspenseHorror),
      STYLE('future-sci-fi-live-action', '未来科幻', styleFutureScifi),
    ],
  },
];

// 历史项目使用原枚举和原封面，不能替换成新风格的同名项目。
export const LEGACY_VISUAL_STYLE_LIST = [
  STYLE('ghibli-style', '宫崎骏风格', legacyStyleGhibli),
  STYLE('shinkai-style', '新海诚风格', legacyStyleShinkai),
  STYLE('ancient-ink-2d', '2D写意古风', legacyStyleInkGuofeng),
  STYLE('rural-live-action', '乡土风格', legacyStyleRural),
  STYLE('cyberpunk', '赛博朋克', legacyStyleCyberpunk),
  STYLE('pixar-style', '皮克斯风格', legacyStylePixar),
  STYLE('2d-animation', '2D动画', legacyStyleSuspenseAnime),
  STYLE('3d-animation', '3D动画', legacyStyleAncientChinese),
  STYLE('oil-painting', '油画风格', legacyStyleMagicEpic),
  STYLE('live-action', '真人影视', legacyStyleLiveActionGufeng),
  // 兼容旧版前端曾提交过、但不在后端当前目录中的值；同名 ACTIVE 值由前面的新配置优先解析。
  STYLE('suspense-anime-2d', '2D悬疑恐怖', legacyStyleSuspenseAnime),
  STYLE('cyberpunk-3d', '3D赛博朋克', legacyStyleCyberpunk),
  STYLE('ancient-chinese-live-action', '3D国风正剧', legacyStyleAncientChinese),
  STYLE('magic-epic-3d', '3D魔幻史诗', legacyStyleMagicEpic),
  STYLE('wuxia-cg', '武侠CG', legacyStyleWuxia),
  STYLE('ink-guofeng-2d', '2D写意古风', legacyStyleInkGuofeng),
  STYLE('dark-gothic-2d', '暗黑哥特', legacyStyleDarkGothic),
  STYLE('live-action-gufeng', '古风写实', legacyStyleLiveActionGufeng),
  STYLE('urban-emotion', '都市情感', legacyStyleUrbanEmotion),
  STYLE('xianxia-fantasy', '仙侠玄幻', legacyStyleXianxiaFantasy),
  STYLE('live-action-horror', '悬疑恐怖', legacyStyleLiveActionHorror),
  STYLE('post-apocalyptic-modern', '末日废土', legacyStylePostApocalyptic),
  STYLE('realistic-era', '写实年代剧', legacyStyleRealisticEra),
  STYLE('future-scifi', '未来科幻', legacyStyleFutureScifi),
  STYLE('workplace-drama', '职场商战', legacyStyleWorkplace),
  STYLE('wuxia-war', '武侠战争', legacyStyleWuxiaWar),
  STYLE('rural-style', '乡土风格', legacyStyleRural),
  STYLE('live-action-suspense', '真人悬疑', legacyStyleLiveActionSuspense),
];

// 保留旧导出名，供已有页面读取全部可识别风格；新建项目请使用 NEW_VISUAL_STYLE_GROUPS。
export const VISUAL_STYLE_GROUPS = NEW_VISUAL_STYLE_GROUPS;
export const VISUAL_STYLE_LIST = [
  ...NEW_VISUAL_STYLE_GROUPS.flatMap((group) => group.styles),
  ...LEGACY_VISUAL_STYLE_LIST,
];

export function getVisualStyle(value) {
  return VISUAL_STYLE_LIST.find((style) => style.value === value) || null;
}
