(() => {
  const $ = (id) => document.getElementById(id);

  const els = {
    message: $("auth-message"),
    loggedOut: $("logged-out"),
    loggedIn: $("logged-in"),
    loginButton: $("login-button"),
    registerForm: $("register-form"),
    who: $("who"),
    logoutButton: $("logout-button"),
    itemCount: $("item-count"),
    itemList: $("item-list"),
    itemForm: $("item-form"),
    passkeyList: $("passkey-list"),
    addPasskeyForm: $("add-passkey-form"),
  };

  const ERROR_TEXT = {
    not_authenticated: "로그인이 필요합니다.",
    username_taken: "이미 사용 중인 계정 이름입니다.",
    invalid_username: "계정 이름은 1~40자로 입력해 주세요.",
    invalid_name: "패스키 이름은 1~40자로 입력해 주세요.",
    invalid_item: "제목은 1~100자, 내용은 1~1000자로 입력해 주세요.",
    challenge_already_used: "이미 사용된 질문입니다. 다시 시도해 주세요.",
    challenge_invalid_or_expired: "질문이 만료되었습니다. 다시 시도해 주세요.",
    unknown_credential: "서버에 등록되어 있지 않은 패스키입니다.",
    verification_failed: "패스키 확인에 실패했습니다.",
    credential_already_registered: "이미 등록된 패스키입니다.",
    last_passkey: "마지막 패스키는 삭제할 수 없습니다.",
  };

  function showMessage(text) {
    els.message.textContent = text;
  }

  function errorText(data) {
    return ERROR_TEXT[data && data.error] || "요청을 처리하지 못했습니다.";
  }

  function b64uToBuffer(value) {
    const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return bytes.buffer;
  }

  function bufferToB64u(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }

  async function api(method, path, body) {
    const response = await fetch(path, {
      method,
      credentials: "same-origin",
      headers: body ? { "Content-Type": "application/json" } : {},
      body: body ? JSON.stringify(body) : undefined,
    });
    let data = {};
    try {
      data = await response.json();
    } catch {
      data = {};
    }
    return { ok: response.ok, status: response.status, data };
  }

  function toCreationOptions(options) {
    return {
      ...options,
      challenge: b64uToBuffer(options.challenge),
      user: { ...options.user, id: b64uToBuffer(options.user.id) },
      excludeCredentials: (options.excludeCredentials || []).map((item) => ({
        ...item,
        id: b64uToBuffer(item.id),
      })),
    };
  }

  function toRequestOptions(options) {
    return {
      ...options,
      challenge: b64uToBuffer(options.challenge),
      allowCredentials: (options.allowCredentials || []).map((item) => ({
        ...item,
        id: b64uToBuffer(item.id),
      })),
    };
  }

  function registrationToJSON(credential) {
    const response = credential.response;
    return {
      id: credential.id,
      rawId: bufferToB64u(credential.rawId),
      type: credential.type,
      authenticatorAttachment: credential.authenticatorAttachment || undefined,
      clientExtensionResults: credential.getClientExtensionResults(),
      response: {
        clientDataJSON: bufferToB64u(response.clientDataJSON),
        attestationObject: bufferToB64u(response.attestationObject),
        transports: typeof response.getTransports === "function" ? response.getTransports() : [],
      },
    };
  }

  function authenticationToJSON(credential) {
    const response = credential.response;
    return {
      id: credential.id,
      rawId: bufferToB64u(credential.rawId),
      type: credential.type,
      authenticatorAttachment: credential.authenticatorAttachment || undefined,
      clientExtensionResults: credential.getClientExtensionResults(),
      response: {
        clientDataJSON: bufferToB64u(response.clientDataJSON),
        authenticatorData: bufferToB64u(response.authenticatorData),
        signature: bufferToB64u(response.signature),
        userHandle: response.userHandle ? bufferToB64u(response.userHandle) : undefined,
      },
    };
  }

  function formatDate(value) {
    return new Date(value).toLocaleString("ko-KR");
  }

  function renderItems(data) {
    els.itemCount.textContent = String(data.count);
    els.itemList.replaceChildren(
      ...data.items.map((item) => {
        const li = document.createElement("li");
        li.className = "private-item";
        const title = document.createElement("strong");
        title.textContent = item.title;
        const body = document.createElement("p");
        body.textContent = item.body;
        li.append(title, body);
        return li;
      })
    );
  }

  function renderPasskeys(data) {
    els.passkeyList.replaceChildren(
      ...data.passkeys.map((passkey) => {
        const li = document.createElement("li");
        li.className = "passkey-row";

        const info = document.createElement("span");
        const name = document.createElement("strong");
        name.textContent = passkey.name;
        const date = document.createElement("small");
        date.textContent = ` 등록 ${formatDate(passkey.created_at)}`;
        info.append(name, date);

        const remove = document.createElement("button");
        remove.type = "button";
        remove.className = "text-button";
        remove.textContent = "삭제";
        remove.disabled = data.count <= 1;
        remove.addEventListener("click", () => deletePasskey(passkey.id));

        li.append(info, remove);
        return li;
      })
    );
  }

  async function refresh() {
    const session = await api("GET", "/api/session");
    if (!session.ok || !session.data.authenticated) {
      els.loggedIn.hidden = true;
      els.loggedOut.hidden = false;
      els.itemList.replaceChildren();
      els.passkeyList.replaceChildren();
      return;
    }
    els.who.textContent = session.data.username;
    els.loggedOut.hidden = true;
    els.loggedIn.hidden = false;

    const [items, passkeys] = await Promise.all([
      api("GET", "/api/private/items"),
      api("GET", "/api/passkeys"),
    ]);
    if (items.ok) renderItems(items.data);
    if (passkeys.ok) renderPasskeys(passkeys.data);
  }

  async function register(mode, username, name) {
    const optionsResult = await api("POST", "/api/passkey/register-options", { mode, username });
    if (!optionsResult.ok) {
      showMessage(errorText(optionsResult.data));
      return false;
    }
    const options = optionsResult.data;

    let credential;
    try {
      credential = await navigator.credentials.create({ publicKey: toCreationOptions(options) });
    } catch (err) {
      const cancel = await api("POST", "/api/passkey/register-cancel", { challenge: options.challenge });
      const reason =
        err && err.name === "InvalidStateError"
          ? "이 기기에는 이미 이 계정의 패스키가 등록되어 있습니다."
          : "등록이 취소되었거나 시간이 초과되었습니다.";
      showMessage(
        cancel.ok
          ? `${reason} 서버에는 아무것도 저장되지 않았습니다.`
          : `${reason} 서버 정리를 확인하지 못했습니다.`
      );
      return false;
    }
    if (!credential) {
      await api("POST", "/api/passkey/register-cancel", { challenge: options.challenge });
      showMessage("등록이 취소되었습니다. 서버에는 아무것도 저장되지 않았습니다.");
      return false;
    }

    const verify = await api("POST", "/api/passkey/register-verify", {
      name,
      response: registrationToJSON(credential),
    });
    if (!verify.ok) {
      showMessage(errorText(verify.data));
      return false;
    }
    showMessage(`패스키 "${name}"을(를) 등록했습니다.`);
    return true;
  }

  async function login() {
    const optionsResult = await api("POST", "/api/passkey/login-options");
    if (!optionsResult.ok) {
      showMessage(errorText(optionsResult.data));
      return;
    }

    let credential;
    try {
      credential = await navigator.credentials.get({ publicKey: toRequestOptions(optionsResult.data) });
    } catch {
      showMessage("로그인이 취소되었거나 시간이 초과되었습니다.");
      return;
    }
    if (!credential) {
      showMessage("로그인이 취소되었습니다.");
      return;
    }

    const verify = await api("POST", "/api/passkey/login-verify", {
      response: authenticationToJSON(credential),
    });
    if (!verify.ok) {
      showMessage(errorText(verify.data));
      return;
    }
    showMessage("로그인했습니다.");
    await refresh();
  }

  async function deletePasskey(id) {
    const result = await api("DELETE", `/api/passkeys?id=${encodeURIComponent(id)}`);
    showMessage(result.ok ? "패스키를 삭제했습니다." : errorText(result.data));
    await refresh();
  }

  if (!window.PublicKeyCredential || !navigator.credentials) {
    showMessage("이 브라우저는 패스키를 지원하지 않습니다.");
  }

  els.loginButton.addEventListener("click", login);

  els.registerForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(els.registerForm);
    const done = await register("new-account", form.get("username"), form.get("passkeyName"));
    if (done) {
      els.registerForm.reset();
      await refresh();
    }
  });

  els.addPasskeyForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(els.addPasskeyForm);
    const done = await register("add", undefined, form.get("passkeyName"));
    if (done) els.addPasskeyForm.reset();
    await refresh();
  });

  els.itemForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(els.itemForm);
    const result = await api("POST", "/api/private/items", {
      title: form.get("title"),
      body: form.get("body"),
    });
    if (result.ok) {
      els.itemForm.reset();
      showMessage("항목을 추가했습니다.");
    } else {
      showMessage(errorText(result.data));
    }
    await refresh();
  });

  els.logoutButton.addEventListener("click", async () => {
    await api("POST", "/api/passkey/logout");
    showMessage("로그아웃했습니다.");
    await refresh();
  });

  refresh();
})();
