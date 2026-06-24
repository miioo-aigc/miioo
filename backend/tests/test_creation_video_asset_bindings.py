from app.routers.creation import _validated_asset_bindings_to_attachments


class TestValidatedAssetBindingsToAttachments:
    def test_flattens_all_asset_types(self):
        result = _validated_asset_bindings_to_attachments(
            {
                "image_refs": [
                    {
                        "url": "https://example.com/first.jpg",
                        "asset_id": "img-1",
                        "role": "first_frame",
                        "source": "attachments",
                        "asset_name": "首帧图",
                    }
                ],
                "video_refs": [
                    {
                        "url": "https://example.com/ref.mp4",
                        "asset_id": "vid-1",
                        "role": "reference",
                        "source": "legacy_param",
                        "asset_name": "参考视频",
                    }
                ],
                "audio_refs": [
                    {
                        "url": "https://example.com/ref.wav",
                        "asset_id": "aud-1",
                        "role": "reference",
                        "source": "attachments",
                        "asset_name": "参考音频",
                    }
                ],
            }
        )

        assert result == [
            {
                "asset_id": "img-1",
                "asset_type": "image",
                "asset_name": "首帧图",
                "url": "https://example.com/first.jpg",
                "role": "first_frame",
                "source": "attachments",
            },
            {
                "asset_id": "vid-1",
                "asset_type": "video",
                "asset_name": "参考视频",
                "url": "https://example.com/ref.mp4",
                "role": "reference",
                "source": "legacy_param",
            },
            {
                "asset_id": "aud-1",
                "asset_type": "audio",
                "asset_name": "参考音频",
                "url": "https://example.com/ref.wav",
                "role": "reference",
                "source": "attachments",
            },
        ]

    def test_skips_empty_items(self):
        result = _validated_asset_bindings_to_attachments(
            {
                "image_refs": [
                    {"url": None, "asset_id": None, "asset_name": None},
                    {"url": "https://example.com/ok.jpg", "role": "reference"},
                ]
            }
        )

        assert result == [
            {
                "asset_id": None,
                "asset_type": "image",
                "asset_name": None,
                "url": "https://example.com/ok.jpg",
                "role": "reference",
                "source": None,
            }
        ]
