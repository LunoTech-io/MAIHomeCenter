import asyncio
import logging
import re
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

import httpx
import pandas as pd

from app.config import settings

logger = logging.getLogger(__name__)

# All houses with their Calculus asset IDs, grouped by house key.
# Each house lists only room-level assets (not the parent "Woningen" asset).
HOUSES = {
    "woning16": [
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
    ],
    "weller1": [
        {"id": 10290, "name": "Weller 1 - Badkamer"},
        {"id": 10287, "name": "Weller 1 - Diepvries"},
        {"id": 10304, "name": "Weller 1 - Digitale meter"},
        {"id": 10285, "name": "Weller 1 - Droogkast"},
        {"id": 10292, "name": "Weller 1 - Eetkamer"},
        {"id": 10324, "name": "Weller 1 - Gasmeter"},
        {"id": 10299, "name": "Weller 1 - Hal beneden"},
        {"id": 10293, "name": "Weller 1 - Hal boven"},
        {"id": 10291, "name": "Weller 1 - Keuken"},
        {"id": 10295, "name": "Weller 1 - Living"},
        {"id": 10296, "name": "Weller 1 - Slaapkamer 1"},
        {"id": 10297, "name": "Weller 1 - Slaapkamer 2"},
        {"id": 10298, "name": "Weller 1 - Slaapkamer 3"},
        {"id": 10289, "name": "Weller 1 - TV"},
        {"id": 10284, "name": "Weller 1 - Wasmachine"},
        {"id": 10294, "name": "Weller 1 - Watermeter"},
    ],
    "weller2": [
        {"id": 10312, "name": "Weller 2 - Badkamer"},
        {"id": 10309, "name": "Weller 2 - Diepvries"},
        {"id": 10322, "name": "Weller 2 - Digitale meter"},
        {"id": 10308, "name": "Weller 2 - Droogkast"},
        {"id": 10314, "name": "Weller 2 - Eetkamer"},
        {"id": 10323, "name": "Weller 2 - Gasmeter"},
        {"id": 10321, "name": "Weller 2 - Hal beneden"},
        {"id": 10315, "name": "Weller 2 - Hal boven"},
        {"id": 10313, "name": "Weller 2 - Keuken"},
        {"id": 10310, "name": "Weller 2 - Koelkast"},
        {"id": 10317, "name": "Weller 2 - Living"},
        {"id": 10318, "name": "Weller 2 - Slaapkamer 1"},
        {"id": 10319, "name": "Weller 2 - Slaapkamer 2"},
        {"id": 10320, "name": "Weller 2 - Slaapkamer 3"},
        {"id": 10311, "name": "Weller 2 - TV"},
        {"id": 10307, "name": "Weller 2 - Wasmachine"},
        {"id": 10316, "name": "Weller 2 - Watermeter"},
    ],
    "weller3": [
        {"id": 10334, "name": "Weller 3 - Badkamer"},
        {"id": 10331, "name": "Weller 3 - Diepvries"},
        {"id": 10545, "name": "Weller 3 - Digitale meter"},
        {"id": 10330, "name": "Weller 3 - Droogkast"},
        {"id": 10336, "name": "Weller 3 - Eetkamer"},
        {"id": 10546, "name": "Weller 3 - Gasmeter"},
        {"id": 10343, "name": "Weller 3 - Hal beneden"},
        {"id": 10337, "name": "Weller 3 - Hal boven"},
        {"id": 10335, "name": "Weller 3 - Keuken"},
        {"id": 10332, "name": "Weller 3 - Koelkast"},
        {"id": 10339, "name": "Weller 3 - Living"},
        {"id": 10340, "name": "Weller 3 - Slaapkamer 1"},
        {"id": 10341, "name": "Weller 3 - Slaapkamer 2"},
        {"id": 10342, "name": "Weller 3 - Slaapkamer 3"},
        {"id": 10333, "name": "Weller 3 - TV"},
        {"id": 10329, "name": "Weller 3 - Wasmachine"},
    ],
    "weller4": [
        {"id": 10350, "name": "Weller 4 - Badkamer"},
        {"id": 10347, "name": "Weller 4 - Diepvries"},
        {"id": 10360, "name": "Weller 4 - Digitale meter"},
        {"id": 10346, "name": "Weller 4 - Droogkast"},
        {"id": 10352, "name": "Weller 4 - Eetkamer"},
        {"id": 10361, "name": "Weller 4 - Gasmeter"},
        {"id": 10359, "name": "Weller 4 - Hal beneden"},
        {"id": 10353, "name": "Weller 4 - Hal boven"},
        {"id": 10351, "name": "Weller 4 - Keuken"},
        {"id": 10348, "name": "Weller 4 - Koelkast"},
        {"id": 10355, "name": "Weller 4 - Living"},
        {"id": 10356, "name": "Weller 4 - Slaapkamer 1"},
        {"id": 10357, "name": "Weller 4 - Slaapkamer 2"},
        {"id": 10358, "name": "Weller 4 - Slaapkamer 3"},
        {"id": 10349, "name": "Weller 4 - TV"},
        {"id": 10345, "name": "Weller 4 - Wasmachine"},
        {"id": 10354, "name": "Weller 4 - Watermeter"},
    ],
    "weller5": [
        {"id": 10368, "name": "Weller 5 - Badkamer"},
        {"id": 10365, "name": "Weller 5 - Diepvries"},
        {"id": 10378, "name": "Weller 5 - Digitale meter"},
        {"id": 10364, "name": "Weller 5 - Droogkast"},
        {"id": 10370, "name": "Weller 5 - Eetkamer"},
        {"id": 10379, "name": "Weller 5 - Gasmeter"},
        {"id": 10377, "name": "Weller 5 - Hal beneden"},
        {"id": 10371, "name": "Weller 5 - Hal boven"},
        {"id": 10369, "name": "Weller 5 - Keuken"},
        {"id": 10366, "name": "Weller 5 - Koelkast"},
        {"id": 10373, "name": "Weller 5 - Living"},
        {"id": 10374, "name": "Weller 5 - Slaapkamer 1"},
        {"id": 10375, "name": "Weller 5 - Slaapkamer 2"},
        {"id": 10376, "name": "Weller 5 - Slaapkamer 3"},
        {"id": 10367, "name": "Weller 5 - TV"},
        {"id": 10363, "name": "Weller 5 - Wasmachine"},
        {"id": 10372, "name": "Weller 5 - Watermeter"},
    ],
    "wonenzuid1": [
        {"id": 9821, "name": "Wonen Zuid 1 - Badkamer"},
        {"id": 9813, "name": "Wonen Zuid 1 - Diepvries"},
        {"id": 9349, "name": "Wonen Zuid 1 - Digitale meter"},
        {"id": 9814, "name": "Wonen Zuid 1 - Droogkast"},
        {"id": 9837, "name": "Wonen Zuid 1 - Eetkamer"},
        {"id": 9350, "name": "Wonen Zuid 1 - Gasmeter"},
        {"id": 9835, "name": "Wonen Zuid 1 - Hal beneden"},
        {"id": 9836, "name": "Wonen Zuid 1 - Hal boven"},
        {"id": 9822, "name": "Wonen Zuid 1 - Keuken"},
        {"id": 9811, "name": "Wonen Zuid 1 - Koelkast"},
        {"id": 9815, "name": "Wonen Zuid 1 - Living"},
        {"id": 9816, "name": "Wonen Zuid 1 - slaapkamer 1"},
        {"id": 9817, "name": "Wonen Zuid 1 - slaapkamer 2"},
        {"id": 9818, "name": "Wonen Zuid 1 - slaapkamer 3"},
        {"id": 9812, "name": "Wonen Zuid 1 - TV"},
        {"id": 9351, "name": "Wonen Zuid 1 - Wasmachine"},
        {"id": 9819, "name": "Wonen Zuid 1 - Watermeter"},
    ],
    "wonenzuid2": [
        {"id": 9883, "name": "Wonen Zuid 2 - Badkamer"},
        {"id": 9880, "name": "Wonen Zuid 2 - Diepvries"},
        {"id": 10301, "name": "Wonen Zuid 2 - Digitale meter"},
        {"id": 9885, "name": "Wonen Zuid 2 - Eetkamer"},
        {"id": 10325, "name": "Wonen Zuid 2 - Gasmeter"},
        {"id": 9891, "name": "Wonen Zuid 2 - Hal beneden"},
        {"id": 9886, "name": "Wonen Zuid 2 - Hal boven"},
        {"id": 9884, "name": "Wonen Zuid 2 - Keuken"},
        {"id": 9881, "name": "Wonen Zuid 2 - Koelkast"},
        {"id": 9888, "name": "Wonen Zuid 2 - Living"},
        {"id": 9889, "name": "Wonen Zuid 2 - Slaapkamer 1"},
        {"id": 9890, "name": "Wonen Zuid 2 - Slaapkamer 2"},
        {"id": 9882, "name": "Wonen Zuid 2 - TV"},
        {"id": 9879, "name": "Wonen Zuid 2 - Wasmachine"},
        {"id": 9887, "name": "Wonen Zuid 2 - Watermeter"},
    ],
    "wonenzuid3": [
        {"id": 9896, "name": "Wonen Zuid 3 - Badkamer"},
        {"id": 10302, "name": "Wonen Zuid 3 - Digitale meter"},
        {"id": 9893, "name": "Wonen Zuid 3 - Droogkast"},
        {"id": 9898, "name": "Wonen Zuid 3 - Eetkamer"},
        {"id": 10326, "name": "Wonen Zuid 3 - Gasmeter"},
        {"id": 9905, "name": "Wonen Zuid 3 - Hal beneden"},
        {"id": 9899, "name": "Wonen Zuid 3 - Hal boven"},
        {"id": 9897, "name": "Wonen Zuid 3 - Keuken"},
        {"id": 9894, "name": "Wonen Zuid 3 - Koelkast"},
        {"id": 9901, "name": "Wonen Zuid 3 - Living"},
        {"id": 9902, "name": "Wonen Zuid 3 - Slaapkamer 1"},
        {"id": 9903, "name": "Wonen Zuid 3 - Slaapkamer 2"},
        {"id": 9904, "name": "Wonen Zuid 3 - Slaapkamer 3"},
        {"id": 9895, "name": "Wonen Zuid 3 - TV"},
        {"id": 9892, "name": "Wonen Zuid 3 - Wasmachine"},
        {"id": 9900, "name": "Wonen Zuid 3 - Watermeter"},
    ],
    "wonenzuid4": [
        {"id": 10425, "name": "Wonen Zuid 4 - Badkamer"},
        {"id": 10422, "name": "Wonen Zuid 4 - Diepvries"},
        {"id": 10435, "name": "Wonen Zuid 4 - Digitale meter"},
        {"id": 10421, "name": "Wonen Zuid 4 - Droogkast"},
        {"id": 10427, "name": "Wonen Zuid 4 - Eetkamer"},
        {"id": 10436, "name": "Wonen Zuid 4 - Gasmeter"},
        {"id": 10434, "name": "Wonen Zuid 4 - Hal beneden"},
        {"id": 10428, "name": "Wonen Zuid 4 - Hal boven"},
        {"id": 10426, "name": "Wonen Zuid 4 - Keuken"},
        {"id": 10423, "name": "Wonen Zuid 4 - Koelkast"},
        {"id": 10430, "name": "Wonen Zuid 4 - Living"},
        {"id": 10431, "name": "Wonen Zuid 4 - Slaapkamer 1"},
        {"id": 10432, "name": "Wonen Zuid 4 - Slaapkamer 2"},
        {"id": 10433, "name": "Wonen Zuid 4 - Slaapkamer 3"},
        {"id": 10424, "name": "Wonen Zuid 4 - TV"},
        {"id": 10420, "name": "Wonen Zuid 4 - Wasmachine"},
        {"id": 10429, "name": "Wonen Zuid 4 - Watermeter"},
    ],
    "wonenzuid5": [
        {"id": 10273, "name": "Wonen Zuid 5 - Badkamer"},
        {"id": 10270, "name": "Wonen Zuid 5 - Diepvries"},
        {"id": 10300, "name": "Wonen Zuid 5 - Digitale meter"},
        {"id": 10269, "name": "Wonen Zuid 5 - Droogkast"},
        {"id": 10275, "name": "Wonen Zuid 5 - Eetkamer"},
        {"id": 10544, "name": "Wonen Zuid 5 - Gasmeter"},
        {"id": 10282, "name": "Wonen Zuid 5 - Hal beneden"},
        {"id": 10276, "name": "Wonen Zuid 5 - Hal boven"},
        {"id": 10274, "name": "Wonen Zuid 5 - Keuken"},
        {"id": 10271, "name": "Wonen Zuid 5 - Koelkast"},
        {"id": 10278, "name": "Wonen Zuid 5 - Living"},
        {"id": 10279, "name": "Wonen Zuid 5 - Slaapkamer 1"},
        {"id": 10280, "name": "Wonen Zuid 5 - Slaapkamer 2"},
        {"id": 10281, "name": "Wonen Zuid 5 - Slaapkamer 3"},
        {"id": 10272, "name": "Wonen Zuid 5 - TV"},
        {"id": 10268, "name": "Wonen Zuid 5 - Wasmachine"},
        {"id": 10277, "name": "Wonen Zuid 5 - Watermeter"},
    ],
    "wonenlimburg1": [
        {"id": 10406, "name": "Wonen in Limburg 1 - Badkamer"},
        {"id": 10416, "name": "Wonen in Limburg 1 - Digitale meter"},
        {"id": 10402, "name": "Wonen in Limburg 1 - Droogkast"},
        {"id": 10408, "name": "Wonen in Limburg 1 - Eetkamer"},
        {"id": 10417, "name": "Wonen in Limburg 1 - Gasmeter"},
        {"id": 10415, "name": "Wonen in Limburg 1 - Hal beneden"},
        {"id": 10409, "name": "Wonen in Limburg 1 - Hal boven"},
        {"id": 10407, "name": "Wonen in Limburg 1 - Keuken"},
        {"id": 10404, "name": "Wonen in Limburg 1 - Koelkast"},
        {"id": 10411, "name": "Wonen in Limburg 1 - Living"},
        {"id": 10412, "name": "Wonen in Limburg 1 - Slaapkamer 1"},
        {"id": 10413, "name": "Wonen in Limburg 1 - Slaapkamer 2"},
        {"id": 10405, "name": "Wonen in Limburg 1 - TV"},
        {"id": 10401, "name": "Wonen in Limburg 1 - Wasmachine"},
        {"id": 10410, "name": "Wonen in Limburg 1 - Watermeter"},
    ],
    "wonenlimburg2": [
        {"id": 10443, "name": "Wonen in Limburg 2 - Badkamer"},
        {"id": 10440, "name": "Wonen in Limburg 2 - Diepvries"},
        {"id": 10453, "name": "Wonen in Limburg 2 - Digitale meter"},
        {"id": 10439, "name": "Wonen in Limburg 2 - Droogkast"},
        {"id": 10445, "name": "Wonen in Limburg 2 - Eetkamer"},
        {"id": 10454, "name": "Wonen in Limburg 2 - Gasmeter"},
        {"id": 10452, "name": "Wonen in Limburg 2 - Hal beneden"},
        {"id": 10446, "name": "Wonen in Limburg 2 - Hal boven"},
        {"id": 10444, "name": "Wonen in Limburg 2 - Keuken"},
        {"id": 10441, "name": "Wonen in Limburg 2 - Koelkast"},
        {"id": 10448, "name": "Wonen in Limburg 2 - Living"},
        {"id": 10449, "name": "Wonen in Limburg 2 - Slaapkamer 1"},
        {"id": 10450, "name": "Wonen in Limburg 2 - Slaapkamer 2"},
        {"id": 10451, "name": "Wonen in Limburg 2 - Slaapkamer 3"},
        {"id": 10442, "name": "Wonen in Limburg 2 - TV"},
        {"id": 10438, "name": "Wonen in Limburg 2 - Wasmachine"},
        {"id": 10447, "name": "Wonen in Limburg 2 - Watermeter"},
    ],
    "wonenlimburg3": [
        {"id": 9847, "name": "Wonen in Limburg 3 - Badkamer"},
        {"id": 9838, "name": "Wonen in Limburg 3 - Digitale meter"},
        {"id": 9843, "name": "Wonen in Limburg 3 - Droogkast"},
        {"id": 9849, "name": "Wonen in Limburg 3 - Eetkamer"},
        {"id": 9841, "name": "Wonen in Limburg 3 - Gasmeter"},
        {"id": 9855, "name": "Wonen in Limburg 3 - Hal beneden"},
        {"id": 9850, "name": "Wonen in Limburg 3 - Hal boven"},
        {"id": 9848, "name": "Wonen in Limburg 3 - Keuken"},
        {"id": 9845, "name": "Wonen in Limburg 3 - Koelkast/diepvries"},
        {"id": 9851, "name": "Wonen in Limburg 3 - Living"},
        {"id": 9852, "name": "Wonen in Limburg 3 - Slaapkamer 1"},
        {"id": 9853, "name": "Wonen in Limburg 3 - Slaapkamer 2"},
        {"id": 9854, "name": "Wonen in Limburg 3 - Slaapkamer 3"},
        {"id": 9846, "name": "Wonen in Limburg 3 - TV"},
        {"id": 9842, "name": "Wonen in Limburg 3 - Wasmachine"},
        {"id": 9840, "name": "Wonen in Limburg 3 - Watermeter"},
    ],
    "wonenlimburg4": [
        {"id": 9863, "name": "Wonen in Limburg 4 - Badkamer"},
        {"id": 9860, "name": "Wonen in Limburg 4 - Diepvries"},
        {"id": 9856, "name": "Wonen in Limburg 4 - Digitale meter"},
        {"id": 9859, "name": "Wonen in Limburg 4 - Droogkast"},
        {"id": 9865, "name": "Wonen in Limburg 4 - Eetkamer"},
        {"id": 9857, "name": "Wonen in Limburg 4 - Gasmeter"},
        {"id": 9878, "name": "Wonen in Limburg 4 - Hal beneden"},
        {"id": 9866, "name": "Wonen in Limburg 4 - Hal boven"},
        {"id": 9864, "name": "Wonen in Limburg 4 - Keuken"},
        {"id": 9861, "name": "Wonen in Limburg 4 - Koelkast"},
        {"id": 9867, "name": "Wonen in Limburg 4 - Living"},
        {"id": 9875, "name": "Wonen in Limburg 4 - Slaapkamer 1"},
        {"id": 9876, "name": "Wonen in Limburg 4 - Slaapkamer 2"},
        {"id": 9877, "name": "Wonen in Limburg 4 - Slaapkamer 3"},
        {"id": 9862, "name": "Wonen in Limburg 4 - TV"},
        {"id": 9858, "name": "Wonen in Limburg 4 - Wasmachine"},
        {"id": 11909, "name": "Wonen in Limburg 4 - Watermeter"},
    ],
    "wonenlimburg5": [
        {"id": 10256, "name": "Wonen in Limburg 5 - Badkamer"},
        {"id": 10253, "name": "Wonen in Limburg 5 - Diepvries"},
        {"id": 10303, "name": "Wonen in Limburg 5 - Digitale meter"},
        {"id": 10252, "name": "Wonen in Limburg 5 - Droogkast"},
        {"id": 10258, "name": "Wonen in Limburg 5 - Eetkamer"},
        {"id": 10327, "name": "Wonen in Limburg 5 - Gasmeter"},
        {"id": 10266, "name": "Wonen in Limburg 5 - Hal beneden"},
        {"id": 10259, "name": "Wonen in Limburg 5 - Hal boven"},
        {"id": 10257, "name": "Wonen in Limburg 5 - Keuken"},
        {"id": 10254, "name": "Wonen in Limburg 5 - Koelkast"},
        {"id": 10261, "name": "Wonen in Limburg 5 - Living"},
        {"id": 10262, "name": "Wonen in Limburg 5 - Slaapkamer 1"},
        {"id": 10263, "name": "Wonen in Limburg 5 - Slaapkamer 2"},
        {"id": 10264, "name": "Wonen in Limburg 5 - Slaapkamer 3"},
        {"id": 10255, "name": "Wonen in Limburg 5 - TV"},
        {"id": 10251, "name": "Wonen in Limburg 5 - Wasmachine"},
        {"id": 10260, "name": "Wonen in Limburg 5 - Watermeter"},
    ],
    # Fase-2 homes: the whole home is a single Calculus asset with per-room
    # sensors nested as dataSources (no separate room/meter assets). The
    # "fase2" flag routes the twin push through _extract_fase2_rooms.
    "wonenlimburg6": [{"id": 23660, "name": "Wonen in Limburg 6", "fase2": True}],
    "wonenlimburg7": [{"id": 23658, "name": "Wonen in Limburg 7", "fase2": True}],
    "wonenlimburg9": [{"id": 23659, "name": "Wonen in Limburg 9", "fase2": True}],
    "wonenlimburg10": [{"id": 23656, "name": "Wonen in Limburg 10", "fase2": True}],
    # Leefgoed — Fase-2 corporation.
    "leefgoed1": [{"id": 23663, "name": "Leefgoed 1", "fase2": True}],
    "leefgoed2": [{"id": 23664, "name": "Leefgoed 2", "fase2": True}],
    "leefgoed3": [{"id": 23665, "name": "Leefgoed 3", "fase2": True}],
    "leefgoed4": [{"id": 23666, "name": "Leefgoed 4", "fase2": True}],
    "leefgoed5": [{"id": 23667, "name": "Leefgoed 5", "fase2": True}],
    # Tiwos — Fase-2 corporation. Tiwos 1 has only a gateway (no room
    # sensors) until commissioned, so it pushes empty rooms for now.
    "tiwos1": [{"id": 23552, "name": "Tiwos 1", "fase2": True}],
    "tiwos3": [{"id": 23554, "name": "Tiwos 3", "fase2": True}],
    "tiwos4": [{"id": 23555, "name": "Tiwos 4", "fase2": True}],
    "tiwos5": [{"id": 23556, "name": "Tiwos 5", "fase2": True}],
}


def _datetime_to_unix(dt: datetime) -> int:
    """Convert a timezone-aware datetime to a Unix timestamp."""
    dt_utc = dt.astimezone(ZoneInfo("UTC"))
    return int((dt_utc - datetime(1970, 1, 1, tzinfo=ZoneInfo("UTC"))).total_seconds())


def _extract_reading_data(data: dict, asset_id: int) -> list[dict]:
    """Extract flat reading records from the Calculus API response.

    Fase-1 assets carry a single dataSource, so the bare sensor key
    (e.g. "temperature") is unambiguous. Fase-2 assets pack a whole home
    into one asset with many dataSources — and several emit the same key
    (every WT101 valve reports "temperature", every WS202 reports
    "pir_status"). When more than one source is present we prefix the
    column with the cleaned source name (e.g. "WT101_Badkamer_temperature")
    so per-room readings don't collapse onto one column and overwrite each
    other during the groupby. Single-source (Fase-1) assets are unchanged,
    which keeps the trained models' feature column names stable.
    """
    disambiguate = len(data["dataSources"]) > 1
    reading_data = []
    for source in data["dataSources"]:
        sensor_name = source["name"]
        source_prefix = re.sub(r"[^\w\s]", "", sensor_name).strip().replace(" ", "_")
        for series in source["dataSeries"]:
            key_parts = series["key"].split("|")
            sensor_key = key_parts[1].split("#")[0]
            column = f"{source_prefix}_{sensor_key}" if disambiguate else sensor_key
            for entry in series["value"]:
                reading_data.append({
                    "SensorID": asset_id,
                    "SensorType": sensor_name,
                    "Timestamp": entry["key"],
                    column: entry["value"],
                })
    return reading_data


async def _fetch_asset(
    client: httpx.AsyncClient,
    asset: dict,
    start_time: datetime,
    end_time: datetime,
) -> pd.DataFrame | None:
    """Fetch and process data for a single asset."""
    asset_id = asset["id"]
    asset_name = asset["name"]
    clean_prefix = re.sub(r"[^\w\s]", "", asset_name).strip().replace(" ", "_")

    start_unix = _datetime_to_unix(start_time)
    end_unix = _datetime_to_unix(end_time)
    url = (
        f"{settings.CALCULUS_API_URL}/assets/{asset_id}/aggregateseries"
        f"?unixTimestampStart={start_unix}&unixTimestampEnd={end_unix}"
    )

    try:
        response = await client.get(url)
        response.raise_for_status()
        data = response.json()
    except (httpx.HTTPStatusError, httpx.RequestError) as e:
        logger.error("Failed to fetch %s: %s", asset_name, e)
        return None

    reading_data = _extract_reading_data(data, asset_id)
    if not reading_data:
        return None

    df = pd.DataFrame(reading_data)
    df = df.groupby("Timestamp").agg("first").reset_index()
    df["Timestamp"] = pd.to_datetime(df["Timestamp"])

    # Drop internal columns
    df = df.drop(columns=[c for c in ["SensorID", "SensorType"] if c in df.columns])

    # Rename columns with asset prefix (except Timestamp)
    new_cols = {col: f"{clean_prefix}_{col}" for col in df.columns if col != "Timestamp"}
    df = df.rename(columns=new_cols)

    logger.debug("Fetched %s: %d rows", asset_name, len(df))
    return df


async def fetch_sensor_data(house_id: str | None = None, hours: int | None = None) -> pd.DataFrame:
    """Fetch and merge sensor data for all assets of a given house."""
    if hours is None:
        hours = settings.SENSOR_HISTORY_HOURS

    if house_id is None:
        house_id = settings.HOUSE_ID

    assets = HOUSES.get(house_id)
    if not assets:
        logger.error("Unknown house_id: %s", house_id)
        return pd.DataFrame()

    end_time = datetime.now(ZoneInfo("UTC"))
    start_time = end_time - timedelta(hours=hours)

    logger.info("Fetching sensor data for %s from %s to %s...", house_id, start_time, end_time)

    async with httpx.AsyncClient(
        headers={"CalculusApiKey": settings.CALCULUS_API_KEY},
        timeout=100.0,
    ) as client:
        tasks = [
            _fetch_asset(client, asset, start_time, end_time)
            for asset in assets
        ]
        results = await asyncio.gather(*tasks)

    # Merge all asset DataFrames
    df = pd.DataFrame()
    for asset, result in zip(assets, results):
        if result is None or result.empty:
            continue
        if df.empty:
            df = result
        else:
            df = pd.merge(df, result, on="Timestamp", how="outer")

    if not df.empty:
        df = df.sort_values("Timestamp").reset_index(drop=True)
        # Coerce non-Timestamp columns to numeric (API may return strings)
        for col in df.columns:
            if col != "Timestamp":
                df[col] = pd.to_numeric(df[col], errors="coerce")
        df = df.interpolate(method="linear").ffill().bfill()
        logger.info("Sensor data for %s merged: %s", house_id, df.shape)
    else:
        logger.warning("No sensor data retrieved for %s", house_id)

    return df


def get_all_house_ids() -> list[str]:
    """Return all configured house IDs."""
    return list(HOUSES.keys())
