"""Distill the raw WIL dumps into report-ready snapshots for Calculus.

For each house, for each asset -> dataSource -> series, keep only the latest
non-null reading {timestamp, value}. Emits one snapshot per house plus a
single combined report, so Calculus can see exactly what their API returns
and how Phase-1 (per-room assets) vs Phase-2 (single nested asset) differ.
"""

import argparse
import json
import os


def latest_nonnull(series):
    last = None
    for entry in series.get("value", []) or []:
        if entry.get("value") is not None:
            if last is None or entry["key"] > last["timestamp"]:
                last = {"timestamp": entry["key"], "value": entry["value"]}
    return last


def snapshot_asset(asset):
    resp = asset.get("response") or {}
    sources = {}
    for src in resp.get("dataSources", []) or []:
        metrics = {}
        for ser in src.get("dataSeries", []) or []:
            key = ser.get("key", "")
            metric = key.split("|")[1].split("#")[0] if "|" in key else key
            latest = latest_nonnull(ser)
            if latest is not None:
                metrics[metric] = latest
        if metrics:
            sources[src.get("name") or f"src_{src.get('id')}"] = metrics
    return {
        "asset_id": asset["asset_id"],
        "asset_name": asset["asset_name"],
        "status_code": asset["status_code"],
        "live_readings": (asset["summary"]["live"] if asset.get("summary") else 0),
        "sources": sources,
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dir", required=True)
    args = parser.parse_args()

    index = json.load(open(os.path.join(args.dir, "_index.json")))
    report = {
        "generated_at": index["generated_at"],
        "window": {"start": index["window_start"], "end": index["window_end"],
                   "hours": index["window_hours"]},
        "calculus_api_url": index["calculus_api_url"],
        "note": "Latest non-null reading per metric within the window. "
                "Phase-1 homes expose one Calculus asset per room; Phase-2 homes "
                "expose a single asset whose sensors are nested dataSources.",
        "houses": [],
    }

    for h in index["houses"]:
        alias = h["alias"]
        full = json.load(open(os.path.join(args.dir, f"{alias}.json")))
        assets = [snapshot_asset(a) for a in full["assets"]]
        house_snap = {
            "alias": alias,
            "phase": h["phase"],
            "verdict": h["verdict"],
            "asset_count": h["asset_count"],
            "total_live_readings": h["total_live_readings"],
            "assets": assets,
        }
        out = os.path.join(args.dir, f"{alias}.snapshot.json")
        with open(out, "w") as f:
            json.dump(house_snap, f, indent=2)
        report["houses"].append(house_snap)
        print(f"{alias:16} {h['phase']:8} {h['verdict']:5} "
              f"{h['asset_count']:>2} assets  {h['total_live_readings']:>6} live  -> {out}")

    combined = os.path.join(args.dir, "wil_report.json")
    with open(combined, "w") as f:
        json.dump(report, f, indent=2)
    print(f"\nCombined report -> {combined}")


if __name__ == "__main__":
    main()
