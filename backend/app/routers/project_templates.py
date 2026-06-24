from fastapi import APIRouter

from app.schemas.project_template import ProjectTemplateResponse
from app.services.project_template_catalog import list_project_templates

router = APIRouter()


@router.get(
    "",
    response_model=list[ProjectTemplateResponse],
    summary="获取首页项目模板案例",
    description="返回首页匿名态“项目”页签使用的只读模板案例列表。该接口只用于展示模板示例，不直接进入真实项目工作流。",
    response_description="项目模板案例列表。",
    responses={
        200: {
            "description": "读取成功",
            "content": {
                "application/json": {
                    "example": [
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
                        }
                    ]
                }
            },
        }
    },
)
async def get_project_templates():
    return list_project_templates()
