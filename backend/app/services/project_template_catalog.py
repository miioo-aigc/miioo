PROJECT_TEMPLATE_CATALOG = [
    {
        "id": "template-cinematic-suspense",
        "name": "悬疑短剧模板",
        "description": "适合悬疑、反转、追查类项目，强调夜景氛围与情绪推进。",
        "aspect_ratio": "16:9",
        "visual_style": "suspense-anime",
        "visual_style_label": "2D悬疑动漫",
        "cover_key": "suspense_anime",
        "tags": ["悬疑", "短剧", "反转"],
        "sort_order": 10,
    },
    {
        "id": "template-cinematic-commercial",
        "name": "品牌短片模板",
        "description": "适合产品故事、品牌介绍和高质感商业短片，结构更适合快速起稿。",
        "aspect_ratio": "16:9",
        "visual_style": "cinematic-commercial",
        "visual_style_label": "电影感商业",
        "cover_key": "hero",
        "tags": ["商业", "品牌", "电影感"],
        "sort_order": 20,
    },
    {
        "id": "template-vertical-social",
        "name": "竖屏种草模板",
        "description": "适合短视频平台的竖屏内容，便于快速生成节奏明确的宣传脚本。",
        "aspect_ratio": "9:16",
        "visual_style": "social-fastcut",
        "visual_style_label": "短视频快节奏",
        "cover_key": "default",
        "tags": ["竖屏", "种草", "短视频"],
        "sort_order": 30,
    },
]


def list_project_templates() -> list[dict]:
    return sorted(PROJECT_TEMPLATE_CATALOG, key=lambda item: (item.get("sort_order", 0), item.get("name", "")))
