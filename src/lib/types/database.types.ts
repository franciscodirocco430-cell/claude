export type UserRole = "freelo" | "freelier";
export type SubscriptionTier = "free" | "pro" | "elite";
export type ProjectStatus = "draft" | "open" | "in_progress" | "completed" | "cancelled";
export type MatchStatus = "pending" | "accepted" | "rejected" | "withdrawn";
export type MessageType = "text" | "proposal" | "system";
export type ProposalStatus = "pending" | "accepted" | "rejected" | "countered";
export type ContractStatus = "active" | "completed" | "disputed" | "cancelled";
export type EscrowStatus = "pending" | "held" | "released";
export type AvailabilityStatus = "available" | "busy" | "open_to_offers";

export interface Profile {
  id: string;
  email: string;
  role: UserRole;
  display_name: string | null;
  avatar_url: string | null;
  subscription_tier: SubscriptionTier;
  xp_score: number;
  onboarding_complete: boolean;
  created_at: string;
}

export interface FreeloProfile {
  id: string;
  skills: string[];
  portfolio_items: PortfolioItem[];
  hourly_rate: number | null;
  bio: string | null;
  availability: AvailabilityStatus;
  stack: string[];
}

export interface FreelierProfile {
  id: string;
  company_name: string | null;
  kyc_full_name: string | null;
  kyc_tax_id: string | null;
  kyc_verified: boolean;
}

export interface Project {
  id: string;
  freelier_id: string;
  title: string;
  description: string | null;
  required_skills: string[];
  budget_min: number | null;
  budget_max: number | null;
  status: ProjectStatus;
  ai_brief: Record<string, unknown>;
  created_at: string;
}

export interface Match {
  id: string;
  project_id: string;
  freelo_id: string;
  status: MatchStatus;
  created_at: string;
}

export interface Conversation {
  id: string;
  match_id: string;
  participant_a: string;
  participant_b: string;
  created_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  message_type: MessageType;
  is_moderated: boolean;
  moderation_reason: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface Proposal {
  id: string;
  conversation_id: string;
  freelo_id: string;
  amount: number;
  platform_fee: number;
  milestones: Milestone[];
  deliverables: string[];
  status: ProposalStatus;
  created_at: string;
}

export interface Contract {
  id: string;
  proposal_id: string;
  project_id: string;
  freelo_id: string;
  freelier_id: string;
  total_amount: number;
  platform_fee: number;
  status: ContractStatus;
  escrow_status: EscrowStatus;
  agreement_text: string | null;
  created_at: string;
  completed_at: string | null;
}

export interface Review {
  id: string;
  contract_id: string;
  reviewer_id: string;
  reviewee_id: string;
  rating: number;
  comment: string | null;
  xp_awarded: number;
  created_at: string;
}

export interface WebhookLog {
  id: string;
  event_type: string;
  payload: Record<string, unknown>;
  delivered_at: string;
}

export interface PortfolioItem {
  title: string;
  url: string;
  description?: string;
}

export interface Milestone {
  title: string;
  amount: number;
  due_date: string;
  status: "pending" | "in_progress" | "completed";
}

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: Omit<Profile, "created_at"> & { created_at?: string };
        Update: Partial<Omit<Profile, "id">>;
        Relationships: [];
      };
      freelo_profiles: {
        Row: FreeloProfile;
        Insert: Partial<FreeloProfile> & { id: string };
        Update: Partial<Omit<FreeloProfile, "id">>;
        Relationships: [];
      };
      freelier_profiles: {
        Row: FreelierProfile;
        Insert: Partial<FreelierProfile> & { id: string };
        Update: Partial<Omit<FreelierProfile, "id">>;
        Relationships: [];
      };
      projects: {
        Row: Project;
        Insert: Omit<Project, "id" | "created_at"> & { id?: string; created_at?: string };
        Update: Partial<Omit<Project, "id">>;
        Relationships: [];
      };
      matches: {
        Row: Match;
        Insert: Omit<Match, "id" | "created_at"> & { id?: string; created_at?: string };
        Update: Partial<Omit<Match, "id">>;
        Relationships: [];
      };
      conversations: {
        Row: Conversation;
        Insert: Omit<Conversation, "id" | "created_at"> & { id?: string; created_at?: string };
        Update: Partial<Omit<Conversation, "id">>;
        Relationships: [];
      };
      messages: {
        Row: Message;
        Insert: Omit<Message, "id" | "created_at"> & { id?: string; created_at?: string };
        Update: Partial<Omit<Message, "id">>;
        Relationships: [];
      };
      proposals: {
        Row: Proposal;
        Insert: Omit<Proposal, "id" | "created_at" | "platform_fee"> & { id?: string; created_at?: string };
        Update: Partial<Omit<Proposal, "id" | "platform_fee">>;
        Relationships: [];
      };
      contracts: {
        Row: Contract;
        Insert: Omit<Contract, "id" | "created_at"> & { id?: string; created_at?: string };
        Update: Partial<Omit<Contract, "id">>;
        Relationships: [];
      };
      reviews: {
        Row: Review;
        Insert: Omit<Review, "id" | "created_at"> & { id?: string; created_at?: string };
        Update: Partial<Omit<Review, "id">>;
        Relationships: [];
      };
      webhooks_log: {
        Row: WebhookLog;
        Insert: Omit<WebhookLog, "id" | "delivered_at"> & { id?: string; delivered_at?: string };
        Update: Partial<Omit<WebhookLog, "id">>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
