import { getClientConfig } from "../config/client";
import {
  ACCESS_CODE_PREFIX,
  Azure,
  ModelProvider,
  ServiceProvider,
} from "../constant";
import { Endpoint, ModelType, useAccessStore, useChatStore } from "../store";
import { ChatGPTApi } from "./platforms/openai";
import { GeminiProApi } from "./platforms/google";
export const ROLES = ["system", "user", "assistant"] as const;
export type MessageRole = (typeof ROLES)[number];

export const Models = ["gpt-3.5-turbo", "gpt-4"] as const;
export type ChatModel = ModelType;

export interface MultimodalContent {
  type: "text" | "image_url";
  text?: string;
  image_url?: {
    url: string;
  };
}

export interface RequestMessage {
  role: MessageRole;
  content: string | MultimodalContent[];
}

export interface LLMConfig {
  model: string;
  temperature?: number;
  top_p?: number;
  stream?: boolean;
  presence_penalty?: number;
  frequency_penalty?: number;
}

export interface ChatOptions {
  session_id: string;
  messages: RequestMessage[];
  config: LLMConfig;

  onUpdate?: (message: string, chunk: string) => void;
  onFinish: (message: string, statusCode: number) => void;
  onError?: (err: Error) => void;
  onController?: (controller: AbortController) => void;
}

export interface LLMUsage {
  used: number;
  total: number;
}

export interface LLMModel {
  name: string;
  available: boolean;
  provider: LLMModelProvider;
}

export interface LLMModelProvider {
  id: string;
  providerName: string;
  providerType: string;
}

export abstract class LLMApi {
  abstract chat(options: ChatOptions): Promise<void>;
  abstract usage(): Promise<LLMUsage>;
  abstract models(): Promise<LLMModel[]>;
}

type ProviderName = "openai" | "azure" | "claude" | "palm";

interface Model {
  name: string;
  provider: ProviderName;
  ctxlen: number;
}

interface ChatProvider {
  name: ProviderName;
  apiConfig: {
    baseUrl: string;
    apiKey: string;
    summaryModel: Model;
  };
  models: Model[];

  chat: () => void;
  usage: () => void;
}

export class ClientApi {
  public llm: LLMApi;

  constructor(provider: ModelProvider = ModelProvider.GPT, endpoint: Endpoint) {
    if (provider === ModelProvider.GeminiPro) {
      this.llm = new GeminiProApi(endpoint);
      return;
    }
    this.llm = new ChatGPTApi(endpoint);
  }

  config() {}

  prompts() {}

  masks() {}
}

export function getHeaders(endpoint?: Endpoint) {
  const accessStore = useAccessStore.getState();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "x-requested-with": "XMLHttpRequest",
    Accept: "application/json",
    "x-api-service": endpoint?.apiUrl || "",
    "x-api-provider": endpoint?.provider || "OpenAI",
    "x-api-version": endpoint?.apiVersion || "",
  };

  if (!!!endpoint) {
    return headers;
  }

  const modelConfig = useChatStore.getState().currentSession().mask.modelConfig;
  const isGoogle = modelConfig.model.startsWith("gemini");
  // const isAzure = accessStore.provider === ServiceProvider.Azure;
  const isAzure = endpoint?.provider === ServiceProvider.Azure;
  const authHeader = isAzure ? "api-key" : "Authorization";
  // const apiKey = isGoogle
  //   ? accessStore.googleApiKey
  //   : isAzure
  //   ? accessStore.azureApiKey
  //   : accessStore.openaiApiKey;
  const apiKey = endpoint?.apiKey || "";
  const clientConfig = getClientConfig();

  const makeBearer = (s: string) => `${isAzure ? "" : "Bearer "}${s.trim()}`;
  const validString = (x: string) => x && x.length > 0;

  // when using google api in app, not set auth header
  if (!(isGoogle && clientConfig?.isApp)) {
    // use user's api key first
    if (validString(apiKey)) {
      headers[authHeader] = makeBearer(apiKey);
    } else if (
      accessStore.enabledAccessControl() &&
      validString(accessStore.accessCode)
    ) {
      headers[authHeader] = makeBearer(
        ACCESS_CODE_PREFIX + accessStore.accessCode,
      );
    }
  }

  return headers;
}
