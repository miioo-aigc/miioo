from pydantic import BaseModel, Field


class LiveMaterialAuthSessionCreateRequest(BaseModel):
    source: str | None = Field(default=None, description="触发入口，例如 creation / storyboard。")
    project_id: str | None = Field(default=None, description="可选的项目 ID，仅用于回跳恢复上下文。")
    storyboard_id: str | None = Field(default=None, description="可选的分镜 ID，仅用于回跳恢复上下文。")
    return_path: str | None = Field(default=None, description="前端期望的回跳路径。")


class LiveMaterialAuthSessionCreateResponse(BaseModel):
    session_id: str = Field(description="本次真人认证会话 ID。")
    h5_link: str = Field(description="真人认证 H5 链接。")
    callback_url: str = Field(description="认证完成后的前端回跳地址。")
    expires_at: str | None = Field(default=None, description="本次 H5 链接过期时间。")
    byted_token: str | None = Field(default=None, description="上游返回的 bytedToken。")


class LiveMaterialAuthSessionCompleteRequest(BaseModel):
    result_code: str | None = Field(default=None, description="回跳 query 里的 resultCode。")
    byted_token: str | None = Field(default=None, description="回跳 query 里的 bytedToken。")
    query_params: dict[str, str] | None = Field(default=None, description="前端原样回传的 query 参数。")


class LiveMaterialGroupResponse(BaseModel):
    id: str = Field(description="系统内真人素材组 UUID。")
    upstream_group_id: str = Field(description="上游真人素材组 ID。")
    provider_type: str = Field(description="服务商类型。")
    group_type: str = Field(description="素材组类型。")
    name: str | None = Field(default=None, description="素材组名称。")
    description: str | None = Field(default=None, description="素材组描述。")
    auth_status: str = Field(description="认证状态。")
    last_result_code: str | None = Field(default=None, description="最近一次认证结果码。")
    asset_count: int = Field(default=0, description="该组素材数量。")
    created_at: str | None = Field(default=None, description="创建时间。")
    updated_at: str | None = Field(default=None, description="更新时间。")


class LiveMaterialAuthSessionCompleteResponse(BaseModel):
    group: LiveMaterialGroupResponse = Field(description="完成认证后对应的真人素材组。")
    redirect_path: str | None = Field(default=None, description="建议前端跳回的路径。")


class LiveMaterialAssetCreateRequest(BaseModel):
    url: str = Field(description="素材公网 URL。")
    asset_type: str = Field(description="素材类型：image / video / audio。")
    name: str | None = Field(default=None, description="素材名称。")


class LiveMaterialAssetResponse(BaseModel):
    id: str = Field(description="系统内真人素材 UUID。")
    group_id: str = Field(description="所属真人素材组 UUID。")
    upstream_asset_id: str = Field(description="上游素材 ID。")
    asset_ref_url: str = Field(description="用于视频生成的 asset:// 引用地址。")
    asset_type: str = Field(description="素材类型。")
    name: str | None = Field(default=None, description="素材名称。")
    status: str = Field(description="素材状态。")
    source_url: str | None = Field(default=None, description="原始素材 URL。")
    preview_url: str | None = Field(default=None, description="前端预览 URL。")
    error_message: str | None = Field(default=None, description="失败原因。")
    created_at: str | None = Field(default=None, description="创建时间。")
    updated_at: str | None = Field(default=None, description="更新时间。")
