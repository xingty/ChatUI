import {
  ApiPath,
  DEFAULT_API_HOST,
  ServiceProvider,
  StoreKey,
  ShareProvider,
  ServiceProxy,
  SYSTEM_ENDPOINT_ID,
} from "../constant";
import { getHeaders } from "../client/api";
import { getClientConfig } from "../config/client";
import { createPersistStore } from "../utils/store";
import { ensure } from "../utils/clone";
import { nanoid } from "nanoid";

let fetchState = 0; // 0 not fetch, 1 fetching, 2 done

const DEFAULT_OPENAI_URL =
  getClientConfig()?.buildMode === "export" ? DEFAULT_API_HOST : ApiPath.OpenAI;

const DEFAULT_ACCESS_STATE = {
  accessCode: "",
  useCustomConfig: false,

  provider: ServiceProvider.OpenAI,
  shareProvider: ShareProvider.ShareGPT,

  // openai
  openaiUrl: DEFAULT_OPENAI_URL,
  openaiApiKey: "",

  // azure
  azureUrl: "",
  azureApiKey: "",
  azureApiVersion: "2023-08-01-preview",

  // google ai studio
  googleUrl: "",
  googleApiKey: "",
  googleApiVersion: "v1",

  // server config
  needCode: true,
  hideUserApiKey: false,
  hideBalanceQuery: false,
  disableGPT4: false,
  disableFastLink: false,
  customModels: "",
  defaultProvider: "" as ServiceProvider,

  // share provider config
  githubOwner: "",
  githubRepo: "",
  githubToken: "",

  endpoints: [] as Endpoint[],
  defaultEndpoint: "",
};

export interface Endpoint {
  id: string;
  name: string;
  provider: ServiceProvider;
  apiUrl: string;
  proxyUrl: string;
  apiVersion: string;
  apiKey: string;
  models: string;
  createdAt: number;
  type: string;
}

export const createEndpoint = (provider: ServiceProvider) => {
  return {
    id: nanoid(),
    name: "",
    provider: provider,
    apiUrl: "",
    proxyUrl: ServiceProxy[provider] ?? "",
    apiVersion: "",
    apiKey: "",
    models: "",
    createdAt: 0,
    type: "user",
  };
};

export const useAccessStore = createPersistStore(
  { ...DEFAULT_ACCESS_STATE },

  (set, get) => ({
    enabledAccessControl() {
      this.fetch();

      return get().needCode;
    },

    isValidOpenAI() {
      return ensure(get(), ["openaiApiKey"]);
    },

    isValidAzure() {
      return ensure(get(), ["azureUrl", "azureApiKey", "azureApiVersion"]);
    },

    isValidGoogle() {
      return ensure(get(), ["googleApiKey"]);
    },

    isAuthorized() {
      this.fetch();

      // has token or has code or disabled access control
      return (
        this.isValidOpenAI() ||
        this.isValidAzure() ||
        this.isValidGoogle() ||
        !this.enabledAccessControl() ||
        (this.enabledAccessControl() && ensure(get(), ["accessCode"]))
      );
    },
    fetch() {
      if (fetchState > 0 || getClientConfig()?.buildMode === "export") return;
      fetchState = 1;
      fetch("/api/config", {
        method: "post",
        body: null,
        headers: {
          ...getHeaders(),
        },
      })
        .then((res) => res.json())
        .then((res: DangerConfig) => {
          console.log("[Config] got config from server", res);
          const endpoints = get().endpoints;
          const endpoint = createEndpoint(res.defaultProvider);
          endpoint.name = "System";
          endpoint.id = SYSTEM_ENDPOINT_ID;
          endpoint.apiVersion = res.defaultAPIVersion;
          endpoint.type = "system";

          const index = endpoints.findIndex((v) => v.id === SYSTEM_ENDPOINT_ID);
          if (index !== -1) {
            endpoints[index] = endpoint;
          } else {
            endpoints.push(endpoint);
          }

          set(() => ({
            ...res,
            endpoints,
          }));
        })
        .catch(() => {
          console.error("[Config] failed to fetch config");
        })
        .finally(() => {
          fetchState = 2;
        });
    },

    getEndpoint(id: string) {
      return get().endpoints.find((v) => v.id === id);
    },

    removeEndpoint(id: string) {
      const endpoints = get().endpoints;
      set(() => ({
        endpoints: endpoints.filter((v) => v.id !== id),
      }));
    },

    addEndpoint(endpoint: Endpoint) {
      const endpoints = get().endpoints;
      endpoints.push(endpoint);
      set(() => ({
        endpoints,
      }));
    },

    addOrUpdateEndpoint(endpoint: Endpoint) {
      const endpoints = get().endpoints;
      const index = endpoints.findIndex((v) => v.id === endpoint.id);
      if (index === -1) {
        endpoints.push(endpoint);
      } else {
        endpoints[index] = endpoint;
      }

      let defaultEndpoint = get().defaultEndpoint;
      const e = endpoints.find((v) => v.id === defaultEndpoint);
      if (!e) {
        defaultEndpoint = endpoints[0]?.id || endpoint.id;
      }

      set(() => ({
        endpoints,
        defaultEndpoint,
      }));
    },

    getDefaultEndpoint() {
      const id = get().defaultEndpoint;
      const endpoints = get().endpoints;
      const e = endpoints.find((v) => v.id === id);
      if (e) {
        return e;
      }

      return endpoints[0];
    },

    getEndpointOrDefault(endpointId: string) {
      const endpoints = get().endpoints;
      let endpoint = endpoints.find((e) => e.id === endpointId);
      if (!!!endpoint) {
        return this.getDefaultEndpoint();
      }

      return endpoint;
    },
  }),
  {
    name: StoreKey.Access,
    version: 2,
    migrate(persistedState, version) {
      if (version < 2) {
        const state = persistedState as {
          token: string;
          openaiApiKey: string;
          azureApiVersion: string;
          googleApiKey: string;
        };
        state.openaiApiKey = state.token;
        state.azureApiVersion = "2023-08-01-preview";
      }

      return persistedState as any;
    },
  },
);
