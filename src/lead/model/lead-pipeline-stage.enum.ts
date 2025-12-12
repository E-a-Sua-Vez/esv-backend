export enum LeadPipelineStage {
  NEW = 'NEW', // Leads without contact
  IN_CONTACT = 'IN_CONTACT', // Leads being contacted
  WAITLIST = 'WAITLIST', // Leads waiting (can be contacted again)
  IN_DEAL = 'IN_DEAL', // Leads in deal/negotiation
  CLOSED = 'CLOSED', // Leads finished (successful sale, rejected, maybe later)
  // Extensible: Can add more stages like QUALIFIED, PROPOSAL, NEGOTIATION, etc.
}
