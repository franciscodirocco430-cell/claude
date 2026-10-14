/** Datos de la campaña que reciben todos los prompts. */
export interface CampaignContext {
  name: string;
  niche: string;
  nicheReferences: string[];
  offer: string;
  icp: string;
  tone: string | null;
}

export interface ProspectContext {
  fullName: string | null;
  company: string | null;
  industry: string | null;
  website: string | null;
  notes: string | null;
  handles: { channel: string; handle: string | null }[];
}

export interface WebsiteContext {
  url: string;
  title: string | null;
  description: string | null;
  text: string;
}
