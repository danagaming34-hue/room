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
const MAX_FILE_BYTES = 3 * 1024 * 1024;
const CHUNK_SIZE = 620000;

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
    alert(error.message || "Could not send.");
  } finally {
    updateSendState();
    elements.messageInput.focus();
  }
}

async function createMessage(text) {
  const ref = doc(collection(db, "rooms", state.room, "messages"));
  const batch = writeBatch(db);
  const attachments = state.attachments.map((attachment) => ({
    id: makeId(),
    name: attachment.name,
    type: attachment.type,
    size: attachment.size,
    chunkCount: Math.ceil(attachment.dataUrl.length / CHUNK_SIZE),
  }));

  batch.set(ref, {
    sender: (state.name || "Guest").slice(0, 40),
    clientId: state.clientId,
    text: cleanText(text),
    attachments,
    createdAt: serverTimestamp(),
    updatedAt: null,
  });

  state.attachments.forEach((attachment, attachmentIndex) => {
    const meta = attachments[attachmentIndex];
    const attachmentRef = doc(ref, "attachments", meta.id);
    batch.set(attachmentRef, meta);

    splitIntoChunks(attachment.dataUrl).forEach((chunk, index) => {
      batch.set(doc(attachmentRef, "chunks", String(index).padStart(5, "0")), {
        index,
        data: chunk,
      });
    });
  });

  await batch.commit();
}

async function addFiles(fileList) {
  const files = Array.from(fileList || []);
  if (!files.length) {
    return;
  }

  for (const file of files) {
    if (state.attachments.length >= MAX_ATTACHMENTS) {
      break;
    }
    if (file.size > MAX_FILE_BYTES) {
      alert(`${file.name} is too large. Keep one file under 3 MB for the free database.`);
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
      attachmentWrap.append(renderMessageAttachment(message.id, attachment));
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

function renderMessageAttachment(messageId, attachment) {
  const holder = document.createElement("div");
  holder.className = (attachment.type || "").startsWith("image/") ? "image-attachment" : "file-attachment";
  holder.textContent = `Loading ${attachment.name}`;

  loadAttachmentDataUrl(messageId, attachment)
    .then((dataUrl) => {
      holder.textContent = "";
      if ((attachment.type || "").startsWith("image/")) {
        const link = document.createElement("a");
        link.href = dataUrl;
        link.download = attachment.name;
        link.target = "_blank";
        link.rel = "noopener noreferrer";

        const image = document.createElement("img");
        image.src = dataUrl;
        image.alt = attachment.name;
        image.loading = "lazy";
        link.append(image);
        holder.replaceWith(link);
        link.className = "image-attachment";
        return;
      }

      const link = document.createElement("a");
      link.className = "file-attachment";
      link.href = dataUrl;
      link.download = attachment.name;

      const name = document.createElement("span");
      name.textContent = attachment.name;
      const size = document.createElement("small");
      size.textContent = formatBytes(attachment.size);
      link.append(name, size);
      holder.replaceWith(link);
    })
    .catch(() => {
      holder.textContent = `Could not load ${attachment.name}`;
    });

  return holder;
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
