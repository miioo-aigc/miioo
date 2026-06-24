from app.services.asset_reference_cleanup import _scrub_json_refs, _scrub_url_list


class TestScrubUrlList:
    def test_removes_matching_urls(self):
        urls = {"https://cdn/a.jpg"}
        new_list, changed = _scrub_url_list(
            ["https://cdn/a.jpg", "https://cdn/keep.jpg"], urls
        )
        assert changed is True
        assert new_list == ["https://cdn/keep.jpg"]

    def test_empties_to_none(self):
        urls = {"https://cdn/a.jpg"}
        new_list, changed = _scrub_url_list(["https://cdn/a.jpg"], urls)
        assert changed is True
        assert new_list is None

    def test_no_match_keeps_reference(self):
        original = ["https://cdn/keep.jpg"]
        new_list, changed = _scrub_url_list(original, {"https://cdn/a.jpg"})
        assert changed is False
        assert new_list is original

    def test_non_list_passthrough(self):
        new_val, changed = _scrub_url_list(None, {"https://cdn/a.jpg"})
        assert changed is False
        assert new_val is None


class TestScrubJsonRefs:
    def test_clears_scalar_url_and_asset_id(self):
        urls = {"https://cdn/a.mp4"}
        data = {
            "reference_video_url": "https://cdn/a.mp4",
            "first_frame_asset_id": "asset-1",
            "keep": "value",
        }
        result, changed = _scrub_json_refs(data, urls, "asset-1")
        assert changed is True
        assert result["reference_video_url"] is None
        assert result["first_frame_asset_id"] is None
        assert result["keep"] == "value"

    def test_filters_list_values(self):
        urls = {"https://cdn/a.jpg"}
        data = {"reference_image_asset_ids": ["asset-1", "asset-2"]}
        result, changed = _scrub_json_refs(data, urls, "asset-1")
        assert changed is True
        assert result["reference_image_asset_ids"] == ["asset-2"]

    def test_nested_dict(self):
        urls = {"https://cdn/a.jpg"}
        data = {"meta": {"thumb": "https://cdn/a.jpg", "ok": 1}}
        result, changed = _scrub_json_refs(data, urls, "asset-1")
        assert changed is True
        assert result["meta"]["thumb"] is None
        assert result["meta"]["ok"] == 1

    def test_no_match_unchanged(self):
        data = {"foo": "bar", "list": ["x"]}
        result, changed = _scrub_json_refs(data, {"https://cdn/a.jpg"}, "asset-1")
        assert changed is False
        assert result == data

    def test_none_passthrough(self):
        result, changed = _scrub_json_refs(None, {"https://cdn/a.jpg"}, "asset-1")
        assert changed is False
        assert result is None
