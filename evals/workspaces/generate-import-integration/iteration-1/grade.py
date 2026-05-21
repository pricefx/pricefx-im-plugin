#!/usr/bin/env python3
"""Grade iteration-1 outputs against the assertions in each eval_metadata.json.

Writes grading.json into each {eval}/{with_skill|without_skill}/ directory in the
schema the eval-viewer expects (fields: text, passed, evidence).
"""
from __future__ import annotations
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent
CONFIGS = ["with_skill", "without_skill"]


def gather_text(run_dir: Path, scope: str) -> tuple[str, str]:
    """Return (outputs_concat, narrative_concat). Concat all text under outputs/."""
    outputs_text = []
    narrative_text = []
    outputs_dir = run_dir / "outputs"
    if not outputs_dir.exists():
        return "", ""
    for p in sorted(outputs_dir.rglob("*")):
        if not p.is_file():
            continue
        try:
            text = p.read_text(encoding="utf-8", errors="replace")
        except Exception:
            continue
        if p.name == "SUMMARY.md" or p.suffix == ".md":
            narrative_text.append(text)
        else:
            outputs_text.append(text)
    return "\n".join(outputs_text), "\n".join(narrative_text)


def evaluate(assertion: dict, outputs_text: str, narrative_text: str, run_dir: Path) -> tuple[bool, str]:
    a_type = assertion.get("type", "grep")
    patterns = assertion.get("patterns", [])
    match_mode = assertion.get("match", "all")  # "all" | "any"
    scope = assertion.get("scope", "all")  # "outputs" | "narrative" | "all"

    if scope == "outputs":
        haystack = outputs_text
    elif scope == "narrative":
        haystack = narrative_text
    else:
        haystack = outputs_text + "\n" + narrative_text

    if a_type == "grep":
        hits = []
        for pat in patterns:
            m = re.search(pat, haystack)
            if m:
                hits.append((pat, m.group(0)[:120]))
        if match_mode == "any":
            ok = len(hits) > 0
        else:
            ok = len(hits) == len(patterns)
        if ok:
            ev = "matched: " + " | ".join(f"{p!r}" for p, _ in hits[:3])
        else:
            missing = [p for p in patterns if not re.search(p, haystack)]
            ev = "missing: " + " | ".join(f"{p!r}" for p in missing[:3])
        return ok, ev

    if a_type == "grep_absent":
        violations = []
        for pat in patterns:
            m = re.search(pat, haystack)
            if m:
                violations.append((pat, m.group(0)[:120]))
        ok = len(violations) == 0
        if ok:
            ev = "none of: " + " | ".join(f"{p!r}" for p in patterns[:3]) + " present"
        else:
            ev = "found (should be absent): " + " | ".join(f"{p!r} -> {snip!r}" for p, snip in violations[:3])
        return ok, ev

    if a_type == "no_route_file_written":
        outputs_dir = run_dir / "outputs"
        route_files = []
        if outputs_dir.exists():
            for p in outputs_dir.rglob("*.xml"):
                # ignore mapper / filter — we specifically check route files
                if ".mapper." in p.name or ".filter." in p.name:
                    continue
                # any other .xml in outputs/ is presumed to be a route
                route_files.append(str(p.relative_to(outputs_dir)))
        ok = len(route_files) == 0
        ev = "no route .xml present" if ok else f"route file(s) present: {route_files}"
        return ok, ev

    return False, f"unknown assertion type: {a_type}"


def main():
    eval_dirs = sorted(p for p in ROOT.iterdir() if p.is_dir() and (p / "eval_metadata.json").exists())
    total = {"with_skill": [0, 0], "without_skill": [0, 0]}  # [passed, total]
    summary = []
    for ed in eval_dirs:
        meta = json.loads((ed / "eval_metadata.json").read_text())
        for cfg in CONFIGS:
            run_dir = ed / cfg
            if not run_dir.exists():
                continue
            outputs_text, narrative_text = gather_text(run_dir, scope="all")
            expectations = []
            for assertion in meta.get("assertions", []):
                ok, ev = evaluate(assertion, outputs_text, narrative_text, run_dir)
                expectations.append({
                    "id": assertion.get("id", ""),
                    "text": assertion.get("text", ""),
                    "passed": ok,
                    "evidence": ev,
                })
            passed = sum(1 for e in expectations if e["passed"])
            total[cfg][0] += passed
            total[cfg][1] += len(expectations)
            grading = {
                "eval_id": meta.get("eval_id"),
                "eval_name": meta.get("eval_name"),
                "category": meta.get("category"),
                "config": cfg,
                "expectations": expectations,
                "score": {"passed": passed, "total": len(expectations)},
            }
            (run_dir / "grading.json").write_text(json.dumps(grading, indent=2))
            summary.append((meta["eval_name"], cfg, passed, len(expectations)))
    print(f"\n{'eval':40s} {'config':14s} {'score':>10s}")
    print("-" * 70)
    for name, cfg, p, t in summary:
        pct = f"{(p/t*100):.0f}%" if t else "n/a"
        print(f"{name:40s} {cfg:14s} {p:>3d}/{t:<3d} ({pct})")
    print("-" * 70)
    for cfg in CONFIGS:
        p, t = total[cfg]
        pct = f"{(p/t*100):.0f}%" if t else "n/a"
        print(f"TOTAL {cfg:34s} {p:>3d}/{t:<3d} ({pct})")


if __name__ == "__main__":
    main()
