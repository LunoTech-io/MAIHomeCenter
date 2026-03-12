-- Hourly aggregate of room sensor data (downsampled from twin_sensor_data)
CREATE TABLE IF NOT EXISTS twin_sensor_data_hourly (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    house_id VARCHAR(50) NOT NULL,
    room_name VARCHAR(255) NOT NULL,
    hour_bucket TIMESTAMPTZ NOT NULL,
    avg_temperature DECIMAL,
    avg_temperature_set DECIMAL,
    max_pir SMALLINT,
    avg_humidity DECIMAL,
    avg_co2 DECIMAL,
    avg_light_level DECIMAL,
    avg_pressure DECIMAL,
    avg_tvoc DECIMAL,
    avg_valve_position DECIMAL,
    max_door_status SMALLINT,
    sample_count INT NOT NULL DEFAULT 1,
    UNIQUE(house_id, room_name, hour_bucket)
);

CREATE INDEX IF NOT EXISTS idx_sensor_hourly_house_time
  ON twin_sensor_data_hourly(house_id, hour_bucket DESC);

-- Hourly aggregate of meter data
CREATE TABLE IF NOT EXISTS twin_meter_data_hourly (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    house_id VARCHAR(50) NOT NULL,
    hour_bucket TIMESTAMPTZ NOT NULL,
    avg_positive_active_power DECIMAL,
    avg_negative_active_power DECIMAL,
    max_gas_kuub DECIMAL,
    max_tariff1_pos_energy DECIMAL,
    max_tariff2_pos_energy DECIMAL,
    max_tariff1_neg_energy DECIMAL,
    max_tariff2_neg_energy DECIMAL,
    last_current_tariff SMALLINT,
    avg_phase_a_current DECIMAL,
    sample_count INT NOT NULL DEFAULT 1,
    UNIQUE(house_id, hour_bucket)
);

CREATE INDEX IF NOT EXISTS idx_meter_hourly_house_time
  ON twin_meter_data_hourly(house_id, hour_bucket DESC);

-- Hourly aggregate of appliance data
CREATE TABLE IF NOT EXISTS twin_appliance_data_hourly (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    house_id VARCHAR(50) NOT NULL,
    appliance_name VARCHAR(100) NOT NULL,
    hour_bucket TIMESTAMPTZ NOT NULL,
    avg_active_power DECIMAL,
    avg_current DECIMAL,
    avg_voltage DECIMAL,
    max_total_active_energy DECIMAL,
    sample_count INT NOT NULL DEFAULT 1,
    UNIQUE(house_id, appliance_name, hour_bucket)
);

CREATE INDEX IF NOT EXISTS idx_appliance_hourly_house_time
  ON twin_appliance_data_hourly(house_id, hour_bucket DESC);

-- Hourly aggregate of water data
CREATE TABLE IF NOT EXISTS twin_water_data_hourly (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    house_id VARCHAR(50) NOT NULL,
    hour_bucket TIMESTAMPTZ NOT NULL,
    max_pulse_count DECIMAL,
    avg_humidity DECIMAL,
    avg_temperature DECIMAL,
    sample_count INT NOT NULL DEFAULT 1,
    UNIQUE(house_id, hour_bucket)
);

CREATE INDEX IF NOT EXISTS idx_water_hourly_house_time
  ON twin_water_data_hourly(house_id, hour_bucket DESC);
