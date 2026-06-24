from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user_style import UserStyle

CUSTOM_VISUAL_STYLE_PREFIX = "custom:"


@dataclass(frozen=True)
class VisualStyleDefinition:
    id: str
    name: str
    badge: str
    description_cn: str
    prompt: str
    negative_prompt: str
    scene_negative_prompt: str


ACTIVE_BUILT_IN_VISUAL_STYLES: dict[str, VisualStyleDefinition] = {
    "xianxia-3d": VisualStyleDefinition(
        id="xianxia-3d",
        name="3D东方仙侠",
        badge="🏯 3D东方仙侠",
        description_cn="3D东方仙侠风格，大厂CG画质，法阵特效",
        prompt="A high-quality 3D CGI animation film still, cinematic majestic Chinese Xianxia fantasy style. A soaring shot of ancient floating islands and towering immortal mountains. Epic cinematic lighting, glowing gold and cyan magic arrays rotating in mid-air, mystical volumetric mist flowing through bamboo forests. Hyper-detailed 3D render, crisp ray-traced shadows, unreal engine 5 aesthetic.",
        negative_prompt="photorealistic human, live action, 2d illustration, flat shading, anime, sketch, low poly, bad anatomy, deformed hands, blurry, low quality, watermark.",
        scene_negative_prompt="person, people, human, character, crowd, portrait, face, body, photorealistic, 2d, lowres.",
    ),
    "wuxia-cg": VisualStyleDefinition(
        id="wuxia-cg",
        name="CG武侠",
        badge="⚔️ CG武侠",
        description_cn="重工业CG武侠风，硬朗质感，江湖宿命感",
        prompt="Cinematic game CG concept art, realistic gritty Wuxia martial arts style. High-contrast dramatic atmospheric lighting. Swirling dust particles, intense sword glare cutting through the air, dark moody rain-slicked ancient Chinese courtyard background. Sharp details on leather and metal armor, realistic hair strand rendering.",
        negative_prompt="chibi, cute, 2d, anime, comic, disney style, glowing magic, sci-fi, modern, low quality, blurry, watermark.",
        scene_negative_prompt="person, people, human, character, fighter, silhouette, crowd, portrait, face, body, hands, lowres.",
    ),
    "pixar-style": VisualStyleDefinition(
        id="pixar-style",
        name="皮克斯风格",
        badge="🧸 皮克斯风格",
        description_cn="经典皮克斯大片风，温暖和煦，温润3D质感",
        prompt="A beautiful 3D CGI animation film still, signature Pixar and Disney animation style. Warm and inviting atmosphere, soft and rounded shapes. Characters with highly expressive, large eyes with rich iris reflections. Flawless subsurface scattering on the skin, smooth and soft matte toy-like textures. Bright and cheerful studio lighting with cozy color tones, heartwarming cinematic composition, 8k resolution, masterpiece.",
        negative_prompt="photorealistic human, live action, real life, 2d illustration, flat shading, traditional anime, sketch, low poly, bad anatomy, deformed hands, dark and gritty, scary, creepy, blurry, low quality, watermark.",
        scene_negative_prompt="person, people, human, character, crowd, portrait, face, body, photorealistic, 2d, lowres, text, signature.",
    ),
    "cyberpunk-3d": VisualStyleDefinition(
        id="cyberpunk-3d",
        name="3D赛博朋克",
        badge="🌌 3D赛博朋克",
        description_cn="3D赛博朋克动漫风格，全息霓虹特效，虚幻5引擎渲染，剧场版动画质感",
        prompt="A high-quality 3D anime film still, futuristic cyberpunk aesthetic. A dramatic low-angle shot of a rain-slicked cyberpunk megacity street at night. Towering skyscrapers with massive glowing holographic advertisements, flickering neon signs in hot pink, electric blue, and acid green. Raindrops reflecting vibrant lights, mystical volumetric smog. Stylized 3D anime render, crisp cel-shaded edges combined with advanced ray-traced lighting, unreal engine 5 aesthetic, Studio Trigger style, epic cinematic composition.",
        negative_prompt="photorealistic human, live action, real life, 2d illustration, flat shading, traditional sketch, low poly, bad anatomy, deformed hands, mutated fingers, blurry, low quality, watermark, text.",
        scene_negative_prompt="person, people, human, character, crowd, portrait, face, body, photorealistic, 2d, lowres, text, signature.",
    ),
    "suspense-anime-2d": VisualStyleDefinition(
        id="suspense-anime-2d",
        name="2D悬疑动漫",
        badge="🕯️ 2D悬疑动漫",
        description_cn="2D悬疑二次元风，高冷色调，冷峻线稿",
        prompt="Dark 2D anime style, suspense thriller manga illustration. Deep intense focus, sharp clean line art, dramatic high-contrast cel-shading. Heavy sharp shadows, cool moody color palette with a mysterious, ominous atmosphere. Complex highly detailed indoor or dark alley background, masterpiece.",
        negative_prompt="3d render, cgi, photorealistic, bright sunny daylight, cheerful expressions, cute, chibi, disney, bad anatomy.",
        scene_negative_prompt="person, people, human, character, silhouette, crowd, portrait, face, body, 3d, photorealistic, cheerful.",
    ),
    "ghibli-style": VisualStyleDefinition(
        id="ghibli-style",
        name="宫崎骏风格",
        badge="🍃 宫崎骏风格",
        description_cn="宫崎骏治愈手绘风，复古水彩背景，清新自然",
        prompt="Nostalgic 2D animation style inspired by Studio Ghibli and Hayao Miyazaki. Traditional hand-drawn aesthetic, painterly watercolor and gouache background textures. A wide scenic shot of lush green rolling hills, soft fluffy summer clouds drifting in a brilliant blue sky. Gentle natural ambient light, warm comforting color palette.",
        negative_prompt="3d render, cgi, photorealistic, real photo, modern digital vector art, cyberpunk, gritty, dark, high contrast.",
        scene_negative_prompt="person, people, human, character, figure, crowd, portrait, face, body, 3d, futuristic, lowres.",
    ),
    "shinkai-style": VisualStyleDefinition(
        id="shinkai-style",
        name="新海诚风格",
        badge="🌠 新海诚风格",
        description_cn="新海诚唯美动漫风，壁纸级光影，绚丽星空",
        prompt="A breathtaking anime film still, masterfully crafted in Makoto Shinkai style, CoMix Wave Films aesthetic. A dramatic wide-angle shot featuring a magnificent, hyper-detailed sky filled with massive, towering cumulus clouds illuminated by a radiant golden hour sunset. Vibrant palettes of brilliant blues, soft purples, and warm orange gradients. Shimmering sunbeams (crepuscular rays) piercing through clouds, casting a dreamy, luminous glow. Highly detailed scenery with a powerful sense of atmospheric depth, pristine lighting, emotional cinematic composition, 8k resolution.",
        negative_prompt="photorealistic, 3d render, live action, real life, low poly, bad anatomy, deformed hands, dark and gritty, cyberpunk, neon, blurry, low quality, watermark, text, signature.",
        scene_negative_prompt="person, people, human, character, crowd, portrait, face, body, photorealistic, 3d render, lowres, text, signature.",
    ),
    "ancient-chinese-live-action": VisualStyleDefinition(
        id="ancient-chinese-live-action",
        name="真人古风写实",
        badge="🏮 真人古风写实",
        description_cn="古装实拍剧照风，高精汉服质感，古典光影",
        prompt="A breathtaking cinematic photography, traditional Chinese Hanfu style, realism. A medium shot of a graceful person wearing intricate, layered traditional Hanfu made of shimmering silk and embroidered chiffon. Captured in an ancient Chinese courtyard with weeping willows, stone bridges, and elegant wooden pavilions. Soft, diffused natural sunlight filtering through bamboo leaves, creating a poetic and serene misty atmosphere. Hyper-realistic skin textures, detailed hair strands, sharp focus on facial features, authentic historical film aesthetic, masterpiece, 8k resolution.",
        negative_prompt="anime, manga, 2d illustration, 3d render, cartoon, oil painting, plastic skin, over-smoothed skin, airbrushed, deformed hands, bad anatomy, modern clothing, western fantasy, neon lights, lowres, blurry, watermark, text.",
        scene_negative_prompt="person, people, human, character, crowd, portrait, face, body, anime, 3d render, lowres, text, signature.",
    ),
    "urban-workplace": VisualStyleDefinition(
        id="urban-workplace",
        name="都市职场",
        badge="🏙️ 都市职场",
        description_cn="现代都市剧照风",
        prompt="A raw, candid corporate documentary photograph, modern urban professional style. A medium shot of a professional confidently standing or working by a floor-to-ceiling window inside a sleek, modern skyscraper office. Shifting sunlight filtering through the glass, casting natural soft shadows, no artificial studio lighting. In the background, a subtly blurred contemporary workplace with minimalist desks, soft ambient lights, and a distant city view. Hyper-realistic skin texture with visible pores, natural skin sheen, and minor imperfections; sharp focus on an authentic, professional expression with no heavy makeup. Dressed in sharp, high-quality professional attire with visible fabric textures. Captured on a 50mm lens, cinematic natural color grading, organic film grain, masterpiece.",
        negative_prompt="plastic skin, airbrushed, over-smoothed skin, CGI, 3D render, digital art, anime, cartoon, fake smile, passport photo, ID photo, cheap suit, heavy makeup, studio lighting, highly saturated, glossy, lowres, blurry, watermark, text, logo.",
        scene_negative_prompt="person, people, human, character, crowd, portrait, face, body, CGI, 3D render, lowres, text, signature.",
    ),
    "post-apocalyptic-modern": VisualStyleDefinition(
        id="post-apocalyptic-modern",
        name="末日废土",
        badge="☄️ 末日废土",
        description_cn="末日废土电影风，断壁残垣，苍凉生存质感",
        prompt="A raw, unedited documentary photograph, modern post-apocalyptic survival style. A candid medium-shot of a lone survivor navigating a ruined city street. Shot on 35mm film with Arri Alexa camera, cinematic heavy film grain. Captured in muted, desaturated tones and a cool, gritty color grading. Natural harsh lighting with realistic shadows, no artificial studio light. The background features crumbling, concrete buildings overgrown with wild vines, dusty air with floating particles. Hyper-realistic skin with visible pores, sweat, dirt, and minor imperfections; natural non-perfect expression, no makeup, masterpiece.",
        negative_prompt="plastic skin, airbrushed, over-smoothed skin, CGI, 3D render, digital art, anime, cartoon, perfect teeth, fashion model look, makeup, studio lighting, glowing skin, vibrant colors, highly saturated, glossy, 2d, lowres, blurry, watermark, logo.",
        scene_negative_prompt="person, people, human, character, crowd, portrait, face, body, CGI, 3D render, lowres, text, signature.",
    ),
    "live-action-suspense": VisualStyleDefinition(
        id="live-action-suspense",
        name="真人悬疑",
        badge="🔦 真人悬疑",
        description_cn="现实悬疑电影风，冷暖对比光，夜巷压迫感",
        prompt="A raw, suspenseful cinematic film still, realistic modern thriller style. A candid medium shot of a person standing against a weathered brick wall in a dimly-lit city alley at night. Balanced low-light cinematography revealing rich textures in shadows, with a mix of cool dim ambient light and a warm distant streetlamp glow, avoiding pitch-black areas. Wet pavement and walls with natural raindrops reflecting faint, realistic light. Hyper-realistic skin texture with visible sweat, pores, and an authentic micro-expression of intense alertness. Captured on an anamorphic lens, Arri Alexa camera, cinematic desaturated color grading with realistic film grain, masterpiece.",
        negative_prompt="pitch black background, underexposed, oversaturated neon lights, plastic skin, airbrushed, over-smoothed skin, CGI, 3D render, digital art, anime, cartoon, fake smile, studio lighting, highly saturated, glossy, lowres, blurry, watermark, text.",
        scene_negative_prompt="person, people, human, character, crowd, portrait, face, body, CGI, 3D render, lowres, text, signature.",
    ),
}

LEGACY_BUILT_IN_VISUAL_STYLES: dict[str, VisualStyleDefinition] = {
    "cyberpunk": VisualStyleDefinition(
        id="cyberpunk",
        name="赛博朋克",
        badge="🌌 赛博朋克",
        description_cn="赛博朋克美学，霓虹灯光，未来科技感",
        prompt="cyberpunk aesthetic, neon-lit urban environment, rain-soaked reflective streets, holographic UI displays, high-tech low-life contrast, Blade Runner style, volumetric fog with neon color bleeding, chromatic aberration, cool blue-purple palette with hot pink and cyan accents, gritty detailed textures",
        negative_prompt="bright daylight, pastoral, medieval, fantasy, cartoon, low tech, rural, natural, watermark, text, logo, low quality, blurry, amateur",
        scene_negative_prompt="person, people, human, figure, silhouette, crowd, pedestrian, portrait, face, body, bright daylight, pastoral, medieval, fantasy, cartoon, low tech, rural, natural, watermark, text, logo, low quality, blurry, amateur",
    ),
    "chibi-3d": VisualStyleDefinition(
        id="chibi-3d",
        name="3D Q版",
        badge="🎈 3D Q版",
        description_cn="3D Q版潮玩风，盲盒黏土质感，解压可爱",
        prompt="Cute 3D chibi character design, signature Pop Mart blind box toy style. Smooth premium PVC vinyl texture, soft clay animation aesthetic. Bright, soft studio lighting with gentle ambient occlusion shadows. Miniature toy world setting, vibrant pastel color palette, center composition, high-end toy photography.",
        negative_prompt="photorealistic human, adult proportions, high detail skin texture, scary, creepy, 2d, flat colors, bad anatomy.",
        scene_negative_prompt="person, people, human, character, crowd, portrait, face, body, photorealistic, dark, lowres.",
    ),
    "urban-romance-live-action": VisualStyleDefinition(
        id="urban-romance-live-action",
        name="真人都市情感",
        badge="🏙️ 真人都市情感",
        description_cn="现代都市剧照风，高级感穿搭，职场豪门氛围",
        prompt="A photorealistic modern drama film still, high-end urban lifestyle cinematography. Sharp focus on eyes, real human actors with natural expressions and flawless realistic skin textures. Moody soft ambient lighting, premium professional color grading. Luxury modern penthouse interior background, sophisticated modern fashion style, 8k resolution.",
        negative_prompt="cartoon, anime, 3d render, cgi, historical, ancient clothes, armor, fantasy, bad anatomy, deformed hands, lowres.",
        scene_negative_prompt="person, people, human, character, crowd, pedestrian, silhouette, portrait, face, body, hands, cartoon, anime, lowres.",
    ),
    "anime": VisualStyleDefinition(
        id="anime",
        name="日式动漫",
        badge="🌟 日式动漫",
        description_cn="日本动漫风格，cel-shaded，鲜艳色彩，Studio Ghibli品质",
        prompt="Japanese anime style, cel-shaded, vibrant saturated colors, large expressive eyes with detailed iris highlights, dynamic action poses, clean sharp outlines, consistent line weight throughout, Studio Ghibli/Makoto Shinkai quality, painted sky backgrounds, soft ambient lighting with dramatic rim light",
        negative_prompt="photorealistic, 3d render, western cartoon, ugly, bad anatomy, extra limbs, deformed limbs, blurry, watermark, text, logo, poorly drawn face, mutated hands, extra fingers, missing fingers, bad proportions, grotesque",
        scene_negative_prompt="person, people, human, character, figure, silhouette, crowd, portrait, face, body, hands, photorealistic, 3d render, western cartoon, ugly, bad anatomy, extra limbs, deformed limbs, blurry, watermark, text, logo, poorly drawn face, mutated hands, extra fingers, missing fingers, bad proportions, grotesque",
    ),
    "2d-animation": VisualStyleDefinition(
        id="2d-animation",
        name="2D动画",
        badge="🎨 2D动画",
        description_cn="经典2D动画风格，手绘风格，Disney/Pixar品质",
        prompt="classic 2D animation, hand-drawn style, Disney/Pixar quality, smooth clean lines with consistent weight, expressive characters with squash-and-stretch principles, painterly watercolor backgrounds, soft gradient shading, warm color palette, round friendly character proportions",
        negative_prompt="photorealistic, 3d, low quality, pixelated, blurry, watermark, text, bad anatomy, deformed, ugly, amateur drawing, inconsistent style, rough sketch",
        scene_negative_prompt="person, people, human, character, figure, silhouette, crowd, portrait, face, body, photorealistic, 3d, low quality, pixelated, blurry, watermark, text, bad anatomy, deformed, ugly, amateur drawing, inconsistent style, rough sketch",
    ),
    "3d-animation": VisualStyleDefinition(
        id="3d-animation",
        name="3D动画",
        badge="👾 3D动画",
        description_cn="3D CGI动画，Pixar/DreamWorks风格，精细材质",
        prompt="high-quality 3D CGI animation, Pixar/DreamWorks style, subsurface scattering on skin, detailed PBR textures, stylized character proportions, volumetric lighting, ambient occlusion, soft shadows, physically-based rendering, motion blur",
        negative_prompt="photorealistic, 2d, flat, hand-drawn, low poly, bad topology, texture artifacts, z-fighting, clipping, low quality, blurry, watermark, text, bad rigging, unnatural movement",
        scene_negative_prompt="person, people, human, character, figure, silhouette, crowd, portrait, face, body, photorealistic, 2d, flat, hand-drawn, low poly, bad topology, texture artifacts, z-fighting, clipping, low quality, blurry, watermark, text, bad rigging, unnatural movement",
    ),
    "oil-painting": VisualStyleDefinition(
        id="oil-painting",
        name="油画风格",
        badge="🖼️ 油画风格",
        description_cn="油画风格，可见笔触，古典艺术构图",
        prompt="oil painting style, visible impasto brushstrokes, rich layered textures, classical art composition with golden ratio, museum quality fine art, warm undertones, Rembrandt lighting, chiaroscuro contrast, canvas texture visible, glazing technique color depth",
        negative_prompt="digital art, photorealistic, 3d render, cartoon, anime, low quality, blurry, watermark, text, amateur, poorly painted, muddy colors, overworked canvas",
        scene_negative_prompt="person, people, human, figure, silhouette, crowd, portrait, face, body, digital art, photorealistic, 3d render, cartoon, anime, low quality, blurry, watermark, text, amateur, poorly painted, muddy colors, overworked canvas",
    ),
    "live-action": VisualStyleDefinition(
        id="live-action",
        name="真人影视",
        badge="🎬 真人影视",
        description_cn="真人实拍电影风格，photorealistic，8K高清，专业摄影",
        prompt="photorealistic, cinematic film quality, real human actors, professional cinematography, natural lighting, 8K resolution, shallow depth of field, film grain texture, color graded, anamorphic lens flare, three-point lighting setup",
        negative_prompt="cartoon, anime, illustration, painting, drawing, 3d render, cgi, low quality, blurry, grainy, watermark, text, logo, signature, distorted face, bad anatomy, extra limbs, mutated hands, deformed, ugly, disfigured, poorly drawn, amateur",
        scene_negative_prompt="person, people, human, man, woman, child, figure, silhouette, crowd, pedestrian, portrait, face, body, hands, feet, cartoon, anime, illustration, painting, drawing, 3d render, cgi, low quality, blurry, grainy, watermark, text, logo, signature, distorted face, bad anatomy, extra limbs, mutated hands, deformed, ugly, disfigured, poorly drawn, amateur",
    ),
}

BUILT_IN_VISUAL_STYLES: dict[str, VisualStyleDefinition] = {
    **ACTIVE_BUILT_IN_VISUAL_STYLES,
    **LEGACY_BUILT_IN_VISUAL_STYLES,
}


def is_built_in_visual_style(style_value: str | None) -> bool:
    return bool(style_value and style_value in BUILT_IN_VISUAL_STYLES)


def is_custom_visual_style_value(style_value: str | None) -> bool:
    return bool(style_value and style_value.startswith(CUSTOM_VISUAL_STYLE_PREFIX))


def get_custom_visual_style_id(style_value: str | None) -> str | None:
    if not is_custom_visual_style_value(style_value):
        return None
    style_id = style_value[len(CUSTOM_VISUAL_STYLE_PREFIX) :].strip()
    return style_id or None


async def _resolve_custom_user_style(
    style_value: str | None,
    user_id: UUID | None,
    db: AsyncSession,
) -> UserStyle | None:
    style_id = get_custom_visual_style_id(style_value)
    if not style_id or user_id is None:
        return None

    try:
        parsed_style_id = UUID(style_id)
    except ValueError:
        return None

    result = await db.execute(
        select(UserStyle).where(UserStyle.id == parsed_style_id, UserStyle.user_id == user_id)
    )
    return result.scalar_one_or_none()


async def resolve_visual_style_text(
    style_value: str | None,
    user_id: UUID | None,
    db: AsyncSession,
) -> str:
    if not style_value:
        return ""

    built_in = BUILT_IN_VISUAL_STYLES.get(style_value)
    if built_in:
        return built_in.prompt

    custom_style = await _resolve_custom_user_style(style_value, user_id, db)
    if custom_style:
        return custom_style.prompt

    return style_value


async def resolve_visual_style_label(
    style_value: str | None,
    user_id: UUID | None,
    db: AsyncSession,
) -> str:
    if not style_value:
        return ""

    built_in = BUILT_IN_VISUAL_STYLES.get(style_value)
    if built_in:
        return built_in.name

    custom_style = await _resolve_custom_user_style(style_value, user_id, db)
    if custom_style:
        return custom_style.name

    return style_value


async def resolve_visual_style_descriptions(
    style_values: Iterable[str | None],
    user_id: UUID | None,
    db: AsyncSession,
) -> list[str]:
    descriptions: list[str] = []
    seen: set[str] = set()

    for style_value in style_values:
        resolved = (await resolve_visual_style_text(style_value, user_id, db)).strip()
        if not resolved:
            continue
        normalized = resolved.lower()
        if normalized in seen:
            continue
        seen.add(normalized)
        descriptions.append(resolved)

    return descriptions


async def append_visual_styles(
    prompt: str,
    style_values: Iterable[str | None],
    user_id: UUID | None,
    db: AsyncSession,
) -> str:
    descriptions = await resolve_visual_style_descriptions(style_values, user_id, db)
    if not descriptions:
        return prompt
    return f"{prompt}, {', '.join(descriptions)}"
