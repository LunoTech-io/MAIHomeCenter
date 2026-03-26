#!/usr/bin/env python3
"""Fetch raw Calculus API responses for all asset types of woning16 and save locally."""

import json
import time
import urllib.request
from datetime import datetime, timezone, timedelta

API_URL = "https://api.calculus.group/v3"
API_KEY = "WisocaZ1Nkp9U4Bd21gFmbV4UbNmNqT9Ufu2n09k3BsUc4W1hV"

# All woning16 assets — covering every type of sensor
ASSETS = [
    {"id": 9274, "name": "WONING 16 - digitale meter"},
    {"id": 9825, "name": "WONING 16 - Badkamer"},
    {"id": 9834, "name": "WONING 16 - Eetkamer"},
    {"id": 9276, "name": "WONING 16 - gasmeter"},
    {"id": 9832, "name": "WONING 16 - Hal beneden"},
    {"id": 15481, "name": "WONING 16 - hal boven"},
    {"id": 9826, "name": "WONING 16 - Keuken"},
    {"id": 9267, "name": "WONING 16 - Koelkast"},
    {"id": 9272, "name": "WONING 16 - Living"},
    {"id": 9269, "name": "WONING 16 - slaapkamer 1"},
    {"id": 9270, "name": "WONING 16 - slaapkamer 2"},
    {"id": 9271, "name": "WONING 16 - slaapkamer 3"},
    {"id": 9268, "name": "WONING 16 - TV"},
    {"id": 9266, "name": "WONING 16 - Wasmachine"},
    {"id": 9273, "name": "WONING 16 - watermeter"},
]

end_time = datetime.now(timezone.utc)
start_time = end_time - timedelta(hours=2)  # just 2 hours to keep it small

start_unix = int(start_time.timestamp())
end_unix = int(end_time.timestamp())

print(f"Time range: {start_time.isoformat()} to {end_time.isoformat()}")
print(f"Unix: {start_unix} to {end_unix}\n")

all_summaries = {}

for asset in ASSETS:
    asset_id = asset["id"]
    asset_name = asset["name"]
    safe_name = asset_name.replace(" ", "_").replace("-", "").replace("__", "_").strip("_")

    url = f"{API_URL}/assets/{asset_id}/aggregateseries?unixTimestampStart={start_unix}&unixTimestampEnd={end_unix}"

    print(f"Fetching {asset_name} (id={asset_id})...")

    req = urllib.request.Request(url, headers={"CalculusApiKey": API_KEY})
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read().decode())
    except Exception as e:
        print(f"  ERROR: {e}")
        continue

    # Save raw response
    outfile = f"asset_{asset_id}_{safe_name}.json"
    with open(outfile, "w") as f:
        json.dump(data, f, indent=2)

    # Summarize: what dataSources and dataSeries keys exist
    summary = {}
    for source in data.get("dataSources", []):
        source_name = source["name"]
        series_keys = []
        for series in source.get("dataSeries", []):
            key = series["key"]
            num_values = len(series.get("value", []))
            # Show a sample value
            sample = series["value"][0] if series["value"] else None
            series_keys.append({"key": key, "count": num_values, "sample": sample})
        summary[source_name] = series_keys

    all_summaries[asset_name] = summary
    print(f"  Sources: {list(summary.keys())}")
    for src, keys in summary.items():
        for k in keys:
            print(f"    {src} -> {k['key']} ({k['count']} values, sample: {k['sample']})")

    time.sleep(0.2)

# Save combined summary
with open("_summary.json", "w") as f:
    json.dump(all_summaries, f, indent=2)

print("\nDone! Raw files saved in current directory.")
print("See _summary.json for an overview of all data sources and keys.")
