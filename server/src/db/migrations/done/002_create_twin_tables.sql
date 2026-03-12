CREATE TABLE IF NOT EXISTS twin_sensor_data (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    house_id VARCHAR(50) NOT NULL,
    room_name VARCHAR(255) NOT NULL,
    temperature DECIMAL,
    temperature_set DECIMAL,
    pir SMALLINT,
    recorded_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(house_id, room_name, recorded_at)
);

CREATE TABLE IF NOT EXISTS twin_predictions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    house_id VARCHAR(50) NOT NULL,
    prediction JSONB NOT NULL,
    predicted_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sensor_data_house_time ON twin_sensor_data(house_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_predictions_house_time ON twin_predictions(house_id, predicted_at DESC);
