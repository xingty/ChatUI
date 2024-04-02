import { useState, useEffect, useMemo } from "react";

import styles from "./settings.module.scss";

import ResetIcon from "../icons/reload.svg";
import AddIcon from "../icons/add.svg";
import CloseIcon from "../icons/close.svg";
import CopyIcon from "../icons/copy.svg";
import ClearIcon from "../icons/clear.svg";
import LoadingIcon from "../icons/three-dots.svg";
import EditIcon from "../icons/edit.svg";
import EyeIcon from "../icons/eye.svg";
import DownloadIcon from "../icons/download.svg";
import UploadIcon from "../icons/upload.svg";
import ConfigIcon from "../icons/config.svg";
import ConfirmIcon from "../icons/confirm.svg";

import ConnectionIcon from "../icons/connection.svg";
import CloudSuccessIcon from "../icons/cloud-success.svg";
import CloudFailIcon from "../icons/cloud-fail.svg";

import {
  Input,
  List,
  ListItem,
  Modal,
  PasswordInput,
  Popover,
  Select,
  showConfirm,
  showToast,
} from "./ui-lib";
import { ModelConfigList } from "./model-config";

import { IconButton } from "./button";
import {
  SubmitKey,
  useChatStore,
  Theme,
  useUpdateStore,
  useAccessStore,
  useAppConfig,
  ShareProviderType,
  ShareProvider,
} from "../store";

import Locale, {
  AllLangs,
  ALL_LANG_OPTIONS,
  changeLang,
  getLang,
} from "../locales";
import { copyToClipboard } from "../utils";
import Link from "next/link";
import {
  Path,
  RELEASE_URL,
  STORAGE_KEY,
  ServiceProvider,
  SlotID,
  UPDATE_URL,
  ServiceProxy,
  SYSTEM_SHARE_PROVIDER_ID,
} from "../constant";
import { Prompt, SearchService, usePromptStore } from "../store/prompt";
import { ErrorBoundary } from "./error";
import { InputRange } from "./input-range";
import { useNavigate } from "react-router-dom";
import { Avatar, AvatarPicker } from "./emoji";
import { getClientConfig } from "../config/client";
import { useSyncStore } from "../store/sync";
import { nanoid } from "nanoid";
import { useMaskStore } from "../store/mask";
import { ProviderType } from "../utils/cloud";
import { sendError } from "next/dist/server/api-utils";

function EditPromptModal(props: { id: string; onClose: () => void }) {
  const promptStore = usePromptStore();
  const prompt = promptStore.get(props.id);

  return prompt ? (
    <div className="modal-mask">
      <Modal
        title={Locale.Settings.Prompt.EditModal.Title}
        onClose={props.onClose}
        actions={[
          <IconButton
            key=""
            onClick={props.onClose}
            text={Locale.UI.Confirm}
            bordered
          />,
        ]}
      >
        <div className={styles["edit-prompt-modal"]}>
          <input
            type="text"
            value={prompt.title}
            readOnly={!prompt.isUser}
            className={styles["edit-prompt-title"]}
            onInput={(e) =>
              promptStore.updatePrompt(
                props.id,
                (prompt) => (prompt.title = e.currentTarget.value),
              )
            }
          ></input>
          <Input
            value={prompt.content}
            readOnly={!prompt.isUser}
            className={styles["edit-prompt-content"]}
            rows={10}
            onInput={(e) =>
              promptStore.updatePrompt(
                props.id,
                (prompt) => (prompt.content = e.currentTarget.value),
              )
            }
          ></Input>
        </div>
      </Modal>
    </div>
  ) : null;
}

function UserPromptModal(props: { onClose?: () => void }) {
  const promptStore = usePromptStore();
  const userPrompts = promptStore.getUserPrompts();
  const builtinPrompts = SearchService.builtinPrompts;
  const allPrompts = userPrompts.concat(builtinPrompts);
  const [searchInput, setSearchInput] = useState("");
  const [searchPrompts, setSearchPrompts] = useState<Prompt[]>([]);
  const prompts = searchInput.length > 0 ? searchPrompts : allPrompts;

  const [editingPromptId, setEditingPromptId] = useState<string>();

  useEffect(() => {
    if (searchInput.length > 0) {
      const searchResult = SearchService.search(searchInput);
      setSearchPrompts(searchResult);
    } else {
      setSearchPrompts([]);
    }
  }, [searchInput]);

  return (
    <div className="modal-mask">
      <Modal
        title={Locale.Settings.Prompt.Modal.Title}
        onClose={() => props.onClose?.()}
        actions={[
          <IconButton
            key="add"
            onClick={() => {
              const promptId = promptStore.add({
                id: nanoid(),
                createdAt: Date.now(),
                title: "Empty Prompt",
                content: "Empty Prompt Content",
              });
              setEditingPromptId(promptId);
            }}
            icon={<AddIcon />}
            bordered
            text={Locale.Settings.Prompt.Modal.Add}
          />,
        ]}
      >
        <div className={styles["user-prompt-modal"]}>
          <input
            type="text"
            className={styles["user-prompt-search"]}
            placeholder={Locale.Settings.Prompt.Modal.Search}
            value={searchInput}
            onInput={(e) => setSearchInput(e.currentTarget.value)}
          ></input>

          <div className={styles["user-prompt-list"]}>
            {prompts.map((v, _) => (
              <div className={styles["user-prompt-item"]} key={v.id ?? v.title}>
                <div className={styles["user-prompt-header"]}>
                  <div className={styles["user-prompt-title"]}>{v.title}</div>
                  <div className={styles["user-prompt-content"] + " one-line"}>
                    {v.content}
                  </div>
                </div>

                <div className={styles["user-prompt-buttons"]}>
                  {v.isUser && (
                    <IconButton
                      icon={<ClearIcon />}
                      className={styles["user-prompt-button"]}
                      onClick={() => promptStore.remove(v.id!)}
                    />
                  )}
                  {v.isUser ? (
                    <IconButton
                      icon={<EditIcon />}
                      className={styles["user-prompt-button"]}
                      onClick={() => setEditingPromptId(v.id)}
                    />
                  ) : (
                    <IconButton
                      icon={<EyeIcon />}
                      className={styles["user-prompt-button"]}
                      onClick={() => setEditingPromptId(v.id)}
                    />
                  )}
                  <IconButton
                    icon={<CopyIcon />}
                    className={styles["user-prompt-button"]}
                    onClick={() => copyToClipboard(v.content)}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </Modal>

      {editingPromptId !== undefined && (
        <EditPromptModal
          id={editingPromptId!}
          onClose={() => setEditingPromptId(undefined)}
        />
      )}
    </div>
  );
}

function EditEndpointModal(props: { id: string; onClose: () => void }) {
  const accessStore = useAccessStore();
  let initialEndpoint = accessStore.getEndpoint(props.id);
  if (!initialEndpoint) {
    initialEndpoint = {
      id: nanoid(),
      name: "",
      provider: ServiceProvider.OpenAI,
      proxyUrl: ServiceProxy[ServiceProvider.OpenAI],
      apiUrl: "",
      apiVersion: "",
      apiKey: "",
      models: "",
      createdAt: Date.now(),
      type: "user",
      genTitle: false,
    };
  }

  const [endpoint, setEndpoint] = useState(initialEndpoint);

  function handleConfirm(endpoint: any, close: () => void) {
    console.log(endpoint);
    accessStore.addOrUpdateEndpoint(endpoint);
    const keys = ["name", "apiUrl", "apiKey", "apiVersion"];
    for (const key of keys) {
      if (endpoint[key] === "") {
        showToast(`${key} cannot be empty!`);
        return;
      }
    }

    const url = endpoint.apiUrl;
    console.log(url);
    if (url.indexOf("http://") === -1 && url.indexOf("https://") === -1) {
      showToast("URL should start with http:// or https://");
      return;
    }

    close();
  }

  return (
    <div className="modal-mask">
      <Modal
        title="Endpoint"
        onClose={props.onClose}
        actions={[
          <IconButton
            key=""
            onClick={() => {
              handleConfirm(endpoint, props.onClose);
            }}
            text={Locale.UI.Confirm}
            bordered
          />,
        ]}
      >
        <List id="add-endpoint">
          <>
            <ListItem
              title={Locale.Settings.Access.Provider.Title}
              subTitle={Locale.Settings.Access.Provider.SubTitle}
            >
              <Select
                value={endpoint.provider}
                onChange={(e) => {
                  setEndpoint({
                    ...endpoint,
                    provider: e.target.value as ServiceProvider,
                    proxyUrl: ServiceProxy[e.target.value],
                  });
                }}
              >
                {Object.entries(ServiceProvider).map(([k, v]) => (
                  <option value={v} key={k}>
                    {k}
                  </option>
                ))}
              </Select>
            </ListItem>

            <>
              <ListItem
                title={Locale.Settings.Endpoint.Name.Title}
                subTitle={Locale.Settings.Endpoint.Name.SubTitle}
              >
                <input
                  type="text"
                  value={endpoint?.name}
                  placeholder={Locale.Settings.Endpoint.Name.SubTitle}
                  onChange={(e) =>
                    setEndpoint({
                      ...endpoint,
                      name: e.currentTarget.value,
                    })
                  }
                ></input>
              </ListItem>
              <ListItem
                title={Locale.Settings.Endpoint.Url.Title}
                subTitle={Locale.Settings.Endpoint.Url.SubTitle}
              >
                <input
                  type="text"
                  value={endpoint.apiUrl}
                  placeholder=""
                  onChange={(e) =>
                    setEndpoint({
                      ...endpoint,
                      apiUrl: e.currentTarget.value,
                    })
                  }
                ></input>
              </ListItem>
              <ListItem
                title={Locale.Settings.Endpoint.Key.Title}
                subTitle={Locale.Settings.Endpoint.Key.SubTitle}
              >
                <PasswordInput
                  value={endpoint.apiKey}
                  type="text"
                  placeholder={Locale.Settings.Endpoint.Key.SubTitle}
                  onChange={(e) => {
                    setEndpoint({
                      ...endpoint,
                      apiKey: e.currentTarget.value,
                    });
                  }}
                />
              </ListItem>
              <ListItem
                title={Locale.Settings.Endpoint.Version.Title}
                subTitle={Locale.Settings.Endpoint.Version.SubTitle}
              >
                <input
                  type="text"
                  value={endpoint.apiVersion}
                  placeholder="eg: v1, 2023-08-01-preview"
                  onChange={(e) =>
                    setEndpoint({
                      ...endpoint,
                      apiVersion: e.currentTarget.value,
                    })
                  }
                ></input>
              </ListItem>
              <ListItem
                title="Generate title"
                subTitle="Will be used to generate conversation titles"
              >
                <input
                  type="checkbox"
                  checked={endpoint?.genTitle}
                  onChange={(e) =>
                    setEndpoint({
                      ...endpoint,
                      genTitle: e.currentTarget.checked,
                    })
                  }
                ></input>
              </ListItem>
            </>
          </>
        </List>
      </Modal>
    </div>
  );
}

function EndpointPromptModal(props: { onClose?: () => void }) {
  const accessStore = useAccessStore();
  const endpoints = accessStore.endpoints;

  const [editingEndpointId, setEditingEndpointId] = useState<string>();

  return (
    <div className="modal-mask">
      <Modal
        title={Locale.Settings.Endpoint.List.Title}
        onClose={() => props.onClose?.()}
        actions={[
          <IconButton
            key="add"
            onClick={() => {
              setEditingEndpointId("");
            }}
            icon={<AddIcon />}
            bordered
            text={Locale.Settings.Prompt.Modal.Add}
          />,
        ]}
      >
        <div className={styles["user-prompt-modal"]}>
          <div className={styles["user-prompt-list"]}>
            {endpoints.map((v, _) => (
              <div
                className={styles["user-prompt-item"]}
                key={v.id ?? v.provider}
              >
                <div className={styles["user-prompt-header"]}>
                  <div className={styles["user-prompt-title"]}>
                    {v.name} | {v.provider}
                  </div>
                  <div className={styles["user-prompt-content"] + " one-line"}>
                    {`URL: ${v.apiUrl || "System Detect"}`}
                  </div>
                </div>

                {v.type === "user" ? (
                  <div className={styles["user-prompt-buttons"]}>
                    <IconButton
                      icon={<ClearIcon />}
                      className={styles["user-prompt-button"]}
                      onClick={() => accessStore.removeEndpoint(v.id!)}
                    />
                    <IconButton
                      icon={<EditIcon />}
                      className={styles["user-prompt-button"]}
                      onClick={() => setEditingEndpointId(v.id)}
                    />
                    <IconButton
                      icon={<EyeIcon />}
                      className={styles["user-prompt-button"]}
                      onClick={() => setEditingEndpointId(v.id)}
                    />
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      </Modal>

      {editingEndpointId !== undefined && (
        <EditEndpointModal
          id={editingEndpointId!}
          onClose={() => setEditingEndpointId(undefined)}
        />
      )}
    </div>
  );
}

function EditSharedModal(props: { id: string; onClose: () => void }) {
  const accessStore = useAccessStore();
  let initState = {
    id: nanoid(),
    name: "",
    type: ShareProviderType.ShareGPT,
    githubOwner: "",
    githubRepo: "",
    githubToken: "",
    createAt: Date.now(),
  };

  let provider = accessStore.getShareProvider(props.id);
  if (provider) {
    initState.name = provider.name;
    initState.type = provider.type;
    initState.id = provider.id;
    initState.createAt = provider.createdAt;
    if (provider.type === ShareProviderType.Github) {
      initState.githubOwner = provider.params.githubOwner;
      initState.githubRepo = provider.params.githubRepo;
      initState.githubToken = provider.params.githubToken;
    }
  }

  const [shareState, setShareState] = useState(initState);

  function handleShareConfirm(currentState: any, close: () => void) {
    console.log(currentState);
    const keys = ["name"];
    let provider: ShareProvider = {
      id: currentState.id,
      name: currentState.name,
      type: currentState.type,
      params: {},
      createdAt: currentState.createdAt,
    };

    if (currentState.type === ShareProviderType.Github) {
      provider.params = {
        githubOwner: currentState.githubOwner,
        githubRepo: currentState.githubRepo,
        githubToken: currentState.githubToken,
      };
      keys.push("githubOwner", "githubRepo", "githubToken");
    }

    console.log(provider);
    for (const key of keys) {
      if (currentState[key] === "") {
        showToast(`${key} cannot be empty!`);
        return;
      }
    }

    const exist = accessStore.getShareProvider(currentState.id);
    if (exist) {
      accessStore.updateShareProvider(provider);
    } else {
      accessStore.addShareProvider(provider);
    }

    if (!accessStore.defaultShareProviderId) {
      accessStore.update((v) => (v.defaultShareProviderId = provider.id));
    }

    close();
  }

  return (
    <div className="modal-mask">
      <Modal
        title="Share Provider"
        onClose={props.onClose}
        actions={[
          <IconButton
            key=""
            onClick={() => {
              handleShareConfirm(shareState, props.onClose);
            }}
            text={Locale.UI.Confirm}
            bordered
          />,
        ]}
      >
        <List id="add-share-provider">
          <>
            <ListItem
              title={Locale.Settings.Share.Provider.Name.Title}
              subTitle={Locale.Settings.Share.Provider.Name.SubTitle}
            >
              <input
                type="text"
                value={shareState?.name}
                placeholder={Locale.Settings.Share.Provider.Name.SubTitle}
                onChange={(e) =>
                  setShareState({
                    ...shareState,
                    name: e.currentTarget.value,
                  })
                }
              ></input>
            </ListItem>

            <ListItem
              title={Locale.Settings.Share.Provider.Title}
              subTitle={Locale.Settings.Share.Provider.SubTitle}
            >
              <Select
                value={shareState.type}
                onChange={(e) => {
                  setShareState({
                    ...shareState,
                    type: e.target.value as ShareProviderType,
                  });
                }}
              >
                {Object.entries(ShareProviderType).map(([k, v]) => (
                  <option value={v} key={k}>
                    {k}
                  </option>
                ))}
              </Select>
            </ListItem>

            {shareState.type === "Github" ? (
              <>
                <ListItem
                  title={Locale.Settings.Share.Github.Owner.Title}
                  subTitle={Locale.Settings.Share.Github.Owner.SubTitle}
                >
                  <input
                    type="text"
                    value={shareState.githubOwner}
                    placeholder="owner"
                    onChange={(e) =>
                      setShareState({
                        ...shareState,
                        githubOwner: e.currentTarget.value,
                      })
                    }
                  ></input>
                </ListItem>

                <ListItem
                  title={Locale.Settings.Share.Github.Repo.Title}
                  subTitle={Locale.Settings.Share.Github.Repo.SubTitle}
                >
                  <input
                    type="text"
                    value={shareState.githubRepo}
                    placeholder="repository"
                    onChange={(e) =>
                      setShareState({
                        ...shareState,
                        githubRepo: e.currentTarget.value,
                      })
                    }
                  ></input>
                </ListItem>

                <ListItem
                  title={Locale.Settings.Share.Github.Token.Title}
                  subTitle={Locale.Settings.Share.Github.Token.SubTitle}
                >
                  <PasswordInput
                    value={shareState.githubToken}
                    type="text"
                    placeholder="token"
                    onChange={(e) => {
                      setShareState({
                        ...shareState,
                        githubToken: e.currentTarget.value,
                      });
                    }}
                  />
                </ListItem>
              </>
            ) : (
              <></>
            )}
          </>
        </List>
      </Modal>
    </div>
  );
}

function DangerItems() {
  const chatStore = useChatStore();
  const appConfig = useAppConfig();

  return (
    <List>
      <ListItem
        title={Locale.Settings.Danger.Reset.Title}
        subTitle={Locale.Settings.Danger.Reset.SubTitle}
      >
        <IconButton
          text={Locale.Settings.Danger.Reset.Action}
          onClick={async () => {
            if (await showConfirm(Locale.Settings.Danger.Reset.Confirm)) {
              appConfig.reset();
            }
          }}
          type="danger"
        />
      </ListItem>
      <ListItem
        title={Locale.Settings.Danger.Clear.Title}
        subTitle={Locale.Settings.Danger.Clear.SubTitle}
      >
        <IconButton
          text={Locale.Settings.Danger.Clear.Action}
          onClick={async () => {
            if (await showConfirm(Locale.Settings.Danger.Clear.Confirm)) {
              chatStore.clearAllData();
            }
          }}
          type="danger"
        />
      </ListItem>
    </List>
  );
}

function CheckButton() {
  const syncStore = useSyncStore();

  const couldCheck = useMemo(() => {
    return syncStore.cloudSync();
  }, [syncStore]);

  const [checkState, setCheckState] = useState<
    "none" | "checking" | "success" | "failed"
  >("none");

  async function check() {
    setCheckState("checking");
    const valid = await syncStore.check();
    setCheckState(valid ? "success" : "failed");
  }

  if (!couldCheck) return null;

  return (
    <IconButton
      text={Locale.Settings.Sync.Config.Modal.Check}
      bordered
      onClick={check}
      icon={
        checkState === "none" ? (
          <ConnectionIcon />
        ) : checkState === "checking" ? (
          <LoadingIcon />
        ) : checkState === "success" ? (
          <CloudSuccessIcon />
        ) : checkState === "failed" ? (
          <CloudFailIcon />
        ) : (
          <ConnectionIcon />
        )
      }
    ></IconButton>
  );
}

function SyncConfigModal(props: { onClose?: () => void }) {
  const syncStore = useSyncStore();

  return (
    <div className="modal-mask">
      <Modal
        title={Locale.Settings.Sync.Config.Modal.Title}
        onClose={() => props.onClose?.()}
        actions={[
          <CheckButton key="check" />,
          <IconButton
            key="confirm"
            onClick={props.onClose}
            icon={<ConfirmIcon />}
            bordered
            text={Locale.UI.Confirm}
          />,
        ]}
      >
        <List>
          <ListItem
            title={Locale.Settings.Sync.Config.SyncType.Title}
            subTitle={Locale.Settings.Sync.Config.SyncType.SubTitle}
          >
            <select
              value={syncStore.provider}
              onChange={(e) => {
                syncStore.update(
                  (config) =>
                    (config.provider = e.target.value as ProviderType),
                );
              }}
            >
              {Object.entries(ProviderType).map(([k, v]) => (
                <option value={v} key={k}>
                  {k}
                </option>
              ))}
            </select>
          </ListItem>

          <ListItem
            title={Locale.Settings.Sync.Config.Proxy.Title}
            subTitle={Locale.Settings.Sync.Config.Proxy.SubTitle}
          >
            <input
              type="checkbox"
              checked={syncStore.useProxy}
              onChange={(e) => {
                syncStore.update(
                  (config) => (config.useProxy = e.currentTarget.checked),
                );
              }}
            ></input>
          </ListItem>
          {syncStore.useProxy ? (
            <ListItem
              title={Locale.Settings.Sync.Config.ProxyUrl.Title}
              subTitle={Locale.Settings.Sync.Config.ProxyUrl.SubTitle}
            >
              <input
                type="text"
                value={syncStore.proxyUrl}
                onChange={(e) => {
                  syncStore.update(
                    (config) => (config.proxyUrl = e.currentTarget.value),
                  );
                }}
              ></input>
            </ListItem>
          ) : null}
        </List>

        {syncStore.provider === ProviderType.WebDAV && (
          <>
            <List>
              <ListItem title={Locale.Settings.Sync.Config.WebDav.Endpoint}>
                <input
                  type="text"
                  value={syncStore.webdav.endpoint}
                  onChange={(e) => {
                    syncStore.update(
                      (config) =>
                        (config.webdav.endpoint = e.currentTarget.value),
                    );
                  }}
                ></input>
              </ListItem>

              <ListItem title={Locale.Settings.Sync.Config.WebDav.UserName}>
                <input
                  type="text"
                  value={syncStore.webdav.username}
                  onChange={(e) => {
                    syncStore.update(
                      (config) =>
                        (config.webdav.username = e.currentTarget.value),
                    );
                  }}
                ></input>
              </ListItem>
              <ListItem title={Locale.Settings.Sync.Config.WebDav.Password}>
                <PasswordInput
                  value={syncStore.webdav.password}
                  onChange={(e) => {
                    syncStore.update(
                      (config) =>
                        (config.webdav.password = e.currentTarget.value),
                    );
                  }}
                ></PasswordInput>
              </ListItem>
            </List>
          </>
        )}

        {syncStore.provider === ProviderType.UpStash && (
          <List>
            <ListItem title={Locale.Settings.Sync.Config.UpStash.Endpoint}>
              <input
                type="text"
                value={syncStore.upstash.endpoint}
                onChange={(e) => {
                  syncStore.update(
                    (config) =>
                      (config.upstash.endpoint = e.currentTarget.value),
                  );
                }}
              ></input>
            </ListItem>

            <ListItem title={Locale.Settings.Sync.Config.UpStash.UserName}>
              <input
                type="text"
                value={syncStore.upstash.username}
                placeholder={STORAGE_KEY}
                onChange={(e) => {
                  syncStore.update(
                    (config) =>
                      (config.upstash.username = e.currentTarget.value),
                  );
                }}
              ></input>
            </ListItem>
            <ListItem title={Locale.Settings.Sync.Config.UpStash.Password}>
              <PasswordInput
                value={syncStore.upstash.apiKey}
                onChange={(e) => {
                  syncStore.update(
                    (config) => (config.upstash.apiKey = e.currentTarget.value),
                  );
                }}
              ></PasswordInput>
            </ListItem>
          </List>
        )}
      </Modal>
    </div>
  );
}

function SyncItems() {
  const syncStore = useSyncStore();
  const chatStore = useChatStore();
  const promptStore = usePromptStore();
  const maskStore = useMaskStore();
  const couldSync = useMemo(() => {
    return syncStore.cloudSync();
  }, [syncStore]);

  const [showSyncConfigModal, setShowSyncConfigModal] = useState(false);

  const stateOverview = useMemo(() => {
    const sessions = chatStore.sessions;
    const messageCount = sessions.reduce((p, c) => p + c.messages.length, 0);

    return {
      chat: sessions.length,
      message: messageCount,
      prompt: Object.keys(promptStore.prompts).length,
      mask: Object.keys(maskStore.masks).length,
    };
  }, [chatStore.sessions, maskStore.masks, promptStore.prompts]);

  return (
    <>
      <List>
        <ListItem
          title={Locale.Settings.Sync.CloudState}
          subTitle={
            syncStore.lastProvider
              ? `${new Date(syncStore.lastSyncTime).toLocaleString()} [${
                  syncStore.lastProvider
                }]`
              : Locale.Settings.Sync.NotSyncYet
          }
        >
          <div style={{ display: "flex" }}>
            <IconButton
              icon={<ConfigIcon />}
              text={Locale.UI.Config}
              onClick={() => {
                setShowSyncConfigModal(true);
              }}
            />
            {couldSync && (
              <IconButton
                icon={<ResetIcon />}
                text={Locale.UI.Sync}
                onClick={async () => {
                  try {
                    await syncStore.sync();
                    showToast(Locale.Settings.Sync.Success);
                  } catch (e) {
                    showToast(Locale.Settings.Sync.Fail);
                    console.error("[Sync]", e);
                  }
                }}
              />
            )}
          </div>
        </ListItem>

        <ListItem
          title={Locale.Settings.Sync.LocalState}
          subTitle={Locale.Settings.Sync.Overview(stateOverview)}
        >
          <div style={{ display: "flex" }}>
            <IconButton
              icon={<UploadIcon />}
              text={Locale.UI.Export}
              onClick={() => {
                syncStore.export();
              }}
            />
            <IconButton
              icon={<DownloadIcon />}
              text={Locale.UI.Import}
              onClick={() => {
                syncStore.import();
              }}
            />
          </div>
        </ListItem>
      </List>

      {showSyncConfigModal && (
        <SyncConfigModal onClose={() => setShowSyncConfigModal(false)} />
      )}
    </>
  );
}

export function Settings() {
  const navigate = useNavigate();
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const config = useAppConfig();
  const updateConfig = config.update;

  const updateStore = useUpdateStore();
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const currentVersion = updateStore.formatVersion(updateStore.version);
  const remoteId = updateStore.formatVersion(updateStore.remoteVersion);
  const hasNewVersion = currentVersion !== remoteId;
  const updateUrl = getClientConfig()?.isApp ? RELEASE_URL : UPDATE_URL;

  function checkUpdate(force = false) {
    setCheckingUpdate(true);
    updateStore.getLatestVersion(force).then(() => {
      setCheckingUpdate(false);
    });

    console.log("[Update] local version ", updateStore.version);
    console.log("[Update] remote version ", updateStore.remoteVersion);
  }

  const accessStore = useAccessStore();
  const enabledAccessControl = useMemo(
    () => accessStore.enabledAccessControl(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  console.log("[Default provider system id]", nanoid());

  const promptStore = usePromptStore();
  const builtinCount = SearchService.count.builtin;
  const customCount = promptStore.getUserPrompts().length ?? 0;
  const [shouldShowPromptModal, setShowPromptModal] = useState(false);
  const [shouldShowEndpointModal, setShowEndpointModal] = useState(false);
  const [editingProviderId, setEditingProviderId] = useState<string>();

  // const showUsage = accessStore.isAuthorized();
  useEffect(() => {
    // checks per minutes
    checkUpdate();
    // showUsage && checkUsage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const keydownEvent = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        navigate(Path.Home);
      }
    };
    if (clientConfig?.isApp) {
      // Force to set custom endpoint to true if it's app
      accessStore.update((state) => {
        state.useCustomConfig = true;
      });
    }
    document.addEventListener("keydown", keydownEvent);
    return () => {
      document.removeEventListener("keydown", keydownEvent);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const clientConfig = useMemo(() => getClientConfig(), []);
  const showAccessCode = enabledAccessControl && !clientConfig?.isApp;

  return (
    <ErrorBoundary>
      <div className="window-header" data-tauri-drag-region>
        <div className="window-header-title">
          <div className="window-header-main-title">
            {Locale.Settings.Title}
          </div>
          <div className="window-header-sub-title">
            {Locale.Settings.SubTitle}
          </div>
        </div>
        <div className="window-actions">
          <div className="window-action-button"></div>
          <div className="window-action-button"></div>
          <div className="window-action-button">
            <IconButton
              icon={<CloseIcon />}
              onClick={() => navigate(Path.Home)}
              bordered
            />
          </div>
        </div>
      </div>
      <div className={styles["settings"]}>
        <List>
          {showAccessCode && (
            <ListItem
              title={Locale.Settings.Access.AccessCode.Title}
              subTitle={Locale.Settings.Access.AccessCode.SubTitle}
            >
              <PasswordInput
                value={accessStore.accessCode}
                type="text"
                placeholder={Locale.Settings.Access.AccessCode.Placeholder}
                onChange={(e) => {
                  accessStore.update(
                    (access) => (access.accessCode = e.currentTarget.value),
                  );
                }}
              />
            </ListItem>
          )}

          <ListItem title={Locale.Settings.Avatar}>
            <Popover
              onClose={() => setShowEmojiPicker(false)}
              content={
                <AvatarPicker
                  onEmojiClick={(avatar: string) => {
                    updateConfig((config) => (config.avatar = avatar));
                    setShowEmojiPicker(false);
                  }}
                />
              }
              open={showEmojiPicker}
            >
              <div
                className={styles.avatar}
                onClick={() => {
                  setShowEmojiPicker(!showEmojiPicker);
                }}
              >
                <Avatar avatar={config.avatar} />
              </div>
            </Popover>
          </ListItem>

          <ListItem
            title={Locale.Settings.Update.Version(currentVersion ?? "unknown")}
            subTitle={
              checkingUpdate
                ? Locale.Settings.Update.IsChecking
                : hasNewVersion
                ? Locale.Settings.Update.FoundUpdate(remoteId ?? "ERROR")
                : Locale.Settings.Update.IsLatest
            }
          >
            {checkingUpdate ? (
              <LoadingIcon />
            ) : hasNewVersion ? (
              <Link href={updateUrl} target="_blank" className="link">
                {Locale.Settings.Update.GoToUpdate}
              </Link>
            ) : (
              <IconButton
                icon={<ResetIcon></ResetIcon>}
                text={Locale.Settings.Update.CheckUpdate}
                onClick={() => checkUpdate(true)}
              />
            )}
          </ListItem>

          <ListItem title={Locale.Settings.SendKey}>
            <Select
              value={config.submitKey}
              onChange={(e) => {
                updateConfig(
                  (config) =>
                    (config.submitKey = e.target.value as any as SubmitKey),
                );
              }}
            >
              {Object.values(SubmitKey).map((v) => (
                <option value={v} key={v}>
                  {v}
                </option>
              ))}
            </Select>
          </ListItem>

          <ListItem title={Locale.Settings.Theme}>
            <Select
              value={config.theme}
              onChange={(e) => {
                updateConfig(
                  (config) => (config.theme = e.target.value as any as Theme),
                );
              }}
            >
              {Object.values(Theme).map((v) => (
                <option value={v} key={v}>
                  {v}
                </option>
              ))}
            </Select>
          </ListItem>

          <ListItem title={Locale.Settings.Lang.Name}>
            <Select
              value={getLang()}
              onChange={(e) => {
                changeLang(e.target.value as any);
              }}
            >
              {AllLangs.map((lang) => (
                <option value={lang} key={lang}>
                  {ALL_LANG_OPTIONS[lang]}
                </option>
              ))}
            </Select>
          </ListItem>

          <ListItem
            title={Locale.Settings.FontSize.Title}
            subTitle={Locale.Settings.FontSize.SubTitle}
          >
            <InputRange
              title={`${config.fontSize ?? 14}px`}
              value={config.fontSize}
              min="12"
              max="40"
              step="1"
              onChange={(e) =>
                updateConfig(
                  (config) =>
                    (config.fontSize = Number.parseInt(e.currentTarget.value)),
                )
              }
            ></InputRange>
          </ListItem>

          <ListItem
            title={Locale.Settings.AutoGenerateTitle.Title}
            subTitle={Locale.Settings.AutoGenerateTitle.SubTitle}
          >
            <input
              type="checkbox"
              checked={config.enableAutoGenerateTitle}
              onChange={(e) =>
                updateConfig(
                  (config) =>
                    (config.enableAutoGenerateTitle = e.currentTarget.checked),
                )
              }
            ></input>
          </ListItem>

          <ListItem
            title={Locale.Settings.SendPreviewBubble.Title}
            subTitle={Locale.Settings.SendPreviewBubble.SubTitle}
          >
            <input
              type="checkbox"
              checked={config.sendPreviewBubble}
              onChange={(e) =>
                updateConfig(
                  (config) =>
                    (config.sendPreviewBubble = e.currentTarget.checked),
                )
              }
            ></input>
          </ListItem>
        </List>

        <SyncItems />

        <List>
          <ListItem
            title={Locale.Settings.Mask.Splash.Title}
            subTitle={Locale.Settings.Mask.Splash.SubTitle}
          >
            <input
              type="checkbox"
              checked={!config.dontShowMaskSplashScreen}
              onChange={(e) =>
                updateConfig(
                  (config) =>
                    (config.dontShowMaskSplashScreen =
                      !e.currentTarget.checked),
                )
              }
            ></input>
          </ListItem>

          <ListItem
            title={Locale.Settings.Mask.Builtin.Title}
            subTitle={Locale.Settings.Mask.Builtin.SubTitle}
          >
            <input
              type="checkbox"
              checked={config.hideBuiltinMasks}
              onChange={(e) =>
                updateConfig(
                  (config) =>
                    (config.hideBuiltinMasks = e.currentTarget.checked),
                )
              }
            ></input>
          </ListItem>
        </List>

        <List>
          <ListItem
            title={Locale.Settings.Prompt.Disable.Title}
            subTitle={Locale.Settings.Prompt.Disable.SubTitle}
          >
            <input
              type="checkbox"
              checked={config.disablePromptHint}
              onChange={(e) =>
                updateConfig(
                  (config) =>
                    (config.disablePromptHint = e.currentTarget.checked),
                )
              }
            ></input>
          </ListItem>

          <ListItem
            title={Locale.Settings.Prompt.List}
            subTitle={Locale.Settings.Prompt.ListCount(
              builtinCount,
              customCount,
            )}
          >
            <IconButton
              icon={<EditIcon />}
              text={Locale.Settings.Prompt.Edit}
              onClick={() => setShowPromptModal(true)}
            />
          </ListItem>
        </List>

        <List>
          {!accessStore.hideUserApiKey && (
            <>
              {
                // Conditionally render the following ListItem based on clientConfig.isApp
                !clientConfig?.isApp && ( // only show if isApp is false
                  <ListItem
                    title={Locale.Settings.Endpoint.Title}
                    subTitle={Locale.Settings.Endpoint.SubTitle}
                  >
                    <IconButton
                      icon={<AddIcon />}
                      text={Locale.Settings.Button.Add}
                      onClick={() => setShowEndpointModal(true)}
                    />
                  </ListItem>
                )
              }

              <ListItem
                title={Locale.Settings.Endpoint.Default.Title}
                subTitle={Locale.Settings.Endpoint.Default.Subtitle}
              >
                <Select
                  value={accessStore.defaultEndpoint}
                  onChange={(e) => {
                    console.log("[Default Endpoint]", e.target.value);
                    accessStore.update(
                      (access) => (access.defaultEndpoint = e.target.value),
                    );
                  }}
                >
                  {accessStore.endpoints.map((v) => (
                    <option value={v.id} key={v.name}>
                      {v.name}
                    </option>
                  ))}
                </Select>
              </ListItem>

              <ListItem
                title={Locale.Settings.Access.CustomModel.Title}
                subTitle={Locale.Settings.Access.CustomModel.SubTitle}
              >
                <input
                  type="text"
                  value={config.customModels}
                  placeholder="model1,model2,model3"
                  onChange={(e) =>
                    config.update(
                      (config) => (config.customModels = e.currentTarget.value),
                    )
                  }
                ></input>
              </ListItem>
            </>
          )}
        </List>

        <List id="Share">
          <ListItem
            title={Locale.Settings.Share.Title}
            subTitle={Locale.Settings.Share.SubTitle}
          >
            <IconButton
              icon={<AddIcon />}
              text={Locale.Settings.Button.Add}
              onClick={() => setEditingProviderId("")}
            />
          </ListItem>

          <ListItem
            title={Locale.Settings.Share.Default.Title}
            subTitle={Locale.Settings.Share.Default.SubTitle}
          >
            <Select
              value={accessStore.defaultShareProviderId}
              onChange={(e) => {
                accessStore.update(
                  (access) => (access.defaultShareProviderId = e.target.value),
                );
              }}
            >
              {accessStore.shareProviders.map((v) => (
                <option value={v.id} key={v.name}>
                  {v.name}
                </option>
              ))}
            </Select>
          </ListItem>

          {accessStore.shareProviders.map((v) => (
            <ListItem
              title={v.name}
              subTitle={
                v.type +
                (v.type === ShareProviderType.Github
                  ? ` - ${v.params.githubRepo}`
                  : "")
              }
              key={v.id}
            >
              <div
                style={{ display: "flex" }}
                className={styles["user-prompt-buttons"]}
              >
                {v.id !== SYSTEM_SHARE_PROVIDER_ID && (
                  <IconButton
                    icon={<ClearIcon />}
                    className={styles["user-prompt-button"]}
                    onClick={() => accessStore.removeShareProvider(v.id!)}
                  />
                )}
                <IconButton
                  icon={<EditIcon />}
                  className={styles["user-prompt-button"]}
                  onClick={() => setEditingProviderId(v.id)}
                />
              </div>
            </ListItem>
          ))}
        </List>

        <List>
          <ModelConfigList
            modelConfig={config.modelConfig}
            updateConfig={(updater) => {
              const modelConfig = { ...config.modelConfig };
              updater(modelConfig);
              config.update((config) => (config.modelConfig = modelConfig));
            }}
          />
        </List>

        {shouldShowPromptModal && (
          <UserPromptModal onClose={() => setShowPromptModal(false)} />
        )}

        {shouldShowEndpointModal && (
          <EndpointPromptModal onClose={() => setShowEndpointModal(false)} />
        )}

        {editingProviderId !== undefined && (
          <EditSharedModal
            id={editingProviderId!}
            onClose={() => setEditingProviderId(undefined)}
          />
        )}

        <DangerItems />
      </div>
    </ErrorBoundary>
  );
}
