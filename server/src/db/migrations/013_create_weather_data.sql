CREATE TABLE IF NOT EXISTS weather_data (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    house_id VARCHAR(50) NOT NULL,
    temperature DECIMAL,
    recorded_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(house_id, recorded_at)
);
CREATE INDEX IF NOT EXISTS idx_weather_data_house_time ON weather_data(house_id, recorded_at DESC);

CREATE TABLE IF NOT EXISTS weather_data_hourly (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    house_id VARCHAR(50) NOT NULL,
    hour_bucket TIMESTAMPTZ NOT NULL,
    avg_temperature DECIMAL,
    sample_count INT NOT NULL DEFAULT 1,
    UNIQUE(house_id, hour_bucket)
);
CREATE INDEX IF NOT EXISTS idx_weather_hourly_house_time ON weather_data_hourly(house_id, hour_bucket DESC);
