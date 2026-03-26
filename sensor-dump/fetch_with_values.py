#!/usr/bin/env python3
"""Fetch 48h of data, find actual non-null values, and summarize what's available."""

import json
import time
import urllib.request
from datetime import datetime, timezone, timedelta

API_URL = "https://api.calculus.group/v3"
API_KEY = "WisocaZ1Nkp9U4Bd21gFmbV4UbNmNqT9Ufu2n09k3BsUc4W1hV"

# Pick representative assets: one room, one meter, one appliance, the living room (AM307)
SAMPLE_ASSETS = [
    {"id": 9272, "name": "WONING 16 - Living"},          # AM307 (multi-sensor)
    {"id": 9825, "name": "WONING 16 - Badkamer"},        # Motion + thermostat
    {"id": 9274, "name": "WONING 16 - digitale meter"},   # P1 electricity
    {"id": 9276, "name": "WONING 16 - gasmeter"},         # Gas
    {"id": 9267, "name": "WONING 16 - Koelkast"},         # Smart plug
    {"id": 9268, "name": "WONING 16 - TV"},               # Smart plug
    {"id": 9273, "name": "WONING 16 - watermeter"},        # Water
    {"id": 9832, "name": "WONING 16 - Hal beneden"},      # Door sensor + thermostat
]

# Also check weller1 living room to compare
SAMPLE_ASSETS.append({"id": 10295, "name": "Weller 1 - Living"})

end_time = datetime.now(timezone.utc)
start_time = end_time - timedelta(hours=48)

start_unix = int(start_time.timestamp())
end_unix = int(end_time.timestamp())

print(f"Time range: {start_time.isoformat()} to {end_time.isoformat()} (48h)")
print(f"=" * 80)

for asset in SAMPLE_ASSETS:
    asset_id = asset["id"]
    asset_name = asset["name"]

    url = f"{API_URL}/assets/{asset_id}/aggregateseries?unixTimestampStart={start_unix}&unixTimestampEnd={end_unix}"

    req = urllib.request.Request(url, headers={"CalculusApiKey": API_KEY})
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            data = json.loads(resp.read().decode())
    except Exception as e:
        print(f"\n{asset_name}: ERROR — {e}")
        continue

    # Save raw
    safe_name = asset_name.replace(" ", "_").replace("-", "")
    with open(f"raw_48h_{asset_id}.json", "w") as f:
        json.dump(data, f, indent=2)

    print(f"\n{'=' * 80}")
    print(f"{asset_name} (id={asset_id})")
    print(f"{'=' * 80}")

    for source in data.get("dataSources", []):
        source_name = source["name"]
        for series in source.get("dataSeries", []):
            key = series["key"]
            values = series.get("value", [])
            non_null = [v for v in values if v["value"] is not None]
            total = len(values)

            if non_null:
                latest_val = non_null[-1]
                first_val = non_null[0]
                # Find value range
                nums = [v["value"] for v in non_null if isinstance(v["value"], (int, float))]
                if nums:
                    range_str = f"[{min(nums):.2f} .. {max(nums):.2f}]"
                else:
                    range_str = f"(non-numeric)"
                print(f"  {key}")
                print(f"    {len(non_null)}/{total} non-null | range: {range_str}")
                print(f"    first: {first_val['key']} = {first_val['value']}")
                print(f"    last:  {latest_val['key']} = {latest_val['value']}")
            else:
                print(f"  {key}")
                print(f"    ALL NULL ({total} values)")

    time.sleep(0.3)

print(f"\n{'=' * 80}")
print("Done! Raw 48h files saved as raw_48h_*.json")
