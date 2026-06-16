import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  collection,
  deleteDoc,
  doc,
  getFirestore,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const firebaseConfig = {
  projectId: "rooms-chat-47021",
  appId: "1:683561918570:web:0d887e76f5e0091170ea13",
  storageBucket: "rooms-chat-47021.firebasestorage.app",
  apiKey: "AIzaSyAnpK5Xng5h0UKQosgyI1uzgcDlABu2MQs",
  authDomain: "rooms-chat-47021.firebaseapp.com",
  messagingSenderId: "683561918570",
  measurementId: "G-44T8PDSWLG",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const MAX_ATTACHMENTS = 8;
const MAX_FILE_BYTES = 5 * 1024 * 1024;
const CHUNK_SIZE = 620000;
const BATCH_LIMIT = 18;

const state = {
  room: "",
  name: localStorage.getItem("rooms:name") || "",
  clientId: localStorage.getItem("rooms:clientId") || makeId(),
  messages: new Map(),
  unsubscribe: null,
  attachments: [],
  attachmentCache: new Map(),
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
  roomSubtitle: document.querySelector("#roomSubtitle"),
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
  download: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><path d="M7 10l5 5 5-5"></path><path d="M12 15V3"></path></svg>',
  open: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 3h6v6"></path><path d="M10 14 21 3"></path><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path></svg>',
  eye: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"></path><circle cx="12" cy="12" r="3"></circle></svg>',
  video: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m16 13 5 3V8l-5 3Z"></path><rect x="3" y="5" width="13" height="14" rx="2"></rect></svg>',
  audio: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg>',
  document: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"></path><path d="M14 2v6h6"></path><path d="M8 13h8"></path><path d="M8 17h5"></path></svg>',
};

elements.nameInput.value = state.name;
elements.sendButton.innerHTML = icons.send;
elements.imageButton.innerHTML = icons.image;
elements.fileButton.innerHTML = icons.file;
elements.copyDraftButton.innerHTML = icons.copy;
elements.cutDraftButton.innerHTML = icons.cut;
elements.copyRoomButton.innerHTML = icons.link;
elements.leaveButton.innerHTML = icons.leave;

const toastRegion = document.createElement("div");
toastRegion.className = "toast-region";
toastRegion.setAttribute("aria-live", "polite");
document.body.append(toastRegion);

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
elements.copyRoomButton.addEventListener("click", () => copyToClipboard(window.location.href, "Room link copied"));
elements.imageButton.addEventListener("click", () => elements.imageInput.click());
elements.fileButton.addEventListener("click", () => elements.fileInput.click());
elements.copyDraftButton.addEventListener("click", () => copyToClipboard(elements.messageInput.value, "Draft copied"));
elements.cutDraftButton.addEventListener("click", async () => {
  await copyToClipboard(elements.messageInput.value, "Draft cut");
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
  updateRoomSubtitle(0);
  elements.joinPanel.classList.add("hidden");
  elements.chatView.classList.remove("hidden");
  elements.messageInput.focus();
  setStatus("Connecting", false);
  subscribeToRoom(room);
}

function leaveRoom() {
  if (state.unsubscribe) {
    state.unsubscribe();
  }

  state.unsubscribe = null;
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

function subscribeToRoom(room) {
  if (state.unsubscribe) {
    state.unsubscribe();
  }

  const messagesQuery = query(collection(db, "rooms", room, "messages"), orderBy("createdAt", "asc"), limit(400));
  state.unsubscribe = onSnapshot(
    messagesQuery,
    (snapshot) => {
      state.messages = new Map(snapshot.docs.map((messageDoc) => [messageDoc.id, normalizeMessage(messageDoc)]));
      setStatus("Live", false);
      updateRoomSubtitle(state.messages.size);
      renderMessages(true);
    },
    () => {
      setStatus("Offline", true);
    },
  );
}

function normalizeMessage(messageDoc) {
  const data = messageDoc.data();
  return {
    id: messageDoc.id,
    sender: data.sender || "Guest",
    clientId: data.clientId || "",
    text: data.text || "",
    attachments: Array.isArray(data.attachments) ? data.attachments : [],
    createdAt: timestampToIso(data.createdAt),
    updatedAt: data.updatedAt ? timestampToIso(data.updatedAt) : null,
  };
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
      await updateDoc(messageRef(state.editingId), {
        text: cleanText(text),
        updatedAt: serverTimestamp(),
      });
      cancelEdit();
    } else {
      await createMessage(text);
      elements.messageInput.value = "";
      state.attachments = [];
      renderAttachments();
    }
    resizeComposer();
  } catch (error) {
      notify(error.message || "Could not send.", "danger");
  } finally {
    updateSendState();
    elements.messageInput.focus();
  }
}

async function createMessage(text) {
  const ref = doc(collection(db, "rooms", state.room, "messages"));
  const attachments = state.attachments.map((attachment) => ({
    id: makeId(),
    name: attachment.name,
    type: attachment.type,
    size: attachment.size,
    chunkCount: Math.ceil(attachment.dataUrl.length / CHUNK_SIZE),
  }));

  for (let index = 0; index < state.attachments.length; index += 1) {
    await writeAttachment(ref, attachments[index], state.attachments[index]);
  }

  await setDoc(ref, {
    sender: (state.name || "Guest").slice(0, 40),
    clientId: state.clientId,
    text: cleanText(text),
    attachments,
    createdAt: serverTimestamp(),
    updatedAt: null,
  });
}

async function writeAttachment(messageReference, meta, attachment) {
  const attachmentRef = doc(messageReference, "attachments", meta.id);
  const chunks = splitIntoChunks(attachment.dataUrl);
  let batch = writeBatch(db);
  let operations = 0;

  batch.set(attachmentRef, meta);
  operations += 1;

  for (let index = 0; index < chunks.length; index += 1) {
    batch.set(doc(attachmentRef, "chunks", String(index).padStart(5, "0")), {
      index,
      data: chunks[index],
    });
    operations += 1;

    if (operations >= BATCH_LIMIT) {
      await batch.commit();
      batch = writeBatch(db);
      operations = 0;
    }
  }

  if (operations > 0) {
    await batch.commit();
  }
}

async function addFiles(fileList) {
  const files = Array.from(fileList || []);
  if (!files.length) {
    return;
  }

  for (const file of files) {
    if (state.attachments.length >= MAX_ATTACHMENTS) {
      notify(`Only ${MAX_ATTACHMENTS} attachments at once`, "danger");
      break;
    }
    if (file.size > MAX_FILE_BYTES) {
      notify(`${file.name} is too large. Keep one file under 5 MB.`, "danger");
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
    const thumb = item.querySelector(".draft-thumb");
    item.querySelector(".draft-attachment-name").textContent = attachment.name;
    item.querySelector(".draft-attachment-meta").textContent = `${fileKindLabel(attachment.type)} · ${formatBytes(attachment.size)}`;
    thumb.innerHTML = getAttachmentIcon(attachment.type);
    if ((attachment.type || "").startsWith("image/")) {
      thumb.style.backgroundImage = `url("${attachment.dataUrl}")`;
      thumb.classList.add("has-preview");
      thumb.innerHTML = "";
    }
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

  const identity = document.createElement("div");
  identity.className = "message-identity";

  const avatar = document.createElement("span");
  avatar.className = "message-avatar";
  avatar.textContent = initials(message.sender || "Guest");

  const sender = document.createElement("span");
  sender.className = "message-sender";
  sender.textContent = message.sender || "Guest";
  identity.append(avatar, sender);

  const time = document.createElement("time");
  time.dateTime = message.createdAt;
  time.textContent = formatTime(message.updatedAt || message.createdAt) + (message.updatedAt ? " edited" : "");

  meta.append(identity, time);
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
      attachmentWrap.append(renderMessageAttachment(message.id, attachment));
    });
    item.append(attachmentWrap);
  }

  const actions = document.createElement("div");
  actions.className = "message-actions";
  actions.append(
    messageAction("Edit", icons.edit, () => startEdit(message)),
    messageAction("Copy", icons.copy, () => copyToClipboard(message.text || attachmentSummary(message), "Message copied")),
    messageAction("Cut", icons.cut, async () => {
      await copyToClipboard(message.text || attachmentSummary(message), "Message cut");
      await deleteMessage(message.id, false);
    }),
    messageAction("Delete", icons.trash, () => deleteMessage(message.id, true), true),
  );
  item.append(actions);

  return item;
}

function renderMessageAttachment(messageId, attachment) {
  const card = document.createElement("article");
  const kind = attachmentKind(attachment.type);
  card.className = `media-card ${kind}`;

  const preview = document.createElement("div");
  preview.className = "media-preview is-loading";
  preview.innerHTML = getAttachmentIcon(attachment.type);

  const body = document.createElement("div");
  body.className = "media-body";

  const title = document.createElement("div");
  title.className = "media-title";
  title.textContent = attachment.name;

  const meta = document.createElement("div");
  meta.className = "media-meta";
  meta.textContent = `${fileKindLabel(attachment.type)} · ${formatBytes(attachment.size)}`;

  const actions = document.createElement("div");
  actions.className = "media-actions";

  body.append(title, meta, actions);
  card.append(preview, body);

  loadAttachmentDataUrl(messageId, attachment)
    .then((dataUrl) => {
      preview.classList.remove("is-loading");
      preview.classList.add("can-preview");
      preview.innerHTML = "";

      if (kind === "image") {
        const image = document.createElement("img");
        image.src = dataUrl;
        image.alt = attachment.name;
        image.loading = "lazy";
        preview.append(image);
      } else if (kind === "video") {
        const video = document.createElement("video");
        video.src = dataUrl;
        video.controls = true;
        video.preload = "metadata";
        preview.append(video);
      } else if (kind === "audio") {
        const audio = document.createElement("audio");
        audio.src = dataUrl;
        audio.controls = true;
        preview.append(audio);
      } else {
        preview.innerHTML = getAttachmentIcon(attachment.type);
      }

      preview.addEventListener("click", (event) => {
        if (event.target.closest("video, audio")) {
          return;
        }
        openMediaViewer(dataUrl, attachment);
      });

      actions.append(
        saveMediaAction(dataUrl, attachment.name),
        previewMediaAction(dataUrl, attachment),
      );
    })
    .catch(() => {
      preview.classList.remove("is-loading");
      preview.innerHTML = getAttachmentIcon(attachment.type);
      meta.textContent = "Could not load file";
    });

  return card;
}

async function loadAttachmentDataUrl(messageId, attachment) {
  const cacheKey = `${messageId}:${attachment.id}`;
  if (state.attachmentCache.has(cacheKey)) {
    return state.attachmentCache.get(cacheKey);
  }

  const chunksQuery = query(collection(db, "rooms", state.room, "messages", messageId, "attachments", attachment.id, "chunks"), orderBy("index", "asc"));
  const snapshot = await getDocs(chunksQuery);
  const dataUrl = snapshot.docs.map((chunkDoc) => chunkDoc.data().data || "").join("");
  state.attachmentCache.set(cacheKey, dataUrl);
  return dataUrl;
}

function saveMediaAction(dataUrl, name) {
  const link = document.createElement("a");
  link.className = "media-action";
  link.href = dataUrl;
  link.download = name;
  link.innerHTML = `${icons.download}<span>Save</span>`;

  return link;
}

function previewMediaAction(dataUrl, attachment) {
  const button = document.createElement("button");
  button.className = "media-action";
  button.type = "button";
  button.innerHTML = `${icons.eye}<span>Preview</span>`;
  button.addEventListener("click", () => openMediaViewer(dataUrl, attachment));
  return button;
}

function openMediaViewer(dataUrl, attachment) {
  const kind = attachmentKind(attachment.type);
  const viewer = document.createElement("div");
  viewer.className = "media-viewer";
  viewer.setAttribute("role", "dialog");
  viewer.setAttribute("aria-modal", "true");

  const panel = document.createElement("div");
  panel.className = "media-viewer-panel";

  const header = document.createElement("div");
  header.className = "media-viewer-header";

  const title = document.createElement("div");
  title.className = "media-viewer-title";
  title.textContent = attachment.name;

  const actions = document.createElement("div");
  actions.className = "media-viewer-actions";
  actions.append(saveMediaAction(dataUrl, attachment.name));

  const closeButton = document.createElement("button");
  closeButton.className = "icon-button";
  closeButton.type = "button";
  closeButton.title = "Close";
  closeButton.setAttribute("aria-label", "Close");
  closeButton.innerHTML = icons.close;
  actions.append(closeButton);

  const stage = document.createElement("div");
  stage.className = "media-viewer-stage";

  if (kind === "image") {
    const image = document.createElement("img");
    image.src = dataUrl;
    image.alt = attachment.name;
    stage.append(image);
  } else if (kind === "video") {
    const video = document.createElement("video");
    video.src = dataUrl;
    video.controls = true;
    video.autoplay = true;
    stage.append(video);
  } else if (kind === "audio") {
    const audio = document.createElement("audio");
    audio.src = dataUrl;
    audio.controls = true;
    audio.autoplay = true;
    stage.append(audio);
  } else if (kind === "document" && isPdf(attachment.type)) {
    const frame = document.createElement("iframe");
    frame.className = "media-frame";
    frame.src = dataUrl;
    frame.title = attachment.name;
    stage.append(frame);
  } else if (kind === "document" && isTextLike(attachment.type)) {
    const pre = document.createElement("pre");
    pre.className = "media-text-preview";
    pre.textContent = decodeDataUrlText(dataUrl);
    stage.append(pre);
  } else {
    stage.append(renderUnsupportedPreview(attachment));
  }

  header.append(title, actions);
  panel.append(header, stage);
  viewer.append(panel);
  document.body.append(viewer);

  const close = () => {
    document.removeEventListener("keydown", onKeyDown);
    viewer.remove();
  };
  const onKeyDown = (event) => {
    if (event.key === "Escape") {
      close();
    }
  };

  closeButton.addEventListener("click", close);
  viewer.addEventListener("click", (event) => {
    if (event.target === viewer) {
      close();
    }
  });
  document.addEventListener("keydown", onKeyDown);
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
    const message = state.messages.get(id);
    const ref = messageRef(id);

    if (!message?.attachments?.length) {
      await deleteDoc(ref);
      return;
    }

    const batch = writeBatch(db);
    for (const attachment of message.attachments) {
      const attachmentRef = doc(ref, "attachments", attachment.id);
      const chunkSnapshot = await getDocs(collection(attachmentRef, "chunks"));
      chunkSnapshot.forEach((chunkDoc) => batch.delete(chunkDoc.ref));
      batch.delete(attachmentRef);
    }
    batch.delete(ref);
    await batch.commit();
  } catch (error) {
    notify(error.message || "Could not delete.", "danger");
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

async function copyToClipboard(value, successMessage = "Copied") {
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

  notify(successMessage);
}

function messageRef(id) {
  return doc(db, "rooms", state.room, "messages", id);
}

function splitIntoChunks(value) {
  const chunks = [];
  for (let index = 0; index < value.length; index += CHUNK_SIZE) {
    chunks.push(value.slice(index, index + CHUNK_SIZE));
  }
  return chunks;
}

function cleanText(value) {
  return String(value || "").replace(/\u0000/g, "").slice(0, 12000);
}

function attachmentSummary(message) {
  return (message.attachments || []).map((attachment) => attachment.name).join(", ");
}

function attachmentKind(type) {
  const value = type || "";
  if (value.startsWith("image/")) {
    return "image";
  }
  if (value.startsWith("video/")) {
    return "video";
  }
  if (value.startsWith("audio/")) {
    return "audio";
  }
  if (value.includes("pdf") || value.startsWith("text/") || value.includes("document")) {
    return "document";
  }
  return "file";
}

function fileKindLabel(type) {
  const kind = attachmentKind(type);
  return {
    image: "Image",
    video: "Video",
    audio: "Audio",
    document: "Document",
    file: "File",
  }[kind];
}

function isPdf(type) {
  return String(type || "").toLowerCase().includes("pdf");
}

function isTextLike(type) {
  const value = String(type || "").toLowerCase();
  return value.startsWith("text/") || value.includes("json") || value.includes("xml") || value.includes("javascript");
}

function decodeDataUrlText(dataUrl) {
  const [, metadata = "", payload = ""] = dataUrl.match(/^data:([^,]*),(.*)$/s) || [];
  if (!payload) {
    return "";
  }

  try {
    if (metadata.includes(";base64")) {
      const binary = atob(payload);
      const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
      return new TextDecoder().decode(bytes);
    }

    return decodeURIComponent(payload);
  } catch {
    return "Preview unavailable for this text file.";
  }
}

function renderUnsupportedPreview(attachment) {
  const fallback = document.createElement("div");
  fallback.className = "media-fallback";
  fallback.innerHTML = getAttachmentIcon(attachment.type);

  const title = document.createElement("strong");
  title.textContent = attachment.name;

  const meta = document.createElement("span");
  meta.textContent = `${fileKindLabel(attachment.type)} · ${formatBytes(attachment.size)}`;

  const note = document.createElement("p");
  note.textContent = "Preview is not available for this file type. Use Save when you want to download it.";

  fallback.append(title, meta, note);
  return fallback;
}

function getAttachmentIcon(type) {
  const kind = attachmentKind(type);
  return {
    image: icons.image,
    video: icons.video,
    audio: icons.audio,
    document: icons.document,
    file: icons.file,
  }[kind];
}

function initials(name) {
  return String(name || "G")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0] || "")
    .join("")
    .toUpperCase() || "G";
}

function setStatus(text, offline) {
  elements.statusPill.textContent = text;
  elements.statusPill.classList.toggle("offline", offline);
}

function updateRoomSubtitle(count) {
  elements.roomSubtitle.textContent = `${count} ${count === 1 ? "message" : "messages"}`;
}

function notify(message, tone = "success") {
  const toast = document.createElement("div");
  toast.className = `toast ${tone}`;
  toast.textContent = message;
  toastRegion.append(toast);
  setTimeout(() => toast.classList.add("show"), 20);
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 220);
  }, 2400);
}

function updateSendState() {
  elements.sendButton.disabled = !elements.messageInput.value.trim() && state.attachments.length === 0;
}

function resizeComposer() {
  elements.messageInput.style.height = "auto";
  elements.messageInput.style.height = `${Math.min(elements.messageInput.scrollHeight, 160)}px`;
}

function timestampToIso(value) {
  if (value?.toDate) {
    return value.toDate().toISOString();
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === "string") {
    return value;
  }

  return new Date().toISOString();
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
