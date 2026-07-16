"""Diagnostics for the Calculus asset wiring used by ml-server.

Two modes:

  ping      For houses already configured in HOUSES, GET each asset's
            aggregateseries and report which return data. Spots stale IDs.

  discover  Fetch the full Calculus asset catalog (GET /assets), group it
            into houses by name, and print each house as a ready-to-paste
            HOUSES entry. Flags houses that Calculus knows about but the
            ml-server does not (e.g. homes set up under a different alias),
            and houses with no room-level sensors. With --compare it diffs
            the live asset IDs against what HOUSES currently has.

Usage (from ml-server/, with .env holding CALCULUS_API_KEY):

    python ping_calculus.py ping                       # ping all configured houses
    python ping_calculus.py ping wonenlimburg1         # ping one
    python ping_calculus.py ping --prefix wonenlimburg # ping all WonenInLimburg
    python ping_calculus.py ping --hours 48 wonenlimburg1

    python ping_calculus.py discover                       # discover everything
    python ping_calculus.py discover "wonen in limburg"    # filter by name substring
    python ping_calculus.py discover "wonen in limburg" --compare
"""

import argparse
import asyncio
import re
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

import httpx

from app.config import settings
from app.clients.sensor_client import HOUSES, _datetime_to_unix, _extract_reading_data


def _client():
    return httpx.AsyncClient(
        headers={"CalculusApiKey": settings.CALCULUS_API_KEY}, timeout=100.0
    )


# ---------------------------------------------------------------- ping mode

async def ping_asset(client, asset, start_time, end_time):
    asset_id = asset["id"]
    asset_name = asset["name"]
    url = (
        f"{settings.CALCULUS_API_URL}/assets/{asset_id}/aggregateseries"
        f"?unixTimestampStart={_datetime_to_unix(start_time)}"
        f"&unixTimestampEnd={_datetime_to_unix(end_time)}"
    )
    try:
        resp = await client.get(url)
    except httpx.RequestError as e:
        return (asset_id, asset_name, "ERR", f"request failed: {e}")

    if resp.status_code != 200:
        return (asset_id, asset_name, str(resp.status_code), resp.text[:120])

    try:
        rows = _extract_reading_data(resp.json(), asset_id)
    except (KeyError, ValueError) as e:
        return (asset_id, asset_name, "200", f"unexpected shape: {e}")

    if not rows:
        return (asset_id, asset_name, "200", "EMPTY (0 readings)")
    keys = sorted({k for r in rows for k in r if k not in ("SensorID", "SensorType", "Timestamp")})
    return (asset_id, asset_name, "200", f"OK  {len(rows)} readings  keys={keys}")


async def ping_house(client, house_id, hours):
    assets = HOUSES.get(house_id)
    print(f"\n=== {house_id} ===")
    if not assets:
        print("  ! not in HOUSES")
        return
    end_time = datetime.now(ZoneInfo("UTC"))
    start_time = end_time - timedelta(hours=hours)
    results = await asyncio.gather(
        *(ping_asset(client, a, start_time, end_time) for a in assets)
    )
    for asset_id, name, status, note in results:
        flag = " " if status == "200" and note.startswith("OK") else "*"
        print(f" {flag} [{status:>3}] {asset_id:>7}  {name:<34}  {note}")


async def run_ping(args):
    if args.prefix:
        houses = [h for h in HOUSES if h.startswith(args.prefix)]
    elif args.houses:
        houses = args.houses
    else:
        houses = list(HOUSES)
    print(f"Pinging {settings.CALCULUS_API_URL} for {len(houses)} house(s), "
          f"last {args.hours}h. '*' = no/empty data.")
    async with _client() as client:
        for h in houses:
            await ping_house(client, h, args.hours)


# ------------------------------------------------------------ discover mode

def alias_from_label(label: str) -> str:
    """Turn a Calculus house label ('Wonen in Limburg 1') into an ml-server
    alias ('wonenlimburg1'), matching the existing HOUSES key convention."""
    s = label.lower()
    s = re.sub(r"\bin\b", " ", s)      # drop the connective 'in'
    s = re.sub(r"[^a-z0-9]+", "", s)   # strip spaces/punctuation
    return s


def group_assets(assets: list[dict]) -> dict:
    """Group flat Calculus assets into {house_label: {"parent": a|None,
    "rooms": [a, ...]}} by splitting the name on ' - '."""
    houses: dict[str, dict] = {}
    for a in assets:
        name = a["name"]
        if " - " in name:
            label, _room = name.split(" - ", 1)
            bucket = houses.setdefault(label.strip(), {"parent": None, "rooms": []})
            bucket["rooms"].append(a)
        else:
            bucket = houses.setdefault(name.strip(), {"parent": None, "rooms": []})
            bucket["parent"] = a
    return houses


async def run_discover(args):
    async with _client() as client:
        resp = await client.get(f"{settings.CALCULUS_API_URL}/assets")
        resp.raise_for_status()
        catalog = resp.json()

    if args.filter:
        needle = args.filter.lower()
        catalog = [a for a in catalog if needle in a["name"].lower()]

    houses = group_assets(catalog)
    print(f"Discovered {len(houses)} house(s) from {len(catalog)} matching assets.\n")

    def sort_key(item):
        label = item[0]
        m = re.search(r"(\d+)", label)
        return (label[: m.start()] if m else label, int(m.group(1)) if m else 0)

    for label, bucket in sorted(houses.items(), key=sort_key):
        alias = alias_from_label(label)
        rooms = sorted(bucket["rooms"], key=lambda a: a["id"])
        # Fase-2 homes have no per-room assets; the whole home is one asset
        # (sensors are nested dataSources). Fall back to that parent asset.
        single_asset = not rooms and bucket["parent"] is not None
        entry_assets = rooms if rooms else ([bucket["parent"]] if single_asset else [])
        known = alias in HOUSES

        marks = []
        if not known:
            marks.append("NEW — not in HOUSES")
        if single_asset:
            marks.append("single-asset home (Fase 2) — sensors are dataSources")
        elif not entry_assets:
            marks.append("NO assets found")
        suffix = f"   <-- {'; '.join(marks)}" if marks else ""
        kind = "1 asset" if single_asset else f"{len(rooms)} rooms"
        print(f"# {label}  =>  alias '{alias}'  ({kind}){suffix}")

        if args.compare and known:
            live = {a["id"] for a in entry_assets}
            configured = {a["id"] for a in HOUSES[alias]}
            missing = configured - live      # in HOUSES but no longer in Calculus
            added = live - configured        # in Calculus but not in HOUSES
            if missing:
                print(f"    stale in HOUSES (not in Calculus): {sorted(missing)}")
            if added:
                print(f"    new in Calculus (add to HOUSES):   {sorted(added)}")
            if not missing and not added:
                print("    in sync ✓")
            continue

        if not args.compare:
            print(f'    "{alias}": [')
            for a in entry_assets:
                print(f'        {{"id": {a["id"]}, "name": "{a["name"]}"}},')
            print("    ],")
        print()


# ----------------------------------------------------------------- entry

async def main():
    parser = argparse.ArgumentParser()
    sub = parser.add_subparsers(dest="mode", required=True)

    p = sub.add_parser("ping", help="ping configured houses and report data")
    p.add_argument("houses", nargs="*", help="aliases to ping (default: all)")
    p.add_argument("--prefix", help="ping all houses whose alias starts with this")
    p.add_argument("--hours", type=int, default=settings.SENSOR_HISTORY_HOURS)

    d = sub.add_parser("discover", help="discover assets from the Calculus catalog")
    d.add_argument("filter", nargs="?", help="only names containing this substring")
    d.add_argument("--compare", action="store_true",
                   help="diff live asset IDs against HOUSES instead of printing entries")

    args = parser.parse_args()

    if not settings.CALCULUS_API_KEY:
        print("! CALCULUS_API_KEY is empty — set it in ml-server/.env first.")
        return

    if args.mode == "ping":
        await run_ping(args)
    else:
        await run_discover(args)


if __name__ == "__main__":
    asyncio.run(main())
