export type GeminiAgent = "user" | "assistant";

export interface ChatGPTMessage {
  role: GeminiAgent;
  content: string;
  sources?: string[];
}