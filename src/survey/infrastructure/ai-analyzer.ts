export interface AiAnalyzerClient {
  analyzeCommentScore(message: string, method?: string, type?: string): Promise<any>;
  analyzeCommentEntities(message: string, method?: string, type?: string): Promise<any>;
}
