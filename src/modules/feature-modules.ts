export type FeatureModuleId = "album_source" | "melon_identity" | "single_source" | "download_list";

export type FeatureModule = {
  id: FeatureModuleId;
  label: string;
  description: string;
  status: "available" | "planned";
};

export const featureModules: FeatureModule[] = [
  {
    id: "album_source",
    label: "专辑音源",
    description: "按团体和发行日期查询 Melon 专辑，并生成全曲 HTML 源码。",
    status: "available",
  },
  {
    id: "melon_identity",
    label: "melon实名",
    description: "根据姓名和出生日期生成 Melon 实名信息弹窗模板。",
    status: "available",
  },
  {
    id: "single_source",
    label: "单曲音源",
    description: "按歌手和歌曲名查询 Melon songId，并生成可匹配的单曲音源规则。",
    status: "available",
  },
  {
    id: "download_list",
    label: "下载列表",
    description: "输入一个或多个 Melon songId，生成可覆盖空列表或已有购买列表的歌曲 HTML。",
    status: "available",
  },
];

export function listFeatureModules(): FeatureModule[] {
  return featureModules;
}

export function getFeatureModule(moduleId: string | undefined): FeatureModule | undefined {
  return featureModules.find((module) => module.id === moduleId);
}

export function getDefaultFeatureModule(): FeatureModule {
  return featureModules[0];
}
