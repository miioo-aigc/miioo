#!/usr/bin/env python3
from __future__ import annotations

import argparse
import asyncio
import os
import time
from collections import Counter
from dataclasses import dataclass
from pathlib import Path
from typing import Any
from urllib.parse import urljoin

import httpx


DEFAULT_SCENARIOS = ("auth_me", "tasks_list", "assets_list")


@dataclass(frozen=True)
class ScenarioDefinition:
    name: str
    method: str
    path: str
    description: str
    requires_project_id: bool = False
    requires_media_url: bool = False
    stream: bool = False


SCENARIOS: dict[str, ScenarioDefinition] = {
    "auth_me": ScenarioDefinition(
        name="auth_me",
        method="GET",
        path="/api/auth/me",
        description="当前用户鉴权读取",
    ),
    "tasks_list": ScenarioDefinition(
        name="tasks_list",
        method="GET",
        path="/api/tasks?limit=50",
        description="任务列表热点读取",
    ),
    "assets_list": ScenarioDefinition(
        name="assets_list",
        method="GET",
        path="/api/assets?limit=100",
        description="资产列表热点读取",
    ),
    "storyboards_list": ScenarioDefinition(
        name="storyboards_list",
        method="GET",
        path="/api/projects/{project_id}/storyboards?limit=100",
        description="分镜列表热点读取",
        requires_project_id=True,
    ),
    "media_fetch": ScenarioDefinition(
        name="media_fetch",
        method="GET",
        path="{media_url}",
        description="媒体访问链路探测",
        requires_media_url=True,
        stream=True,
    ),
}


@dataclass
class SampleResult:
    ok: bool
    status_code: int | None
    latency_ms: float
    error: str | None = None


def percentile(values: list[float], ratio: float) -> float:
    if not values:
        return 0.0
    ordered = sorted(values)
    index = max(0, min(len(ordered) - 1, int(round((len(ordered) - 1) * ratio))))
    return ordered[index]


def build_url(base_url: str, raw_path: str) -> str:
    if raw_path.startswith(("http://", "https://")):
        return raw_path
    return urljoin(f"{base_url.rstrip('/')}/", raw_path.lstrip("/"))


def resolve_scenarios(args: argparse.Namespace) -> list[ScenarioDefinition]:
    selected = args.scenario or list(DEFAULT_SCENARIOS)
    if args.project_id and "storyboards_list" not in selected:
        selected.append("storyboards_list")
    if args.media_url and "media_fetch" not in selected:
        selected.append("media_fetch")

    seen: set[str] = set()
    resolved: list[ScenarioDefinition] = []
    for name in selected:
        if name not in SCENARIOS:
            available = ", ".join(sorted(SCENARIOS))
            raise SystemExit(f"未知场景: {name}，可选值：{available}")
        if name in seen:
            continue
        resolved.append(SCENARIOS[name])
        seen.add(name)
    return resolved


def build_scenario_url(
    scenario: ScenarioDefinition,
    *,
    base_url: str,
    project_id: str | None,
    media_url: str | None,
) -> str:
    if scenario.requires_project_id and not project_id:
        raise SystemExit(f"场景 {scenario.name} 需要提供 --project-id 或环境变量 PROJECT_ID")
    if scenario.requires_media_url and not media_url:
        raise SystemExit(f"场景 {scenario.name} 需要提供 --media-url 或环境变量 MEDIA_URL")

    path = scenario.path.format(project_id=project_id, media_url=media_url)
    return build_url(base_url, path)


async def run_single_request(
    client: httpx.AsyncClient,
    *,
    scenario: ScenarioDefinition,
    url: str,
) -> SampleResult:
    headers: dict[str, str] = {}
    if scenario.stream:
        headers["Range"] = "bytes=0-1023"

    start = time.perf_counter()
    try:
        if scenario.stream:
            async with client.stream(scenario.method, url, headers=headers) as response:
                response.raise_for_status()
                async for _chunk in response.aiter_bytes():
                    break
                status_code = response.status_code
        else:
            response = await client.request(scenario.method, url, headers=headers)
            response.raise_for_status()
            status_code = response.status_code
        latency_ms = (time.perf_counter() - start) * 1000
        return SampleResult(ok=True, status_code=status_code, latency_ms=latency_ms)
    except Exception as exc:
        latency_ms = (time.perf_counter() - start) * 1000
        status_code = exc.response.status_code if isinstance(exc, httpx.HTTPStatusError) else None
        return SampleResult(ok=False, status_code=status_code, latency_ms=latency_ms, error=str(exc))


async def execute_scenario(
    *,
    scenario: ScenarioDefinition,
    url: str,
    token: str,
    requests: int,
    concurrency: int,
    timeout: float,
    warmup: int,
) -> dict[str, Any]:
    headers = {"Authorization": f"Bearer {token}"}
    queue: asyncio.Queue[int] = asyncio.Queue()
    for index in range(requests):
        queue.put_nowait(index)

    latencies: list[float] = []
    status_counts: Counter[str] = Counter()
    errors: Counter[str] = Counter()
    ok_count = 0

    async def worker() -> None:
        nonlocal ok_count
        async with httpx.AsyncClient(timeout=timeout, headers=headers, follow_redirects=True) as client:
            while not queue.empty():
                try:
                    queue.get_nowait()
                except asyncio.QueueEmpty:
                    return
                result = await run_single_request(client, scenario=scenario, url=url)
                latencies.append(result.latency_ms)
                if result.status_code is not None:
                    status_counts[str(result.status_code)] += 1
                else:
                    status_counts["error"] += 1
                if result.ok:
                    ok_count += 1
                elif result.error:
                    errors[result.error] += 1
                queue.task_done()

    async with httpx.AsyncClient(timeout=timeout, headers=headers, follow_redirects=True) as warmup_client:
        for _ in range(max(warmup, 0)):
            await run_single_request(warmup_client, scenario=scenario, url=url)

    started_at = time.perf_counter()
    await asyncio.gather(*(worker() for _ in range(max(1, concurrency))))
    elapsed_s = time.perf_counter() - started_at

    total = len(latencies)
    throughput = total / elapsed_s if elapsed_s > 0 else 0.0
    failure_count = total - ok_count
    return {
        "scenario": scenario.name,
        "description": scenario.description,
        "url": url,
        "requests": total,
        "ok_count": ok_count,
        "failure_count": failure_count,
        "success_rate": (ok_count / total * 100.0) if total else 0.0,
        "elapsed_s": elapsed_s,
        "throughput_rps": throughput,
        "avg_ms": (sum(latencies) / total) if total else 0.0,
        "min_ms": min(latencies) if latencies else 0.0,
        "max_ms": max(latencies) if latencies else 0.0,
        "p50_ms": percentile(latencies, 0.50),
        "p95_ms": percentile(latencies, 0.95),
        "p99_ms": percentile(latencies, 0.99),
        "status_counts": dict(status_counts),
        "top_errors": errors.most_common(5),
    }


def format_summary(summary: dict[str, Any]) -> str:
    lines = [
        f"## {summary['scenario']} - {summary['description']}",
        f"- URL: `{summary['url']}`",
        f"- 请求数: `{summary['requests']}`",
        f"- 成功率: `{summary['success_rate']:.2f}%`",
        f"- 吞吐: `{summary['throughput_rps']:.2f} req/s`",
        (
            "- 延迟: "
            f"avg `{summary['avg_ms']:.2f}ms`, "
            f"p50 `{summary['p50_ms']:.2f}ms`, "
            f"p95 `{summary['p95_ms']:.2f}ms`, "
            f"p99 `{summary['p99_ms']:.2f}ms`, "
            f"max `{summary['max_ms']:.2f}ms`"
        ),
        f"- 状态码分布: `{summary['status_counts']}`",
    ]
    if summary["top_errors"]:
        lines.append(f"- Top 错误: `{summary['top_errors']}`")
    return "\n".join(lines)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="生产运行时热点链路轻量压测脚本")
    parser.add_argument("--base-url", default=os.getenv("BASE_URL", "http://127.0.0.1:8000"))
    parser.add_argument("--token", default=os.getenv("ACCESS_TOKEN"))
    parser.add_argument("--project-id", default=os.getenv("PROJECT_ID"))
    parser.add_argument("--media-url", default=os.getenv("MEDIA_URL"))
    parser.add_argument("--scenario", action="append", choices=sorted(SCENARIOS))
    parser.add_argument("--requests", type=int, default=50)
    parser.add_argument("--concurrency", type=int, default=10)
    parser.add_argument("--timeout", type=float, default=15.0)
    parser.add_argument("--warmup", type=int, default=3)
    parser.add_argument("--report-file")
    return parser.parse_args()


async def main() -> None:
    args = parse_args()
    if not args.token:
        raise SystemExit("缺少 token，请通过 --token 或环境变量 ACCESS_TOKEN 提供 Bearer Token")

    scenarios = resolve_scenarios(args)
    summaries: list[dict[str, Any]] = []
    for scenario in scenarios:
        url = build_scenario_url(
            scenario,
            base_url=args.base_url,
            project_id=args.project_id,
            media_url=args.media_url,
        )
        summary = await execute_scenario(
            scenario=scenario,
            url=url,
            token=args.token,
            requests=max(1, args.requests),
            concurrency=max(1, args.concurrency),
            timeout=max(args.timeout, 1.0),
            warmup=max(args.warmup, 0),
        )
        summaries.append(summary)

    output_lines = [
        "# 运行时压测基线结果",
        "",
        f"- BASE_URL: `{args.base_url}`",
        f"- requests: `{args.requests}`",
        f"- concurrency: `{args.concurrency}`",
        f"- timeout: `{args.timeout}`",
        f"- warmup: `{args.warmup}`",
        "",
    ]
    for summary in summaries:
        output_lines.append(format_summary(summary))
        output_lines.append("")
    output = "\n".join(output_lines).rstrip() + "\n"
    print(output)

    if args.report_file:
        report_path = Path(args.report_file)
        report_path.parent.mkdir(parents=True, exist_ok=True)
        report_path.write_text(output, encoding="utf-8")


if __name__ == "__main__":
    asyncio.run(main())
