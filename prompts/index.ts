/** Versiones activas de cada prompt. Para probar una versión nueva, cambiá el puntero acá. */
export { draftMessageV1 as draftMessagePrompt } from "./draft-message/v1";
export { researchProspectV1 as researchProspectPrompt } from "./research-prospect/v1";
export { promptRef } from "./types";
export type { DraftPromptContext } from "./draft-message/v1";
export type { ResearchPromptContext } from "./research-prospect/v1";
export type { CampaignContext, ProspectContext, WebsiteContext } from "./context";
