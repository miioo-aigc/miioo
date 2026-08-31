/**
 * @file DubbingVoiceLanguage.js
 *
 * 配音音色语言筛选的展示名称和排序规则。
 * value 保留后端原始语言值，label 统一使用中文展示。
 */

const LANGUAGE_LABELS = {
  Afrikaans: "南非荷兰语",
  Arabic: "阿拉伯语",
  Bulgarian: "保加利亚语",
  Catalan: "加泰罗尼亚语",
  Chinese: "中文",
  Croatian: "克罗地亚语",
  Czech: "捷克语",
  Danish: "丹麦语",
  Filipino: "菲律宾语",
  English: "英语",
  Dutch: "荷兰语",
  Finnish: "芬兰语",
  French: "法语",
  German: "德语",
  Greek: "希腊语",
  Hebrew: "希伯来语",
  Hindi: "印地语",
  Hungarian: "匈牙利语",
  Indonesian: "印度尼西亚语",
  Italian: "意大利语",
  Japanese: "日语",
  Korean: "韩语",
  Malay: "马来语",
  Nepali: "尼泊尔语",
  Norwegian: "挪威语",
  Persian: "波斯语",
  Polish: "波兰语",
  Portuguese: "葡萄牙语",
  Romanian: "罗马尼亚语",
  Russian: "俄语",
  Slovenian: "斯洛文尼亚语",
  Spanish: "西班牙语",
  Swedish: "瑞典语",
  Slovak: "斯洛伐克语",
  Tamil: "泰米尔语",
  Thai: "泰语",
  Turkish: "土耳其语",
  Ukrainian: "乌克兰语",
  Vietnamese: "越南语",
  "zh-cn": "中文",
  "zh_cn": "中文",
  "Chinese (Mandarin)": "中文",
  "中文（普通话）": "中文",
  "中文-普通话": "中文",
  中文: "中文",
  "中文普通话": "中文",
};

const LANGUAGE_LABELS_BY_KEY = new Map(
  Object.entries(LANGUAGE_LABELS).map(([key, label]) => [key.toLocaleLowerCase("en-US"), label]),
);

function getLanguageLabel(value) {
  const rawValue = String(value ?? "").trim();
  return LANGUAGE_LABELS_BY_KEY.get(rawValue.toLocaleLowerCase("en-US")) || rawValue;
}

function isChineseLanguage(value) {
  return getLanguageLabel(value) === "中文";
}

export function getLanguageFilterOptions(values) {
  const sortedValues = [...new Set(values.filter(Boolean))]
    .sort((first, second) => {
      const firstIsChinese = isChineseLanguage(first);
      const secondIsChinese = isChineseLanguage(second);
      if (firstIsChinese !== secondIsChinese) return firstIsChinese ? -1 : 1;
      return String(first).localeCompare(String(second), "en-US", { sensitivity: "base" });
    });
  const seenLabels = new Set();
  return sortedValues
    .filter((value) => {
      const label = getLanguageLabel(value);
      if (seenLabels.has(label)) return false;
      seenLabels.add(label);
      return true;
    })
    .map((value) => ({ value, label: getLanguageLabel(value) }));
}

export function getLanguageDisplayName(value) {
  return getLanguageLabel(value);
}
