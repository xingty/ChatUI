import { getClientConfig } from "../config/client";
import { ChatMessage } from "../store";

export class ShareApi {
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
      .map((m) => `## ${m.role}\n${m.content.trim()}\n`)
      .join("\n");
    console.log("[ShareToGithub]", messages);

    const clientConfig = getClientConfig();
    const proxyUrl = `/sharegithub/${owner}/${repo}`;
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
