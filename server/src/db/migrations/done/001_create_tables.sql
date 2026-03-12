-- MAIHomeCenter Survey System Schema
-- Migration 001: Create all tables

-- Houses table for tenant authentication
CREATE TABLE IF NOT EXISTS houses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    house_id VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Survey question sets (molecules)
CREATE TABLE IF NOT EXISTS question_sets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    notification_title VARCHAR(255) NOT NULL,
    notification_body TEXT NOT NULL,
    notification_url VARCHAR(500),
    expires_at TIMESTAMP,
    is_dismissable BOOLEAN DEFAULT TRUE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Questions (atoms)
CREATE TABLE IF NOT EXISTS questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question_set_id UUID REFERENCES question_sets(id) ON DELETE CASCADE,
    identifier VARCHAR(100) NOT NULL,
    type VARCHAR(20) CHECK (type IN ('radio', 'open_text', 'display')),
    question_text TEXT NOT NULL,
    options JSONB,
    is_required BOOLEAN DEFAULT TRUE,
    order_index INTEGER DEFAULT 0,
    UNIQUE(question_set_id, identifier)
);

-- Subscriptions linked to houses
CREATE TABLE IF NOT EXISTS subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    house_id UUID REFERENCES houses(id) ON DELETE SET NULL,
    endpoint TEXT UNIQUE NOT NULL,
    keys JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Survey assignments
CREATE TABLE IF NOT EXISTS survey_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question_set_id UUID REFERENCES question_sets(id) ON DELETE CASCADE,
    house_id UUID REFERENCES houses(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'pending',
    notification_sent_at TIMESTAMP,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(question_set_id, house_id)
);

-- Survey responses
CREATE TABLE IF NOT EXISTS survey_responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assignment_id UUID REFERENCES survey_assignments(id) ON DELETE CASCADE,
    question_id UUID REFERENCES questions(id) ON DELETE CASCADE,
    response_value TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(assignment_id, question_id)
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_questions_question_set_id ON questions(question_set_id);
CREATE INDEX IF NOT EXISTS idx_survey_assignments_house_id ON survey_assignments(house_id);
CREATE INDEX IF NOT EXISTS idx_survey_assignments_question_set_id ON survey_assignments(question_set_id);
CREATE INDEX IF NOT EXISTS idx_survey_assignments_status ON survey_assignments(status);
CREATE INDEX IF NOT EXISTS idx_survey_responses_assignment_id ON survey_responses(assignment_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_house_id ON subscriptions(house_id);
