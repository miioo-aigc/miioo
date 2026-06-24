from pydantic import BaseModel, Field

from app.schemas.subject import SubjectResponse


class ProjectScriptMessageResponse(BaseModel):
    id: str = Field(description="消息 UUID。")
    role: str = Field(description="消息角色，例如 user / assistant / system。")
    content: str = Field(description="消息正文。")
    message_type: str = Field(description="消息类型，例如 chat。")
    created_at: str = Field(description="消息创建时间。")


class ProjectScriptResponse(BaseModel):
    id: str = Field(description="主剧本工作区 UUID。")
    project_id: str = Field(description="所属项目 UUID。")
    source_type: str = Field(description="当前内容来源，例如 manual / upload / ai。")
    title: str | None = Field(description="主剧本标题。")
    content: str | None = Field(description="当前编辑态主剧本内容。")
    parsed_content: str | None = Field(description="解析后的主剧本文本。")
    status: str = Field(description="工作区状态，例如 draft / parsed / finalized。")
    last_uploaded_filename: str | None = Field(description="最近一次上传文件名。")
    last_uploaded_file_type: str | None = Field(description="最近一次上传文件扩展名。")
    created_at: str = Field(description="创建时间。")
    updated_at: str = Field(description="更新时间。")

    class Config:
        from_attributes = True


class ProjectScriptWorkspaceResponse(BaseModel):
    script: ProjectScriptResponse = Field(description="当前主剧本工作区信息。")
    messages: list[ProjectScriptMessageResponse] = Field(description="当前工作区对话消息列表。")


class ProjectScriptUpdateRequest(BaseModel):
    title: str | None = Field(None, max_length=200, description="主剧本标题。", example="项目主剧本")
    content: str | None = Field(default=None, description="整稿正文；若传空字符串会回到 draft 语义。")


class ProjectScriptChatRequest(BaseModel):
    message: str = Field(min_length=1, description="发给 AI 的整稿创意或修改指令。", example="请基于当前项目生成 3 集短剧整稿")
    episode_count: int | None = Field(None, ge=1, le=200, description="期望生成的目标集数；未传时由模型自动规划。", example=3)
    model: str | None = Field(default=None, description="可选模型 ID；未传时由后端自行选择。", example="gpt-4.1")
    apply_to_script: bool = Field(default=True, description="是否把 AI 结果直接回写到主剧本工作区。")


class ProjectScriptSplitPreviewRequest(BaseModel):
    episode_count: int | None = Field(None, ge=1, le=200, description="期望拆分出的正式分集数量。", example=3)
    model: str | None = Field(default=None, description="可选拆分模型 ID。")
    split_mode: str = Field(default="rule_first", description="拆分策略，例如 rule_first。", example="rule_first")


class ProjectScriptSplitPreviewItem(BaseModel):
    episode_number: int = Field(ge=1, description="正式分集序号。", example=1)
    title: str = Field(min_length=1, max_length=200, description="分集标题。", example="第1集")
    summary: str | None = Field(default=None, description="分集摘要。", example="冲突建立")
    content: str = Field(min_length=1, description="拆分后的分集正文。")


class ProjectScriptSplitPreviewResponse(BaseModel):
    items: list[ProjectScriptSplitPreviewItem] = Field(description="拆分预览列表。")
    split_source: str = Field(default="ai", description="拆分来源，例如 ai / rule。")


class ProjectScriptFinalizeRequest(BaseModel):
    episode_count: int | None = Field(None, ge=1, le=200, description="期望拆分出的正式分集数量。")
    model: str | None = Field(default=None, description="可选拆分模型 ID。")
    split_mode: str = Field(default="rule_first", description="拆分策略。")
    apply_split: bool = Field(default=True, description="是否在定稿后立即拆分正式分集。")
    auto_extract_subjects: bool = Field(default=False, description="是否在定稿拆分后自动提取主体。")


class ProjectScriptFinalizeResponse(BaseModel):
    split_applied: bool = Field(default=True, description="本次定稿是否实际执行了正式分集拆分。")
    replaced_count: int = Field(description="被替换的正式分集数量。")
    created_count: int = Field(description="新创建的正式分集数量。")
    script_status: str = Field(description="定稿后的主剧本状态。")
    selected_episode_number: int | None = Field(default=None, description="推荐前端回显或聚焦的分集序号。")
    backup_history_id: str | None = Field(default=None, description="定稿前自动备份出的历史版本 ID。")
    items: list[ProjectScriptSplitPreviewItem] = Field(description="最终拆分结果。")
    split_source: str = Field(default="ai", description="拆分来源。")
    extracted_episode_count: int = Field(default=0, description="本次执行主体提取的分集数量。")
    subject_created_count: int = Field(default=0, description="本次新增主体数量。")
    subject_updated_count: int = Field(default=0, description="本次更新主体数量。")
    failed_episode_numbers: list[int] = Field(default_factory=list, description="主体提取失败的分集序号列表。")


class ProjectScriptApplySplitRequest(BaseModel):
    items: list[ProjectScriptSplitPreviewItem] = Field(min_length=1, description="要写入正式分集的拆分结果列表。")


class ProjectScriptApplySplitResponse(BaseModel):
    replaced_count: int = Field(description="被替换的正式分集数量。")
    created_count: int = Field(description="新创建的正式分集数量。")
    script_status: str = Field(description="应用拆分后的主剧本状态。")


class ProjectScriptExtractSubjectsResponse(BaseModel):
    created: list[SubjectResponse] = Field(description="本次新创建的主体列表。")
    updated: list[SubjectResponse] = Field(description="本次更新的主体列表。")


class ProjectScriptHistoryResponse(BaseModel):
    id: str = Field(description="历史版本 UUID。")
    version_number: int = Field(description="历史版本号。")
    source_type: str = Field(description="来源类型，例如 upload / manual / finalize。")
    source_detail: str | None = Field(description="来源补充说明。")
    history_kind: str = Field(description="历史快照类型。")
    content: str | None = Field(description="当次历史记录保存的原文内容。")
    episode_count: int | None = Field(default=None, description="若为拆分快照，则对应分集数量。")
    snapshot_payload: list[ProjectScriptSplitPreviewItem] | None = Field(default=None, description="若为拆分快照，则保存拆分结果。")
    created_at: str = Field(description="创建时间。")

    class Config:
        from_attributes = True


class ProjectScriptHistoryListResponse(BaseModel):
    items: list[ProjectScriptHistoryResponse] = Field(description="历史版本列表。")
