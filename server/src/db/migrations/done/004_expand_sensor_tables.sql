-- Add environment columns to twin_sensor_data (backward compatible — NULL default)
ALTER TABLE twin_sensor_data
  ADD COLUMN IF NOT EXISTS humidity DECIMAL,
  ADD COLUMN IF NOT EXISTS co2 DECIMAL,
  ADD COLUMN IF NOT EXISTS light_level DECIMAL,
  ADD COLUMN IF NOT EXISTS pressure DECIMAL,
  ADD COLUMN IF NOT EXISTS tvoc DECIMAL,
  ADD COLUMN IF NOT EXISTS valve_position DECIMAL,
  ADD COLUMN IF NOT EXISTS door_status SMALLINT;

-- Electricity + gas meter data (one row per house per timestamp)
CREATE TABLE IF NOT EXISTS twin_meter_data (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    house_id VARCHAR(50) NOT NULL,
    positive_active_power DECIMAL,
    negative_active_power DECIMAL,
    gas_kuub DECIMAL,
    tariff1_pos_energy DECIMAL,
    tariff2_pos_energy DECIMAL,
    tariff1_neg_energy DECIMAL,
    tariff2_neg_energy DECIMAL,
    current_tariff SMALLINT,
    phase_a_current DECIMAL,
    recorded_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(house_id, recorded_at)
);

CREATE INDEX IF NOT EXISTS idx_meter_data_house_time ON twin_meter_data(house_id, recorded_at DESC);

-- Appliance smart-plug data (one row per appliance per timestamp)
CREATE TABLE IF NOT EXISTS twin_appliance_data (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    house_id VARCHAR(50) NOT NULL,
    appliance_name VARCHAR(100) NOT NULL,
    active_power DECIMAL,
    current DECIMAL,
    voltage DECIMAL,
    total_active_energy DECIMAL,
    state VARCHAR(20),
    recorded_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(house_id, appliance_name, recorded_at)
);

CREATE INDEX IF NOT EXISTS idx_appliance_data_house_time ON twin_appliance_data(house_id, recorded_at DESC);

-- Water meter data (one row per house per timestamp)
CREATE TABLE IF NOT EXISTS twin_water_data (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    house_id VARCHAR(50) NOT NULL,
    pulse_count DECIMAL,
    humidity DECIMAL,
    temperature DECIMAL,
    recorded_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(house_id, recorded_at)
);

CREATE INDEX IF NOT EXISTS idx_water_data_house_time ON twin_water_data(house_id, recorded_at DESC);
