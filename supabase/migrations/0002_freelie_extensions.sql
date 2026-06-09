-- ============================================================
-- FREELIE EXTENSIONS — Investor Brief fields + compliance tables
-- ============================================================

-- Soft skills & personal traits on freelo_profiles
ALTER TABLE freelo_profiles
  ADD COLUMN IF NOT EXISTS soft_skills TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS personal_traits TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS learning_goals TEXT,
  ADD COLUMN IF NOT EXISTS availability_note TEXT,
  ADD COLUMN IF NOT EXISTS language_skills TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS education_status TEXT DEFAULT 'self_taught'
    CHECK (education_status IN ('studying', 'graduated', 'self_taught', 'bootcamp')),
  ADD COLUMN IF NOT EXISTS institution TEXT,
  ADD COLUMN IF NOT EXISTS graduation_year INTEGER,
  ADD COLUMN IF NOT EXISTS location TEXT,
  ADD COLUMN IF NOT EXISTS categories TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS hourly_rate_min NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS hourly_rate_max NUMERIC(10,2);

-- Argentina compliance fields on profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS cuit TEXT,
  ADD COLUMN IF NOT EXISTS cuit_verified BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS padic_status TEXT DEFAULT 'not_enrolled'
    CHECK (padic_status IN ('not_enrolled', 'active', 'suspended')),
  ADD COLUMN IF NOT EXISTS padic_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS monotributo_category TEXT,
  ADD COLUMN IF NOT EXISTS moderation_strikes INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_banned BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS ban_reason TEXT,
  ADD COLUMN IF NOT EXISTS total_contracts_completed INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS avg_rating NUMERIC(3,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_reviews INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS completion_rate NUMERIC(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS on_time_delivery_rate NUMERIC(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS monthly_matches_used INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS monthly_matches_reset_at DATE DEFAULT CURRENT_DATE,
  ADD COLUMN IF NOT EXISTS active_proposals_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS subscription_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS badges TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS age_verified BOOLEAN DEFAULT FALSE;

-- Freelier: featured projects, KYC enhancements
ALTER TABLE freelier_profiles
  ADD COLUMN IF NOT EXISTS company_size TEXT,
  ADD COLUMN IF NOT EXISTS industry TEXT,
  ADD COLUMN IF NOT EXISTS website_url TEXT,
  ADD COLUMN IF NOT EXISTS kyc_verified_at TIMESTAMPTZ;

-- Projects: more fields
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS category TEXT,
  ADD COLUMN IF NOT EXISTS deadline DATE,
  ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS ai_brief_completed BOOLEAN DEFAULT FALSE;

-- ============================================================
-- ANALYTICS EVENTS — KPI tracking from Day 1
-- ============================================================
CREATE TABLE IF NOT EXISTS analytics_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_name TEXT NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  properties JSONB DEFAULT '{}',
  gmv_amount NUMERIC(12,2),
  currency TEXT DEFAULT 'ARS',
  session_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_analytics_event_name ON analytics_events (event_name, created_at);
CREATE INDEX IF NOT EXISTS idx_analytics_user_id ON analytics_events (user_id, created_at);

-- ============================================================
-- USER REPORTS — App Store / Play Store compliance
-- ============================================================
CREATE TABLE IF NOT EXISTS user_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reporter_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  reported_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  chat_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
  message_id UUID REFERENCES messages(id) ON DELETE SET NULL,
  reason TEXT NOT NULL CHECK (reason IN ('spam', 'harassment', 'external_contact', 'fake_profile', 'other')),
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'reviewed', 'action_taken', 'dismissed')),
  reviewed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE user_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reports_insert_own" ON user_reports
  FOR INSERT WITH CHECK (auth.uid() = reporter_id);
CREATE POLICY "reports_read_own" ON user_reports
  FOR SELECT USING (auth.uid() = reporter_id);

-- ============================================================
-- WEBHOOK EVENTS LOG
-- ============================================================
CREATE TABLE IF NOT EXISTS webhook_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  processed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- V2 STUBS — structure ready, not activated
-- ============================================================
-- ai_agent_sessions: Brief Assistant + Autopilot (V2)
CREATE TABLE IF NOT EXISTS ai_agent_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  session_type TEXT NOT NULL CHECK (session_type IN ('brief_assistant', 'autopilot')),
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'pending',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- certificates: Coderhouse alliance (V2)
CREATE TABLE IF NOT EXISTS certificates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  issuer TEXT NOT NULL,
  course_name TEXT NOT NULL,
  issued_at DATE,
  certificate_url TEXT,
  verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- RLS for new tables
-- ============================================================
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "analytics_insert_own" ON analytics_events
  FOR INSERT WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

ALTER TABLE ai_agent_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ai_sessions_own" ON ai_agent_sessions
  FOR ALL USING (auth.uid() = user_id);

ALTER TABLE certificates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "certificates_read_public" ON certificates FOR SELECT USING (TRUE);
CREATE POLICY "certificates_insert_own" ON certificates
  FOR INSERT WITH CHECK (auth.uid() = user_id);
