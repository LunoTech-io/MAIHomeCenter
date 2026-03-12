-- Migration 003: Create admins table and add organization column to houses

-- Add organization column to houses table
ALTER TABLE houses ADD COLUMN IF NOT EXISTS organization VARCHAR(100) NOT NULL DEFAULT 'ou';

-- Admins table for admin authentication
CREATE TABLE IF NOT EXISTS admins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    organization VARCHAR(100) NOT NULL DEFAULT 'ou',
    name VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admins_username ON admins(username);
CREATE INDEX IF NOT EXISTS idx_houses_organization ON houses(organization);
