export type ApiProvider = 'openai' | 'gemini-aistudio' | 'gemini-vertexai';

export interface GeminiVertexConfig {
    projectId: string;
    location: string; // e.g. 'us-central1'
}
