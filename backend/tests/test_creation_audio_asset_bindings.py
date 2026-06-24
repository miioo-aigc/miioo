from app.routers.creation import _resolve_audio_binding_context


class TestResolveCreationAudioBindingContext:
    def test_prefers_explicit_reference_audio_url(self):
        prompt_raw, prompt_resolved, reference_audio_url, mentions, attachments = _resolve_audio_binding_context(
            spoken_text="请用温柔的语气朗读这段文案",
            prompt_raw="请用温柔的语气朗读这段文案，参考 @旁白样音",
            prompt_resolved=None,
            reference_audio_url="https://example.com/explicit.mp3",
            mentions=[
                {
                    "asset_id": "aud-1",
                    "asset_type": "audio",
                    "asset_name": "旁白样音",
                    "display_text": "@旁白样音",
                }
            ],
            attachments=[
                {
                    "asset_id": "aud-1",
                    "asset_type": "audio",
                    "asset_name": "旁白样音",
                    "url": "https://example.com/mentioned.mp3",
                    "role": "mentioned_reference",
                }
            ],
        )

        assert prompt_raw == "请用温柔的语气朗读这段文案，参考 @旁白样音"
        assert "重点参考资产：" in prompt_resolved
        assert reference_audio_url == "https://example.com/explicit.mp3"
        assert mentions[0]["asset_type"] == "audio"
        assert attachments[0]["url"] == "https://example.com/mentioned.mp3"

    def test_prefers_mentioned_audio_when_explicit_missing(self):
        _, _, reference_audio_url, _, _ = _resolve_audio_binding_context(
            spoken_text="请朗读这段旁白",
            prompt_raw="请朗读这段旁白，参考 @女声示例",
            prompt_resolved=None,
            reference_audio_url=None,
            mentions=[
                {
                    "asset_id": "aud-2",
                    "asset_type": "audio",
                    "asset_name": "女声示例",
                    "display_text": "@女声示例",
                }
            ],
            attachments=[
                {
                    "asset_id": "aud-2",
                    "asset_type": "audio",
                    "asset_name": "女声示例",
                    "url": "https://example.com/mention-audio.mp3",
                    "role": "mentioned_reference",
                },
                {
                    "asset_id": "aud-3",
                    "asset_type": "audio",
                    "asset_name": "备用示例",
                    "url": "https://example.com/fallback.mp3",
                    "role": "reference",
                },
            ],
        )

        assert reference_audio_url == "https://example.com/mention-audio.mp3"

    def test_falls_back_to_first_audio_attachment(self):
        _, _, reference_audio_url, _, _ = _resolve_audio_binding_context(
            spoken_text="请朗读这段旁白",
            prompt_raw=None,
            prompt_resolved=None,
            reference_audio_url=None,
            mentions=[
                {
                    "asset_id": "img-1",
                    "asset_type": "image",
                    "asset_name": "角色立绘",
                    "display_text": "@角色立绘",
                }
            ],
            attachments=[
                {
                    "asset_id": "img-1",
                    "asset_type": "image",
                    "asset_name": "角色立绘",
                    "url": "https://example.com/character.png",
                    "role": "mentioned_reference",
                },
                {
                    "asset_id": "aud-4",
                    "asset_type": "audio",
                    "asset_name": "普通参考音频",
                    "url": "https://example.com/audio-ref.mp3",
                    "role": "reference",
                },
            ],
        )

        assert reference_audio_url == "https://example.com/audio-ref.mp3"

    def test_keeps_spoken_text_out_of_binding_prompt(self):
        prompt_raw, prompt_resolved, _, _, _ = _resolve_audio_binding_context(
            spoken_text="真正送给配音模型的正文",
            prompt_raw=None,
            prompt_resolved=None,
            reference_audio_url=None,
            mentions=[
                {
                    "asset_id": "vid-1",
                    "asset_type": "video",
                    "asset_name": "剧情参考视频",
                    "display_text": "@剧情参考视频",
                }
            ],
            attachments=[
                {
                    "asset_id": "vid-1",
                    "asset_type": "video",
                    "asset_name": "剧情参考视频",
                    "url": "https://example.com/story.mp4",
                    "role": "mentioned_reference",
                }
            ],
        )

        assert prompt_raw == "真正送给配音模型的正文"
        assert "剧情参考视频（video）" in prompt_resolved
        assert "@剧情参考视频" not in prompt_raw
