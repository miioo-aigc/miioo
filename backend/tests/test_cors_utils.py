from app.utils.cors import build_allowed_origins, expand_allowed_origin_variants


def test_expand_allowed_origin_variants_adds_www_counterpart_for_apex_domain():
    assert expand_allowed_origin_variants("https://chengxvblog.top") == [
        "https://chengxvblog.top",
        "https://www.chengxvblog.top",
    ]


def test_expand_allowed_origin_variants_adds_apex_counterpart_for_www_domain():
    assert expand_allowed_origin_variants("https://www.miiooai.com") == [
        "https://www.miiooai.com",
        "https://miiooai.com",
    ]


def test_build_allowed_origins_deduplicates_and_keeps_local_hosts_stable():
    assert build_allowed_origins(
        "https://chengxvblog.top,https://www.chengxvblog.top,http://10.20.100.21:5173/,https://foo.local"
    ) == [
        "https://chengxvblog.top",
        "https://www.chengxvblog.top",
        "http://10.20.100.21:5173",
        "https://foo.local",
    ]
