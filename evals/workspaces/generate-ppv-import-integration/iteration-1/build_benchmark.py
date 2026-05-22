#!/usr/bin/env python3
"""Produce benchmark.json + benchmark.md from grading.json + timing.json files
already present in this iteration directory, using the viewer-expected schema.
"""
from __future__ import annotations
import json
import math
import statistics
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent
CONFIGS = ["with_skill", "without_skill"]


def stats(values: list[float]) -> dict:
    if not values:
        return {"mean": 0.0, "stddev": 0.0, "min": 0.0, "max": 0.0}
    n = len(values)
    mean = sum(values) / n
    stddev = math.sqrt(sum((v - mean) ** 2 for v in values) / n) if n > 1 else 0.0
    return {"mean": round(mean, 4), "stddev": round(stddev, 4), "min": round(min(values), 4), "max": round(max(values), 4)}


def main():
    eval_dirs = sorted(p for p in ROOT.iterdir() if p.is_dir() and (p / "eval_metadata.json").exists())
    runs = []
    per_config = {c: {"pass_rate": [], "time_seconds": [], "tokens": []} for c in CONFIGS}

    for ed in eval_dirs:
        meta = json.loads((ed / "eval_metadata.json").read_text())
        for cfg in CONFIGS:
            grading_path = ed / cfg / "grading.json"
            timing_path = ed / cfg / "timing.json"
            if not grading_path.exists():
                continue
            grading = json.loads(grading_path.read_text())
            timing = {}
            if timing_path.exists():
                timing = json.loads(timing_path.read_text())
            score = grading.get("score", {})
            passed = score.get("passed", 0)
            total = score.get("total", 1)
            pass_rate = round(passed / total, 4) if total else 0.0
            time_s = round(timing.get("duration_ms", 0) / 1000.0, 2)
            tokens = timing.get("total_tokens", 0)
            tool_calls = timing.get("tool_uses", 0)

            runs.append({
                "eval_id": meta["eval_id"],
                "eval_name": meta["eval_name"],
                "configuration": cfg,
                "run_number": 1,
                "result": {
                    "pass_rate": pass_rate,
                    "passed": passed,
                    "failed": total - passed,
                    "total": total,
                    "time_seconds": time_s,
                    "tokens": tokens,
                    "tool_calls": tool_calls,
                    "errors": 0,
                },
                "expectations": grading.get("expectations", []),
                "notes": [meta.get("category", "")],
            })
            per_config[cfg]["pass_rate"].append(pass_rate)
            per_config[cfg]["time_seconds"].append(time_s)
            per_config[cfg]["tokens"].append(tokens)

    run_summary = {c: {k: stats(v) for k, v in per_config[c].items()} for c in CONFIGS}
    ws = run_summary["with_skill"]
    wo = run_summary["without_skill"]
    delta = {
        "pass_rate": f"{ws['pass_rate']['mean'] - wo['pass_rate']['mean']:+.4f}",
        "time_seconds": f"{ws['time_seconds']['mean'] - wo['time_seconds']['mean']:+.1f}",
        "tokens": f"{int(ws['tokens']['mean'] - wo['tokens']['mean']):+d}",
    }
    run_summary["delta"] = delta

    benchmark = {
        "metadata": {
            "skill_name": "generate-ppv-import-integration",
            "skill_path": "/Users/mnagas/Documents/pricefx/pricefx-im-plugin/skills/generate-ppv-import-integration",
            "executor_model": "claude-opus-4-7",
            "analyzer_model": "claude-opus-4-7",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "evals_run": [r["eval_name"] for r in runs if r["configuration"] == "with_skill"],
            "runs_per_configuration": 1,
        },
        "runs": runs,
        "run_summary": run_summary,
        "notes": [
            "Output-quality benchmark for the Pricing Parameter (LTV / MLTV2) generator. The PPV pattern is structurally close to a standard PX/CX import but differs on three points the skill must get right: objectType=LTV or MLTV2, pricingParameterName= on the URI, and a key/value or key1..keyN/attribute* mapper shape with NO <constant out=\"name\"/>.",
            "Positive cases test that the skill produces the canonical LTV/MLTV2 pattern for the right shape (single-key vs multi-key).",
            "Negative cases (P master, DMDS feed) test that the skill recognizes it's the wrong fit and defers to generate-import-integration / generate-pa-import-integration.",
            "Edge case (vague 'small lookup table') tests whether the skill asks to disambiguate Pricing Parameter (LTV/MLTV2) vs extension table (PX/CX) vs Data Source (DMDS) rather than silently picking PPV.",
            "Trigger evals NOT measured here — see evals/benchmarks/config.md. This benchmark is output-quality only.",
            "Caveat: pfx CLI was unavailable (no .env), so any partition-metadata-dependent steps use synthetic defaults. The PPV pattern itself is independent of partition metadata.",
            "Delta is 0 in iter-1 — both with-skill and without-skill scored 100%. This is a real finding, not noise: the PPV pattern is well-documented in docs/components.md / docs/mappers.md (objectType=LTV/MLTV2, pricingParameterName= URI param, key/value vs key1..keyN/attribute* mapper shapes), so Claude with only the shared docs produced equivalent route+mapper+properties bundles. The skill's value-add is largely in interactive Q&A (Step 2 type detection, Step 5b auto-detection of CSV format, Step 3 pfx CLI lookup, the streamingUnmarshal observability trade-off prompt) — none of which is exercised by a single-shot grep-based assertion suite.",
            "Iter-2 recommendation: add more discriminating cases that target the skill's interactive-flow value-add — e.g. a prompt with attached CSV sample to test auto-detection, a vague-mode prompt that should produce a clarifying question rather than silently inferring MATRIX vs MATRIX2, a prompt asking for upsert (integrate + integrateMapper) vs replace, or a prompt where the user gives a non-trivial table type (RANGE) that only the skill spells out.",
        ],
    }

    (ROOT / "benchmark.json").write_text(json.dumps(benchmark, indent=2))
    print(f"benchmark.json written: {len(runs)} runs")
    print(f"with_skill pass_rate: {ws['pass_rate']['mean']:.3f}  time: {ws['time_seconds']['mean']:.1f}s  tokens: {int(ws['tokens']['mean'])}")
    print(f"without_skill pass_rate: {wo['pass_rate']['mean']:.3f}  time: {wo['time_seconds']['mean']:.1f}s  tokens: {int(wo['tokens']['mean'])}")
    print(f"delta: pass_rate {delta['pass_rate']}  time {delta['time_seconds']}  tokens {delta['tokens']}")

    # benchmark.md
    md_lines = [
        f"# generate-ppv-import-integration — iteration-1 benchmark\n",
        f"_Generated {benchmark['metadata']['timestamp']}_\n",
        "## Aggregate\n",
        "| Config | Pass rate | Time (s) | Tokens |",
        "|---|---|---|---|",
        f"| with_skill | {ws['pass_rate']['mean']:.3f} ± {ws['pass_rate']['stddev']:.3f} | {ws['time_seconds']['mean']:.1f} ± {ws['time_seconds']['stddev']:.1f} | {int(ws['tokens']['mean'])} ± {int(ws['tokens']['stddev'])} |",
        f"| without_skill | {wo['pass_rate']['mean']:.3f} ± {wo['pass_rate']['stddev']:.3f} | {wo['time_seconds']['mean']:.1f} ± {wo['time_seconds']['stddev']:.1f} | {int(wo['tokens']['mean'])} ± {int(wo['tokens']['stddev'])} |",
        f"| **delta** | {delta['pass_rate']} | {delta['time_seconds']} | {delta['tokens']} |",
        "\n## Per-eval pass rate\n",
        "| Eval | Category | with_skill | without_skill |",
        "|---|---|---|---|",
    ]
    for ed in eval_dirs:
        meta = json.loads((ed / "eval_metadata.json").read_text())
        with_skill_run = next((r for r in runs if r["eval_name"] == meta["eval_name"] and r["configuration"] == "with_skill"), None)
        without_skill_run = next((r for r in runs if r["eval_name"] == meta["eval_name"] and r["configuration"] == "without_skill"), None)
        ws_score = f"{with_skill_run['result']['passed']}/{with_skill_run['result']['total']}" if with_skill_run else "—"
        wo_score = f"{without_skill_run['result']['passed']}/{without_skill_run['result']['total']}" if without_skill_run else "—"
        md_lines.append(f"| {meta['eval_name']} | {meta.get('category','')} | {ws_score} | {wo_score} |")
    md_lines.append("\n## Analyst notes\n")
    for n in benchmark["notes"]:
        md_lines.append(f"- {n}")
    (ROOT / "benchmark.md").write_text("\n".join(md_lines) + "\n")
    print("benchmark.md written")


if __name__ == "__main__":
    main()
