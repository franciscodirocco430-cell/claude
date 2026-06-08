-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- TABLES
-- ============================================================

-- Profiles (extends auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('freelo', 'freelier')),
  display_name TEXT,
  avatar_url TEXT,
  subscription_tier TEXT NOT NULL DEFAULT 'free' CHECK (subscription_tier IN ('free', 'pro', 'elite')),
  xp_score INTEGER NOT NULL DEFAULT 0,
  onboarding_complete BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Freelo (talent) extended profiles
CREATE TABLE IF NOT EXISTS freelo_profiles (
  id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  skills TEXT[] DEFAULT '{}',
  portfolio_items JSONB DEFAULT '[]',
  hourly_rate NUMERIC(10,2),
  bio TEXT,
  availability TEXT NOT NULL DEFAULT 'available' CHECK (availability IN ('available', 'busy', 'open_to_offers')),
  stack TEXT[] DEFAULT '{}'
);

-- Freelier (client) extended profiles
CREATE TABLE IF NOT EXISTS freelier_profiles (
  id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  company_name TEXT,
  kyc_full_name TEXT,
  kyc_tax_id TEXT,
  kyc_verified BOOLEAN NOT NULL DEFAULT false
);

-- Projects
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  freelier_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  required_skills TEXT[] DEFAULT '{}',
  budget_min NUMERIC(10,2),
  budget_max NUMERIC(10,2),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('draft', 'open', 'in_progress', 'completed', 'cancelled')),
  ai_brief JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Matches (freelo applies to project)
CREATE TABLE IF NOT EXISTS matches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  freelo_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'withdrawn')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (project_id, freelo_id)
);

-- Conversations
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  participant_a UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  participant_b UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Messages (server-only insert via service role)
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  message_type TEXT NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'proposal', 'system')),
  is_moderated BOOLEAN NOT NULL DEFAULT false,
  moderation_reason TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Proposals
CREATE TABLE IF NOT EXISTS proposals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  freelo_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  amount NUMERIC(10,2) NOT NULL,
  platform_fee NUMERIC(10,2) GENERATED ALWAYS AS (amount * 0.01) STORED,
  milestones JSONB NOT NULL DEFAULT '[]',
  deliverables JSONB NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'countered')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Contracts
CREATE TABLE IF NOT EXISTS contracts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  proposal_id UUID NOT NULL REFERENCES proposals(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  freelo_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  freelier_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  total_amount NUMERIC(10,2) NOT NULL,
  platform_fee NUMERIC(10,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'disputed', 'cancelled')),
  escrow_status TEXT NOT NULL DEFAULT 'pending' CHECK (escrow_status IN ('pending', 'held', 'released')),
  agreement_text TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Reviews
CREATE TABLE IF NOT EXISTS reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contract_id UUID NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  reviewer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reviewee_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  xp_awarded INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (contract_id, reviewer_id)
);

-- Webhooks log
CREATE TABLE IF NOT EXISTS webhooks_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}',
  delivered_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_projects_freelier_id ON projects(freelier_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_matches_project_id ON matches(project_id);
CREATE INDEX IF NOT EXISTS idx_matches_freelo_id ON matches(freelo_id);
CREATE INDEX IF NOT EXISTS idx_conversations_match_id ON conversations(match_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);
CREATE INDEX IF NOT EXISTS idx_proposals_conversation_id ON proposals(conversation_id);
CREATE INDEX IF NOT EXISTS idx_contracts_freelo_id ON contracts(freelo_id);
CREATE INDEX IF NOT EXISTS idx_contracts_freelier_id ON contracts(freelier_id);
CREATE INDEX IF NOT EXISTS idx_reviews_contract_id ON reviews(contract_id);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE freelo_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE freelier_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhooks_log ENABLE ROW LEVEL SECURITY;

-- profiles: readable by all, writable by owner
CREATE POLICY "profiles_select_all" ON profiles FOR SELECT USING (true);
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "profiles_insert_own" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- freelo_profiles: readable by all authenticated, writable by owner
CREATE POLICY "freelo_profiles_select" ON freelo_profiles FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "freelo_profiles_insert" ON freelo_profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "freelo_profiles_update" ON freelo_profiles FOR UPDATE USING (auth.uid() = id);

-- freelier_profiles: readable by all authenticated, writable by owner
CREATE POLICY "freelier_profiles_select" ON freelier_profiles FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "freelier_profiles_insert" ON freelier_profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "freelier_profiles_update" ON freelier_profiles FOR UPDATE USING (auth.uid() = id);

-- projects: readable by all authenticated, insertable/updatable by freelier owner
CREATE POLICY "projects_select" ON projects FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "projects_insert" ON projects FOR INSERT WITH CHECK (auth.uid() = freelier_id);
CREATE POLICY "projects_update" ON projects FOR UPDATE USING (auth.uid() = freelier_id);

-- matches: readable by project owner or freelo, insertable by authenticated freelos
CREATE POLICY "matches_select" ON matches FOR SELECT USING (
  freelo_id = auth.uid() OR
  project_id IN (SELECT id FROM projects WHERE freelier_id = auth.uid())
);
CREATE POLICY "matches_insert" ON matches FOR INSERT WITH CHECK (auth.uid() = freelo_id);
CREATE POLICY "matches_update" ON matches FOR UPDATE USING (
  project_id IN (SELECT id FROM projects WHERE freelier_id = auth.uid())
);

-- conversations: readable only by participants
CREATE POLICY "conversations_select" ON conversations FOR SELECT USING (
  participant_a = auth.uid() OR participant_b = auth.uid()
);
CREATE POLICY "conversations_insert" ON conversations FOR INSERT WITH CHECK (
  participant_a = auth.uid() OR participant_b = auth.uid()
);

-- messages: NO direct insert policy (server only), readable by conversation participants
CREATE POLICY "messages_select" ON messages FOR SELECT USING (
  conversation_id IN (
    SELECT id FROM conversations
    WHERE participant_a = auth.uid() OR participant_b = auth.uid()
  )
);
-- No INSERT policy: inserts only happen via service role key in /api/moderate-message

-- proposals: readable by conversation participants, insertable by freelo in conversation
CREATE POLICY "proposals_select" ON proposals FOR SELECT USING (
  conversation_id IN (
    SELECT id FROM conversations
    WHERE participant_a = auth.uid() OR participant_b = auth.uid()
  )
);
CREATE POLICY "proposals_insert" ON proposals FOR INSERT WITH CHECK (
  auth.uid() = freelo_id AND
  conversation_id IN (
    SELECT id FROM conversations
    WHERE participant_a = auth.uid() OR participant_b = auth.uid()
  )
);

-- contracts: readable by freelo_id or freelier_id
CREATE POLICY "contracts_select" ON contracts FOR SELECT USING (
  freelo_id = auth.uid() OR freelier_id = auth.uid()
);
CREATE POLICY "contracts_insert" ON contracts FOR INSERT WITH CHECK (
  freelo_id = auth.uid() OR freelier_id = auth.uid()
);

-- reviews: readable by all, insertable by contract participants
CREATE POLICY "reviews_select" ON reviews FOR SELECT USING (true);
CREATE POLICY "reviews_insert" ON reviews FOR INSERT WITH CHECK (
  auth.uid() = reviewer_id AND
  contract_id IN (
    SELECT id FROM contracts
    WHERE freelo_id = auth.uid() OR freelier_id = auth.uid()
  )
);

-- webhooks_log: no user access (service role only)
-- No policies = no access for regular users

-- ============================================================
-- FUNCTIONS
-- ============================================================

-- Auto-create profile on user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'role', 'freelo')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
