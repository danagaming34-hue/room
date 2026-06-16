const state = {
  room: "",
  name: localStorage.getItem("rooms:name") || "",
  clientId: localStorage.getItem("rooms:clientId") || makeId(),
  messages: new Map(),
  source: null,
  attachments: [],
  editingId: null,
};

localStorage.setItem("rooms:clientId", state.clientId);

const elements = {
  joinPanel: document.querySelector("#joinPanel"),
  joinForm: document.querySelector("#joinForm"),
  nameInput: document.querySelector("#nameInput"),
  roomInput: document.querySelector("#roomInput"),
  chatView: document.querySelector("#chatView"),
  roomTitle: document.querySelector("#roomTitle"),
  statusPill: document.querySelector("#statusPill"),
  copyRoomButton: document.querySelector("#copyRoomButton"),
  leaveButton: document.querySelector("#leaveButton"),
  messages: document.querySelector("#messages"),
  dropZone: document.querySelector("#dropZone"),
  messageForm: document.querySelector("#messageForm"),
  messageInput: document.querySelector("#messageInput"),
  sendButton: document.querySelector("#sendButton"),
  imageButton: document.querySelector("#imageButton"),
  fileButton: document.querySelector("#fileButton"),
  copyDraftButton: document.querySelector("#copyDraftButton"),
  cutDraftButton: document.querySelector("#cutDraftButton"),
  imageInput: document.querySelector("#imageInput"),
  fileInput: document.querySelector("#fileInput"),
  attachmentTray: document.querySelector("#attachmentTray"),
  attachmentTemplate: document.querySelector("#attachmentTemplate"),
  editStrip: document.querySelector("#editStrip"),
  cancelEditButton: document.querySelector("#cancelEditButton"),
};

const icons = {
  send: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M22 2 11 13"></path><path d="m22 2-7 20-4-9-9-4 20-7Z"></path></svg>',
  image: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"></rect><circle cx="9" cy="9" r="2"></circle><path d="m21 15-3.5-3.5a2 2 0 0 0-2.8 0L7 19"></path></svg>',
  file: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"></path><path d="M14 2v6h6"></path></svg>',
  copy: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2"></rect><rect x="2" y="2" width="13" height="13" rx="2"></rect></svg>',
  cut: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="6" cy="6" r="3"></circle><circle cx="6" cy="18" r="3"></circle><path d="M20 4 8.12 15.88"></path><path d="M14.47 14.48 20 20"></path><path d="M8.12 8.12 12 12"></path></svg>',
  edit: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20h9"></path><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"></path></svg>',
  trash: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18"></path><path d="M8 6V4h8v2"></path><path d="m19 6-1 14H6L5 6"></path></svg>',
  leave: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><path d="M16 17l5-5-5-5"></path><path d="M21 12H9"></path></svg>',
  close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6 6 18"></path><path d="m6 6 12 12"></path></svg>',
  link: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.1 0l2-2a5 5 0 1 0-7.1-7.1l-1.1 1.1"></path><path d="M14 11a5 5 0 0 0-7.1 0l-2 2a5 5 0 1 0 7.1 7.1l1.1-1.1"></path></svg>',
};

elements.nameInput.value = state.name;
elements.sendButton.innerHTML = icons.send;
elements.imageButton.innerHTML = icons.image;
elements.fileButton.innerHTML = icons.file;
elements.copyDraftButton.innerHTML = icons.copy;
elements.cutDraftButton.innerHTML = icons.cut;
elements.copyRoomButton.innerHTML = icons.link;
elements.leaveButton.innerHTML = icons.leave;

const urlRoom = new URLSearchParams(window.location.search).get("room");
if (urlRoom && /^[0-9]{1,12}$/.test(urlRoom)) {
  elements.roomInput.value = urlRoom;
  joinRoom(urlRoom);
}

elements.joinForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const room = elements.roomInput.value.replace(/\D/g, "").slice(0, 12);
  if (!room) {
    elements.roomInput.focus();
    return;
  }

  joinRoom(room);
});

elements.roomInput.addEventListener("input", () => {
  elements.roomInput.value = elements.roomInput.value.replace(/\D/g, "").slice(0, 12);
});

elements.nameInput.addEventListener("input", () => {
  state.name = elements.nameInput.value.trim();
  localStorage.setItem("rooms:name", state.name);
});

elements.leaveButton.addEventListener("click", leaveRoom);
elements.copyRoomButton.addEventListener("click", () => copyToClipboard(window.location.href));
elements.imageButton.addEventListener("click", () => elements.imageInput.click());
elements.fileButton.addEventListener("click", () => elements.fileInput.click());
elements.copyDraftButton.addEventListener("click", () => copyToClipboard(elements.messageInput.value));
elements.cutDraftButton.addEventListener("click", async () => {
  await copyToClipboard(elements.messageInput.value);
  elements.messageInput.value = "";
  resizeComposer();
  updateSendState();
});
elements.cancelEditButton.addEventListener("click", cancelEdit);

elements.imageInput.addEventListener("change", () => addFiles(elements.imageInput.files));
elements.fileInput.addEventListener("change", () => addFiles(elements.fileInput.files));

elements.messageInput.addEventListener("input", () => {
  resizeComposer();
  updateSendState();
});

elements.messageInput.addEventListener("paste", (event) => {
  const files = Array.from(event.clipboardData?.files || []);
  if (files.length) {
    addFiles(files);
  }
});

elements.messageForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  await submitMessage();
});

["dragenter", "dragover"].forEach((eventName) => {
  elements.dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    elements.dropZone.classList.add("dragging");
  });
});

["dragleave", "drop"].forEach((eventName) => {
  elements.dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    elements.dropZone.classList.remove("dragging");
  });
});

elements.dropZone.addEventListener("drop", (event) => {
  addFiles(event.dataTransfer?.files || []);
});

document.addEventListener("keydown", (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key === "Enter" && !elements.chatView.classList.contains("hidden")) {
    elements.messageForm.requestSubmit();
  }
});

updateSendState();

async function joinRoom(room) {
  state.room = room;
  state.name = elements.nameInput.value.trim() || "Guest";
  localStorage.setItem("rooms:name", state.name);
  history.replaceState(null, "", `/?room=${encodeURIComponent(room)}`);

  elements.roomTitle.textContent = room;
  elements.joinPanel.classList.add("hidden");
  elements.chatView.classList.remove("hidden");
  elements.messageInput.focus();
  setStatus("Connecting", false);

  await loadMessages(room);
  connectEvents(room);
}

function leaveRoom() {
  if (state.source) {
    state.source.close();
  }
  state.source = null;
  state.room = "";
  state.messages.clear();
  state.attachments = [];
  state.editingId = null;
  history.replaceState(null, "", "/");
  elements.chatView.classList.add("hidden");
  elements.joinPanel.classList.remove("hidden");
  renderMessages();
  renderAttachments();
  cancelEdit();
}

async function loadMessages(room) {
  try {
    const response = await fetch(`/api/rooms/${room}`);
    const data = await response.json();
    state.messages = new Map((data.messages || []).map((message) => [message.id, message]));
    renderMessages();
  } catch {
    setStatus("Offline", true);
  }
}

function connectEvents(room) {
  if (state.source) {
    state.source.close();
  }

  state.source = new EventSource(`/events/${room}`);
  state.source.addEventListener("connected", () => setStatus("Live", false));
  state.source.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    state.messages.set(message.id, message);
    renderMessages(true);
  });
  state.source.addEventListener("update", (event) => {
    const message = JSON.parse(event.data);
    state.messages.set(message.id, message);
    renderMessages(true);
  });
  state.source.addEventListener("delete", (event) => {
    const message = JSON.parse(event.data);
    state.messages.delete(message.id);
    renderMessages(true);
  });
  state.source.onerror = () => setStatus("Reconnecting", true);
}

async function submitMessage() {
  const text = elements.messageInput.value;
  const hasBody = text.trim() || state.attachments.length;
  if (!hasBody || !state.room) {
    return;
  }

  elements.sendButton.disabled = true;

  try {
    if (state.editingId) {
      await api(`/api/rooms/${state.room}/messages/${state.editingId}`, {
        method: "PATCH",
        body: { text },
      });
      cancelEdit();
    } else {
      await api(`/api/rooms/${state.room}/messages`, {
        method: "POST",
        body: {
          sender: state.name || "Guest",
          clientId: state.clientId,
          text,
          attachments: state.attachments,
        },
      });
      elements.messageInput.value = "";
      state.attachments = [];
      renderAttachments();
    }
    resizeComposer();
  } catch (error) {
    alert(error.message || "Could not send.");
  } finally {
    updateSendState();
    elements.messageInput.focus();
  }
}

async function api(url, options = {}) {
  const response = await fetch(url, {
    method: options.method || "GET",
    headers: { "Content-Type": "application/json" },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || "Request failed.");
  }

  return data;
}

async function addFiles(fileList) {
  const files = Array.from(fileList || []);
  if (!files.length) {
    return;
  }

  for (const file of files) {
    if (state.attachments.length >= 8) {
      break;
    }
    if (file.size > 7 * 1024 * 1024) {
      alert(`${file.name} is too large. Keep one file under 7 MB.`);
      continue;
    }
    state.attachments.push(await fileToAttachment(file));
  }

  elements.imageInput.value = "";
  elements.fileInput.value = "";
  renderAttachments();
  updateSendState();
}

function fileToAttachment(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve({
        name: file.name,
        type: file.type || "application/octet-stream",
        size: file.size,
        dataUrl: reader.result,
      });
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function renderAttachments() {
  elements.attachmentTray.innerHTML = "";
  elements.attachmentTray.classList.toggle("hidden", state.attachments.length === 0);

  state.attachments.forEach((attachment, index) => {
    const item = elements.attachmentTemplate.content.firstElementChild.cloneNode(true);
    item.querySelector(".draft-attachment-name").textContent = attachment.name;
    const removeButton = item.querySelector("button");
    removeButton.innerHTML = icons.close;
    removeButton.addEventListener("click", () => {
      state.attachments.splice(index, 1);
      renderAttachments();
      updateSendState();
    });
    elements.attachmentTray.append(item);
  });
}

function renderMessages(keepScroll = false) {
  const wasNearBottom =
    elements.dropZone.scrollHeight - elements.dropZone.scrollTop - elements.dropZone.clientHeight < 90;
  const messages = Array.from(state.messages.values()).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

  elements.messages.innerHTML = "";

  if (!messages.length) {
    const empty = document.createElement("li");
    empty.className = "empty-state";
    empty.textContent = "No messages yet";
    elements.messages.append(empty);
    return;
  }

  messages.forEach((message) => {
    elements.messages.append(renderMessage(message));
  });

  if (!keepScroll || wasNearBottom) {
    elements.dropZone.scrollTop = elements.dropZone.scrollHeight;
  }
}

function renderMessage(message) {
  const item = document.createElement("li");
  item.className = `message ${message.clientId === state.clientId ? "mine" : ""}`;
  item.dataset.id = message.id;

  const meta = document.createElement("div");
  meta.className = "message-meta";

  const sender = document.createElement("span");
  sender.textContent = message.sender || "Guest";

  const time = document.createElement("time");
  time.dateTime = message.createdAt;
  time.textContent = formatTime(message.updatedAt || message.createdAt) + (message.updatedAt ? " edited" : "");

  meta.append(sender, time);
  item.append(meta);

  if (message.text) {
    const text = document.createElement("div");
    text.className = "message-text";
    appendLinkedText(text, message.text);
    item.append(text);
  }

  if (message.attachments?.length) {
    const attachmentWrap = document.createElement("div");
    attachmentWrap.className = "message-attachments";

    message.attachments.forEach((attachment) => {
      attachmentWrap.append(renderMessageAttachment(attachment));
    });
    item.append(attachmentWrap);
  }

  const actions = document.createElement("div");
  actions.className = "message-actions";
  actions.append(
    messageAction("Edit", icons.edit, () => startEdit(message)),
    messageAction("Copy", icons.copy, () => copyToClipboard(message.text || attachmentSummary(message))),
    messageAction("Cut", icons.cut, async () => {
      await copyToClipboard(message.text || attachmentSummary(message));
      await deleteMessage(message.id, false);
    }),
    messageAction("Delete", icons.trash, () => deleteMessage(message.id, true), true),
  );
  item.append(actions);

  return item;
}

function renderMessageAttachment(attachment) {
  if ((attachment.type || "").startsWith("image/")) {
    const link = document.createElement("a");
    link.className = "image-attachment";
    link.href = attachment.dataUrl;
    link.download = attachment.name;
    link.target = "_blank";
    link.rel = "noopener noreferrer";

    const image = document.createElement("img");
    image.src = attachment.dataUrl;
    image.alt = attachment.name;
    image.loading = "lazy";
    link.append(image);
    return link;
  }

  const link = document.createElement("a");
  link.className = "file-attachment";
  link.href = attachment.dataUrl;
  link.download = attachment.name;

  const name = document.createElement("span");
  name.textContent = attachment.name;
  const size = document.createElement("small");
  size.textContent = formatBytes(attachment.size);
  link.append(name, size);
  return link;
}

function messageAction(label, icon, handler, danger = false) {
  const button = document.createElement("button");
  button.className = `icon-button small ${danger ? "danger" : ""}`;
  button.type = "button";
  button.title = label;
  button.setAttribute("aria-label", label);
  button.innerHTML = icon;
  button.addEventListener("click", handler);
  return button;
}

function startEdit(message) {
  state.editingId = message.id;
  elements.messageInput.value = message.text || "";
  elements.editStrip.classList.remove("hidden");
  state.attachments = [];
  renderAttachments();
  resizeComposer();
  updateSendState();
  elements.messageInput.focus();
}

function cancelEdit() {
  state.editingId = null;
  elements.editStrip.classList.add("hidden");
  elements.messageInput.value = "";
  resizeComposer();
  updateSendState();
}

async function deleteMessage(id, ask) {
  if (ask && !confirm("Delete this message?")) {
    return;
  }
  try {
    await api(`/api/rooms/${state.room}/messages/${id}`, { method: "DELETE" });
  } catch (error) {
    alert(error.message || "Could not delete.");
  }
}

function appendLinkedText(container, text) {
  const pattern = /((https?:\/\/|www\.)[^\s<]+)/gi;
  let index = 0;

  text.replace(pattern, (match, _full, _prefix, offset) => {
    if (offset > index) {
      container.append(document.createTextNode(text.slice(index, offset)));
    }

    const link = document.createElement("a");
    link.href = match.startsWith("http") ? match : `https://${match}`;
    link.textContent = match;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    container.append(link);
    index = offset + match.length;
    return match;
  });

  if (index < text.length) {
    container.append(document.createTextNode(text.slice(index)));
  }
}

async function copyToClipboard(value) {
  const text = String(value || "");
  if (!text) {
    return;
  }

  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const input = document.createElement("textarea");
    input.value = text;
    document.body.append(input);
    input.select();
    document.execCommand("copy");
    input.remove();
  }
}

function attachmentSummary(message) {
  return (message.attachments || []).map((attachment) => attachment.name).join(", ");
}

function setStatus(text, offline) {
  elements.statusPill.textContent = text;
  elements.statusPill.classList.toggle("offline", offline);
}

function updateSendState() {
  elements.sendButton.disabled = !elements.messageInput.value.trim() && state.attachments.length === 0;
}

function resizeComposer() {
  elements.messageInput.style.height = "auto";
  elements.messageInput.style.height = `${Math.min(elements.messageInput.scrollHeight, 160)}px`;
}

function formatTime(value) {
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatBytes(bytes) {
  if (!bytes) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB"];
  const power = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** power).toFixed(power ? 1 : 0)} ${units[power]}`;
}

function makeId() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  const random = Math.random().toString(36).slice(2);
  return `${Date.now().toString(36)}-${random}`;
}
