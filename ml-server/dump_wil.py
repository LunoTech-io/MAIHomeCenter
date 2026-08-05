"""Dump raw Calculus aggregateseries JSON for the 7 expected WIL houses.

Phase 1: WIL 2, 3, 4 (per-room assets)
Phase 2: WIL 6, 7, 9, 10 (single whole-home asset, sensors as dataSources)

Writes one file per house to the given output dir, plus a summary index, so
we can report back to Calculus exactly what their API returns for each home.

Usage (from ml-server/, with .env holding CALCULUS_API_KEY):
    python dump_wil.py --hours 6 --out /path/to/outdir
"""

import argparse
import asyncio
import json
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

import httpx

from app.config import settings
from app.clients.sensor_client import HOUSES, _datetime_to_unix

WIL_HOUSES = [
    ("wonenlimburg2", "phase-1"),
    ("wonenlimburg3", "phase-1"),
    ("wonenlimburg4", "phase-1"),
    ("wonenlimburg6", "phase-2"),
    ("wonenlimburg7", "phase-2"),
    ("wonenlimburg9", "phase-2"),
    ("wonenlimburg10", "phase-2"),
]


def _client():
    return httpx.AsyncClient(
        headers={"CalculusApiKey": settings.CALCULUS_API_KEY}, timeout=100.0
    )


def _summarize(payload: dict):
    """Count live (non-null) readings and freshest timestamp across a response."""
    live = 0
    total = 0
    last_ts = None
    metrics = set()
    for source in payload.get("dataSources", []) or []:
        for series in source.get("dataSeries", []) or []:
            key = series.get("key", "")
            sk = key.split("|")[1].split("#")[0] if "|" in key else key
            for entry in series.get("value", []) or []:
                total += 1
                if entry.get("value") is not None:
                    live += 1
                    metrics.add(sk)
                    if last_ts is None or entry["key"] > last_ts:
                        last_ts = entry["key"]
    return {"live": live, "total": total, "last": last_ts, "metrics": sorted(metrics)}


async def fetch_asset(client, asset, start_time, end_time):
    url = (
        f"{settings.CALCULUS_API_URL}/assets/{asset['id']}/aggregateseries"
        f"?unixTimestampStart={_datetime_to_unix(start_time)}"
        f"&unixTimestampEnd={_datetime_to_unix(end_time)}"
    )
    resp = await client.get(url)
    body = None
    try:
        body = resp.json()
    except Exception:
        body = {"_raw_text": resp.text}
    return {
        "asset_id": asset["id"],
        "asset_name": asset["name"],
        "status_code": resp.status_code,
        "request_url": url,
        "summary": _summarize(body) if resp.status_code == 200 else None,
        "response": body,
    }


async def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--hours", type=int, default=6)
    parser.add_argument("--out", required=True)
    args = parser.parse_args()

    if not settings.CALCULUS_API_KEY:
        print("! CALCULUS_API_KEY is empty — set it in ml-server/.env first.")
        return

    end_time = datetime.now(ZoneInfo("UTC"))
    start_time = end_time - timedelta(hours=args.hours)

    index = {
        "generated_at": end_time.isoformat(),
        "window_hours": args.hours,
        "window_start": start_time.isoformat(),
        "window_end": end_time.isoformat(),
        "calculus_api_url": settings.CALCULUS_API_URL,
        "houses": [],
    }

    async with _client() as client:
        for alias, phase in WIL_HOUSES:
            assets = HOUSES.get(alias, [])
            print(f"\n=== {alias} ({phase}) — {len(assets)} asset(s) ===")
            results = await asyncio.gather(
                *(fetch_asset(client, a, start_time, end_time) for a in assets)
            )

            house_live = sum((r["summary"]["live"] if r["summary"] else 0) for r in results)
            house_doc = {
                "alias": alias,
                "phase": phase,
                "asset_count": len(assets),
                "total_live_readings": house_live,
                "verdict": "LIVE" if house_live else "DARK",
                "assets": results,
            }
            index["houses"].append({
                "alias": alias,
                "phase": phase,
                "asset_count": len(assets),
                "total_live_readings": house_live,
                "verdict": house_doc["verdict"],
            })

            path = f"{args.out}/{alias}.json"
            with open(path, "w") as f:
                json.dump(house_doc, f, indent=2)

            for r in results:
                s = r["summary"]
                mark = " " if (s and s["live"]) else "*"
                note = (
                    f"{s['live']:>4}/{s['total']:<5} live  last={s['last']}  {s['metrics']}"
                    if s else f"[{r['status_code']}]"
                )
                print(f" {mark} {r['asset_id']:>7}  {r['asset_name']:<38}  {note}")
            print(f"  --> {house_doc['verdict']}: {house_live} live readings  ->  {path}")

    with open(f"{args.out}/_index.json", "w") as f:
        json.dump(index, f, indent=2)
    print(f"\nWrote index -> {args.out}/_index.json")


if __name__ == "__main__":
    asyncio.run(main())
