import { getClientConfig } from "../config/client";
import {
  ACCESS_CODE_PREFIX,
  Azure,
  ModelProvider,
  ServiceProvider,
} from "../constant";
import { ChatMessage, ModelType, useAccessStore, useChatStore } from "../store";
import { ChatGPTApi } from "./platforms/openai";
import { GeminiProApi } from "./platforms/google";
export const ROLES = ["system", "user", "assistant"] as const;
export type MessageRole = (typeof ROLES)[number];

export const Models = ["gpt-3.5-turbo", "gpt-4"] as const;
export type ChatModel = ModelType;

export interface RequestMessage {
  role: MessageRole;
  content: string;
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
  messages: RequestMessage[];
  config: LLMConfig;

  onUpdate?: (message: string, chunk: string) => void;
  onFinish: (message: string) => void;
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

  constructor(provider: ModelProvider = ModelProvider.GPT) {
    if (provider === ModelProvider.GeminiPro) {
      this.llm = new GeminiProApi();
      return;
    }
    this.llm = new ChatGPTApi();
  }

  config() {}

  prompts() {}

  masks() {}

  async getGithubIssue(
    owner: string,
    repo: string,
    token: string,
    label: string,
  ) {
    const requestUrl = `/sharegithub/${owner}/${repo}?labels=${label}&state=open`;
    const res = await fetch(requestUrl, {
      headers: {
        Accept: "application/json",
        Authorization: "Bearer " + token,
        "X-GitHub-Api-Version": "2022-11-28",
      },
      method: "GET",
    });

    const resJson = await res.json();
    console.log("[GetShare]", resJson);
    if (resJson.length) {
      return {
        id: resJson[0].number,
        url: resJson[0].html_url,
      };
    }

    return {};
  }

  async shareToShareGPT(
    messages: ChatMessage[],
    avatarUrl: string | null = null,
  ) {
    const msgs = messages.map((m) => ({
      from: m.role === "user" ? "human" : "gpt",
      value: m.content,
    }));

    console.log("[Share]", messages, msgs);
    const clientConfig = getClientConfig();
    const proxyUrl = "/sharegpt";
    const rawUrl = "https://sharegpt.com/api/conversations";
    const shareUrl = clientConfig?.isApp ? rawUrl : proxyUrl;
    const res = await fetch(shareUrl, {
      body: JSON.stringify({
        avatarUrl,
        items: msgs,
      }),
      headers: {
        "Content-Type": "application/json",
      },
      method: "POST",
    });

    const resJson = await res.json();
    console.log("[Share]", resJson);
    if (resJson.id) {
      return `https://shareg.pt/${resJson.id}`;
    }
  }

  async createOrUpdateIssue(
    owner: string,
    repo: string,
    token: string,
    isn: string,
    session: any,
  ) {
    const messages: ChatMessage[] = session.messages;
    const sid = session.id;
    const title = session.topic;
    const content = messages
      .map((m) => `### ${m.role}\n${m.content.trim()}\n`)
      .join("\n");
    console.log("[ShareToGithub]", messages);

    const clientConfig = getClientConfig();
    const proxyUrl = "/sharegithub/xingty/assets";
    const rawUrl = `https://api.github.com/repos/${owner}/${repo}/issues`;
    let shareUrl = clientConfig?.isApp ? rawUrl : proxyUrl;
    const headers = {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: "Bearer " + token,
      "X-GitHub-Api-Version": "2022-11-28",
    };
    const body = JSON.stringify({
      title: title,
      body: content,
      labels: [sid],
    });
    let method = "POST";
    if (isn) {
      method = "PATCH";
      shareUrl = `${shareUrl}/${isn}`;
    }

    const res = await fetch(shareUrl, {
      body: body,
      headers: headers,
      method: method,
    });

    const resJson = await res.json();
    console.log("[Share]", resJson);
    if (resJson.html_url) {
      return resJson.html_url;
    }
  }
}

export function getHeaders() {
  const accessStore = useAccessStore.getState();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "x-requested-with": "XMLHttpRequest",
    Accept: "application/json",
  };
  const modelConfig = useChatStore.getState().currentSession().mask.modelConfig;
  const isGoogle = modelConfig.model === "gemini-pro";
  const isAzure = accessStore.provider === ServiceProvider.Azure;
  const authHeader = isAzure ? "api-key" : "Authorization";
  const apiKey = isGoogle
    ? accessStore.googleApiKey
    : isAzure
    ? accessStore.azureApiKey
    : accessStore.openaiApiKey;

  const makeBearer = (s: string) => `${isAzure ? "" : "Bearer "}${s.trim()}`;
  const validString = (x: string) => x && x.length > 0;

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

  return headers;
}
