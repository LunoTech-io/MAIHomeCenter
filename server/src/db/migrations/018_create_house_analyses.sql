CREATE TABLE IF NOT EXISTS house_analyses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    house_id VARCHAR(50) NOT NULL,
    analysis TEXT NOT NULL,
    generated_by VARCHAR(100),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_house_analyses_house_id ON house_analyses(house_id, created_at DESC);
