(() => {
  "use strict";

  const EMPTY_FALLBACK = {
    version: 1,
    site: {
      title: "",
      description: ""
    },
    creator: {
      avatar: "",
      fallbackText: "",
      name: "",
      handle: "",
      bio: [],
      links: []
    },
    worlds: [],
    characters: []
  };

  const ADMIN_FALLBACK = {
    profileLinkServices: []
  };

  const emptyProject = window.EMPTY_PROJECT || EMPTY_FALLBACK;
  const adminCatalog =
    window.ADMIN_CATALOG ||
    (typeof ADMIN_CATALOG !== "undefined" ? ADMIN_CATALOG : null) ||
    ADMIN_FALLBACK;

  const CURRENT_PROJECT_VERSION = Number(emptyProject.version) || 1;
  const STORAGE_KEY = `portfolio-generator:project:v${CURRENT_PROJECT_VERSION}`;
  const AUTOSAVE_DELAY = 450;
  const ADMIN_ASSET_BASE = "../template/images/";

  const IMAGE_DB_NAME = "portfolio-generator-images";
  const IMAGE_DB_VERSION = 1;
  const IMAGE_STORE_NAME = "images";
  const MAX_AVATAR_FILE_BYTES = 10 * 1024 * 1024;
  const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];

  const services = Array.isArray(adminCatalog.profileLinkServices)
    ? adminCatalog.profileLinkServices
    : [];

  const serviceCatalog = new Map(
    services.map((service) => [service.id, service])
  );

  let project = createEmptyProject();
  let creatorAvatarBlob = null;
  let creatorAvatarPreviewUrl = "";
  let avatarRestoreMissing = false;
  let imageDatabasePromise = null;
  let autosaveTimer = 0;
  let restoredAutosave = false;
  let autosaveRestoreError = "";

  const elements = {
    profileForm: document.querySelector("#profileForm"),
    downloadProjectButton: document.querySelector("#downloadProjectButton"),
    importProjectInput: document.querySelector("#importProjectInput"),
    resetProjectButton: document.querySelector("#resetProjectButton"),

    siteTitleInput: document.querySelector("#siteTitleInput"),
    siteDescriptionInput: document.querySelector("#siteDescriptionInput"),
    creatorNameInput: document.querySelector("#creatorNameInput"),
    creatorHandleInput: document.querySelector("#creatorHandleInput"),
    creatorFallbackInput: document.querySelector("#creatorFallbackInput"),
    creatorBioInput: document.querySelector("#creatorBioInput"),

    avatarInput: document.querySelector("#avatarInput"),
    avatarEditorPreview: document.querySelector("#avatarEditorPreview"),
    avatarEditorFallback: document.querySelector("#avatarEditorFallback"),
    avatarStorageStatus: document.querySelector("#avatarStorageStatus"),
    removeAvatarButton: document.querySelector("#removeAvatarButton"),

    socialServiceSelect: document.querySelector("#socialServiceSelect"),
    socialUrlInput: document.querySelector("#socialUrlInput"),
    addSocialLinkButton: document.querySelector("#addSocialLinkButton"),
    socialError: document.querySelector("#socialError"),
    socialLinkList: document.querySelector("#socialLinkList"),

    previewSiteTitle: document.querySelector("#previewSiteTitle"),
    previewSiteDescription: document.querySelector("#previewSiteDescription"),
    previewCreatorName: document.querySelector("#previewCreatorName"),
    previewCreatorHandle: document.querySelector("#previewCreatorHandle"),
    previewCreatorBio: document.querySelector("#previewCreatorBio"),
    previewCreatorLinks: document.querySelector("#previewCreatorLinks"),
    previewAvatarImage: document.querySelector("#previewAvatarImage"),
    previewAvatarFallback: document.querySelector("#previewAvatarFallback"),

    saveStatus: document.querySelector("#saveStatus")
  };

  function cloneJson(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function isPlainObject(value) {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
  }

  function createEmptyProject() {
    return normalizeProject(cloneJson(emptyProject));
  }

  function normalizeString(value, fieldName) {
    if (value === undefined || value === null) return "";
    if (typeof value !== "string") {
      throw new Error(`${fieldName} 항목은 글자여야 합니다.`);
    }
    return value;
  }

  function normalizeAvatar(value) {
    if (value === undefined || value === null || value === "") return "";

    if (typeof value === "string") {
      return value;
    }

    if (!isPlainObject(value)) {
      throw new Error("creator.avatar 항목의 형식이 올바르지 않습니다.");
    }

    const id = normalizeString(value.id, "creator.avatar.id").trim();
    const name = normalizeString(
      value.name || "profile.png",
      "creator.avatar.name"
    ).trim();
    const type = normalizeString(
      value.type || "image/png",
      "creator.avatar.type"
    ).trim();
    const size = Number(value.size || 0);
    const width = Number(value.width || 0);
    const height = Number(value.height || 0);
    const updatedAt = normalizeString(
      value.updatedAt || "",
      "creator.avatar.updatedAt"
    ).trim();

    if (!id) {
      throw new Error("creator.avatar.id가 비어 있습니다.");
    }

    if (type !== "image/png") {
      throw new Error("creator.avatar는 PNG 이미지여야 합니다.");
    }

    if (!Number.isFinite(size) || size < 0) {
      throw new Error("creator.avatar.size가 올바르지 않습니다.");
    }

    if (!Number.isFinite(width) || width < 0) {
      throw new Error("creator.avatar.width가 올바르지 않습니다.");
    }

    if (!Number.isFinite(height) || height < 0) {
      throw new Error("creator.avatar.height가 올바르지 않습니다.");
    }

    return {
      id,
      name: name || "profile.png",
      type: "image/png",
      size: Math.round(size),
      width: Math.round(width),
      height: Math.round(height),
      updatedAt
    };
  }

  function normalizeProject(rawProject) {
    if (!isPlainObject(rawProject)) {
      throw new Error("프로젝트 JSON의 최상위 값은 객체여야 합니다.");
    }

    const version = Number(rawProject.version);

    if (!Number.isInteger(version)) {
      throw new Error("프로젝트 버전 정보가 없습니다.");
    }

    if (version !== CURRENT_PROJECT_VERSION) {
      throw new Error(
        `지원하지 않는 프로젝트 버전입니다. 현재 지원 버전은 ${CURRENT_PROJECT_VERSION}입니다.`
      );
    }

    if (rawProject.site !== undefined && !isPlainObject(rawProject.site)) {
      throw new Error("site 항목의 형식이 올바르지 않습니다.");
    }

    if (rawProject.creator !== undefined && !isPlainObject(rawProject.creator)) {
      throw new Error("creator 항목의 형식이 올바르지 않습니다.");
    }

    if (rawProject.worlds !== undefined && !Array.isArray(rawProject.worlds)) {
      throw new Error("worlds 항목은 배열이어야 합니다.");
    }

    if (
      rawProject.characters !== undefined &&
      !Array.isArray(rawProject.characters)
    ) {
      throw new Error("characters 항목은 배열이어야 합니다.");
    }

    const base = cloneJson(emptyProject);
    const rawSite = rawProject.site || {};
    const rawCreator = rawProject.creator || {};

    if (rawCreator.bio !== undefined && !Array.isArray(rawCreator.bio)) {
      throw new Error("creator.bio 항목은 배열이어야 합니다.");
    }

    if (rawCreator.links !== undefined && !Array.isArray(rawCreator.links)) {
      throw new Error("creator.links 항목은 배열이어야 합니다.");
    }

    const bio = (rawCreator.bio || []).map((paragraph, index) =>
      normalizeString(paragraph, `creator.bio[${index}]`).trim()
    ).filter(Boolean);

    const links = (rawCreator.links || []).map((link, index) => {
      if (!isPlainObject(link)) {
        throw new Error(`creator.links[${index}] 항목의 형식이 올바르지 않습니다.`);
      }

      const id = normalizeString(
        link.id,
        `creator.links[${index}].id`
      ).trim();
      const url = normalizeString(
        link.url,
        `creator.links[${index}].url`
      ).trim();

      if (!id) {
        throw new Error(`creator.links[${index}]의 서비스 ID가 비어 있습니다.`);
      }

      if (!normalizeUrl(url)) {
        throw new Error(`creator.links[${index}]의 URL이 올바르지 않습니다.`);
      }

      return { id, url };
    });

    return {
      ...base,
      ...cloneJson(rawProject),
      version,
      site: {
        ...(base.site || {}),
        ...cloneJson(rawSite),
        title: normalizeString(rawSite.title, "site.title"),
        description: normalizeString(rawSite.description, "site.description")
      },
      creator: {
        ...(base.creator || {}),
        ...cloneJson(rawCreator),
        avatar: normalizeAvatar(rawCreator.avatar),
        fallbackText: normalizeString(
          rawCreator.fallbackText,
          "creator.fallbackText"
        ),
        name: normalizeString(rawCreator.name, "creator.name"),
        handle: normalizeString(rawCreator.handle, "creator.handle"),
        bio,
        links
      },
      worlds: cloneJson(rawProject.worlds || []),
      characters: cloneJson(rawProject.characters || [])
    };
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function bioTextToArray(value) {
    return value
      .split(/\n\s*\n/)
      .map((text) => text.trim())
      .filter(Boolean);
  }

  function bioArrayToText(value) {
    return Array.isArray(value) ? value.join("\n\n") : "";
  }

  function serviceIconUrl(service) {
    if (!service?.icon) return "";
    return `${ADMIN_ASSET_BASE}${service.icon}`;
  }

  function normalizeUrl(value) {
    const trimmed = String(value || "").trim();
    if (!trimmed) return "";

    try {
      const url = new URL(trimmed);
      if (!["http:", "https:"].includes(url.protocol)) return "";
      return url.href;
    } catch {
      return "";
    }
  }

  function formatBytes(size) {
    const bytes = Number(size) || 0;

    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }

  function getAvatarMetadata() {
    return isPlainObject(project.creator.avatar)
      ? project.creator.avatar
      : null;
  }

  function createImageId() {
    if (window.crypto?.randomUUID) {
      return `image-${window.crypto.randomUUID()}`;
    }

    return `image-${Date.now().toString(36)}-${Math.random()
      .toString(36)
      .slice(2, 10)}`;
  }

  function setSaveStatus(message) {
    elements.saveStatus.textContent = message;
  }

  function updateAvatarStorageStatus() {
    if (!elements.avatarStorageStatus) return;

    const metadata = getAvatarMetadata();

    if (avatarRestoreMissing) {
      elements.avatarStorageStatus.textContent =
        "저장된 PNG 파일을 찾을 수 없습니다. PNG를 다시 선택해 주세요.";
      return;
    }

    if (creatorAvatarBlob && metadata) {
      elements.avatarStorageStatus.textContent =
        `브라우저에 저장됨: ${metadata.name} · ${formatBytes(metadata.size)}`;
      return;
    }

    if (metadata) {
      elements.avatarStorageStatus.textContent = "저장된 PNG를 확인하는 중입니다.";
      return;
    }

    if (typeof project.creator.avatar === "string" && project.creator.avatar) {
      elements.avatarStorageStatus.textContent =
        "기존 이미지 경로는 브라우저 저장 이미지가 아닙니다. 새 PNG를 선택해 주세요.";
      return;
    }

    elements.avatarStorageStatus.textContent =
      "PNG는 이 브라우저에 저장되어 새로고침 후에도 유지됩니다. 최대 10MB.";
  }

  function openImageDatabase() {
    if (!window.indexedDB) {
      return Promise.reject(
        new Error("이 브라우저에서는 이미지 저장 기능을 사용할 수 없습니다.")
      );
    }

    if (imageDatabasePromise) return imageDatabasePromise;

    imageDatabasePromise = new Promise((resolve, reject) => {
      const request = window.indexedDB.open(IMAGE_DB_NAME, IMAGE_DB_VERSION);

      request.onupgradeneeded = () => {
        const database = request.result;

        if (!database.objectStoreNames.contains(IMAGE_STORE_NAME)) {
          database.createObjectStore(IMAGE_STORE_NAME, { keyPath: "id" });
        }
      };

      request.onsuccess = () => {
        const database = request.result;

        database.onversionchange = () => {
          database.close();
          imageDatabasePromise = null;
        };

        resolve(database);
      };

      request.onerror = () => {
        reject(request.error || new Error("이미지 저장소를 열지 못했습니다."));
      };

      request.onblocked = () => {
        reject(new Error("다른 탭에서 이미지 저장소를 사용 중입니다."));
      };
    }).catch((error) => {
      imageDatabasePromise = null;
      throw error;
    });

    return imageDatabasePromise;
  }

  async function getImageRecord(id) {
    if (!id) return null;
    const database = await openImageDatabase();

    return await new Promise((resolve, reject) => {
      const transaction = database.transaction(IMAGE_STORE_NAME, "readonly");
      const request = transaction.objectStore(IMAGE_STORE_NAME).get(id);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(
        request.error || new Error("저장된 이미지를 읽지 못했습니다.")
      );
      transaction.onabort = () => reject(
        transaction.error || new Error("이미지 읽기 작업이 중단되었습니다.")
      );
    });
  }

  async function putImageRecord(record) {
    const database = await openImageDatabase();

    return await new Promise((resolve, reject) => {
      const transaction = database.transaction(IMAGE_STORE_NAME, "readwrite");
      transaction.objectStore(IMAGE_STORE_NAME).put(record);

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(
        transaction.error || new Error("이미지를 저장하지 못했습니다.")
      );
      transaction.onabort = () => reject(
        transaction.error || new Error("이미지 저장 작업이 중단되었습니다.")
      );
    });
  }

  async function deleteImageRecord(id) {
    if (!id) return;
    const database = await openImageDatabase();

    return await new Promise((resolve, reject) => {
      const transaction = database.transaction(IMAGE_STORE_NAME, "readwrite");
      transaction.objectStore(IMAGE_STORE_NAME).delete(id);

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(
        transaction.error || new Error("저장된 이미지를 삭제하지 못했습니다.")
      );
      transaction.onabort = () => reject(
        transaction.error || new Error("이미지 삭제 작업이 중단되었습니다.")
      );
    });
  }

  async function clearImageRecords() {
    if (!window.indexedDB) return;
    const database = await openImageDatabase();

    return await new Promise((resolve, reject) => {
      const transaction = database.transaction(IMAGE_STORE_NAME, "readwrite");
      transaction.objectStore(IMAGE_STORE_NAME).clear();

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(
        transaction.error || new Error("저장 이미지를 초기화하지 못했습니다.")
      );
      transaction.onabort = () => reject(
        transaction.error || new Error("이미지 초기화 작업이 중단되었습니다.")
      );
    });
  }

  function saveProjectToStorage() {
    window.clearTimeout(autosaveTimer);
    autosaveTimer = 0;

    try {
      const normalizedProject = normalizeProject(project);
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(normalizedProject)
      );
      setSaveStatus("자동 저장됨");
      return true;
    } catch (error) {
      console.error(error);
      setSaveStatus("자동 저장 실패");
      return false;
    }
  }

  function scheduleAutosave() {
    setSaveStatus("변경사항 저장 중…");
    window.clearTimeout(autosaveTimer);
    autosaveTimer = window.setTimeout(
      saveProjectToStorage,
      AUTOSAVE_DELAY
    );
  }

  function loadProjectFromStorage() {
    try {
      const storedProject = window.localStorage.getItem(STORAGE_KEY);
      if (!storedProject) return;

      project = normalizeProject(JSON.parse(storedProject));
      restoredAutosave = true;
    } catch (error) {
      console.error(error);
      autosaveRestoreError = error.message || "임시 저장을 복구하지 못했습니다.";
      project = createEmptyProject();
    }
  }

  function clearStoredProject() {
    window.clearTimeout(autosaveTimer);
    autosaveTimer = 0;

    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.error(error);
    }
  }

  function markChanged() {
    renderPreview();
    scheduleAutosave();
  }

  function syncProjectFromFields() {
    project.site.title = elements.siteTitleInput.value.trim();
    project.site.description = elements.siteDescriptionInput.value.trim();

    project.creator.name = elements.creatorNameInput.value.trim();
    project.creator.handle = elements.creatorHandleInput.value.trim();
    project.creator.fallbackText = elements.creatorFallbackInput.value.trim();
    project.creator.bio = bioTextToArray(elements.creatorBioInput.value);

    markChanged();
  }

  function renderServiceOptions() {
    if (services.length === 0) {
      elements.socialServiceSelect.innerHTML =
        '<option value="">서비스 목록을 불러오지 못했습니다</option>';
      elements.socialServiceSelect.disabled = true;
      elements.addSocialLinkButton.disabled = true;
      showSocialError(
        "admin-catalog.js의 profileLinkServices 항목을 확인해 주세요."
      );
      return;
    }

    elements.socialServiceSelect.disabled = false;
    elements.addSocialLinkButton.disabled = false;

    elements.socialServiceSelect.innerHTML = services
      .map((service) => (
        `<option value="${escapeHtml(service.id)}">` +
        `${escapeHtml(service.name || service.id)}</option>`
      ))
      .join("");
  }

  function showSocialError(message = "") {
    elements.socialError.textContent = message;
    elements.socialError.hidden = !message;
  }

  function addSocialLink() {
    showSocialError();

    const id = elements.socialServiceSelect.value;
    const normalizedUrl = normalizeUrl(elements.socialUrlInput.value);

    if (!id) {
      showSocialError("서비스를 선택해 주세요.");
      return;
    }

    if (!normalizedUrl) {
      showSocialError("http:// 또는 https://로 시작하는 올바른 주소를 입력해 주세요.");
      elements.socialUrlInput.focus();
      return;
    }

    const existing = project.creator.links.find((link) => link.id === id);

    if (existing) {
      existing.url = normalizedUrl;
    } else {
      project.creator.links.push({
        id,
        url: normalizedUrl
      });
    }

    elements.socialUrlInput.value = "";
    renderSocialLinks();
    markChanged();
  }

  function removeSocialLink(id) {
    project.creator.links = project.creator.links.filter(
      (link) => link.id !== id
    );

    renderSocialLinks();
    markChanged();
  }

  function renderSocialLinks() {
    if (project.creator.links.length === 0) {
      elements.socialLinkList.innerHTML =
        '<p class="empty-message">등록된 링크가 없습니다.</p>';
      return;
    }

    elements.socialLinkList.innerHTML = project.creator.links
      .map((link) => {
        const service = serviceCatalog.get(link.id) || {
          id: link.id,
          name: link.id,
          icon: ""
        };

        const icon = service.icon
          ? `<img src="${escapeHtml(serviceIconUrl(service))}" alt="">`
          : `<span class="social-service-fallback" aria-hidden="true">` +
            `${escapeHtml((service.name || link.id).slice(0, 1))}</span>`;

        return `
          <article class="social-link-item">
            ${icon}
            <div class="social-link-copy">
              <strong>${escapeHtml(service.name || link.id)}</strong>
              <small>${escapeHtml(link.url)}</small>
            </div>
            <button
              class="social-link-remove"
              type="button"
              data-remove-social="${escapeHtml(link.id)}"
              aria-label="${escapeHtml(service.name || link.id)} 링크 삭제"
            >
              삭제
            </button>
          </article>
        `;
      })
      .join("");
  }

  function renderAvatarPreview() {
    const fallback =
      project.creator.fallbackText ||
      project.creator.name?.trim()?.slice(0, 1) ||
      "✦";

    elements.avatarEditorFallback.textContent = fallback;
    elements.previewAvatarFallback.textContent = fallback;

    const hasPreview = Boolean(creatorAvatarPreviewUrl);

    for (const image of [
      elements.avatarEditorPreview,
      elements.previewAvatarImage
    ]) {
      image.hidden = !hasPreview;
      if (hasPreview) {
        image.src = creatorAvatarPreviewUrl;
      } else {
        image.removeAttribute("src");
      }
    }

    elements.avatarEditorFallback.hidden = hasPreview;
    elements.previewAvatarFallback.hidden = hasPreview;
    elements.removeAvatarButton.hidden = !(
      hasPreview || getAvatarMetadata() || project.creator.avatar
    );

    elements.previewAvatarImage.alt = "";
    elements.previewAvatarImage.removeAttribute("title");
    elements.avatarEditorPreview.removeAttribute("title");

    updateAvatarStorageStatus();
  }

  function renderPreview() {
    const siteTitle = project.site.title || "사이트 제목";
    const creatorName = project.creator.name || "제작자 이름";

    elements.previewSiteTitle.textContent = siteTitle;
    elements.previewSiteDescription.textContent =
      project.site.description || "";
    elements.previewSiteDescription.hidden = !project.site.description;

    elements.previewCreatorName.textContent = creatorName;
    elements.previewCreatorHandle.textContent =
      project.creator.handle || "";
    elements.previewCreatorHandle.hidden = !project.creator.handle;

    elements.previewCreatorBio.innerHTML = project.creator.bio
      .map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`)
      .join("");
    elements.previewCreatorBio.hidden = project.creator.bio.length === 0;

    elements.previewCreatorLinks.innerHTML = project.creator.links
      .map((link) => {
        const service = serviceCatalog.get(link.id) || {
          id: link.id,
          name: link.id,
          icon: ""
        };

        const icon = service.icon
          ? `<img src="${escapeHtml(serviceIconUrl(service))}" alt="">`
          : `<span aria-hidden="true">` +
            `${escapeHtml((service.name || link.id).slice(0, 1))}</span>`;

        return `
          <a
            class="preview-social-link"
            href="${escapeHtml(link.url)}"
            target="_blank"
            rel="noreferrer"
            title="${escapeHtml(service.name || link.id)}"
            aria-label="${escapeHtml(service.name || link.id)} 열기"
          >
            ${icon}
          </a>
        `;
      })
      .join("");
    elements.previewCreatorLinks.hidden =
      project.creator.links.length === 0;

    renderAvatarPreview();

    document.title = `${siteTitle} | 포트폴리오 생성기`;
  }

  function populateFieldsFromProject() {
    elements.siteTitleInput.value = project.site.title || "";
    elements.siteDescriptionInput.value = project.site.description || "";
    elements.creatorNameInput.value = project.creator.name || "";
    elements.creatorHandleInput.value = project.creator.handle || "";
    elements.creatorFallbackInput.value =
      project.creator.fallbackText || "";
    elements.creatorBioInput.value =
      bioArrayToText(project.creator.bio);
  }

  function releaseAvatarObjectUrl() {
    if (creatorAvatarPreviewUrl) {
      URL.revokeObjectURL(creatorAvatarPreviewUrl);
    }

    creatorAvatarBlob = null;
    creatorAvatarPreviewUrl = "";
    elements.avatarInput.value = "";
  }

  async function validatePngFile(file) {
    if (!file || file.size <= 0) {
      throw new Error("비어 있는 이미지 파일은 사용할 수 없습니다.");
    }

    if (file.size > MAX_AVATAR_FILE_BYTES) {
      throw new Error("프로필 PNG는 10MB 이하만 사용할 수 있습니다.");
    }

    if (file.type && file.type !== "image/png") {
      throw new Error("PNG 파일만 선택할 수 있습니다.");
    }

    const signature = new Uint8Array(
      await file.slice(0, PNG_SIGNATURE.length).arrayBuffer()
    );

    const isPng = PNG_SIGNATURE.every(
      (byte, index) => signature[index] === byte
    );

    if (!isPng) {
      throw new Error("PNG 형식이 아닌 파일입니다.");
    }
  }

  async function sanitizePng(file) {
    await validatePngFile(file);
    const sourceUrl = URL.createObjectURL(file);

    try {
      const image = new Image();
      image.decoding = "async";

      await new Promise((resolve, reject) => {
        image.onload = resolve;
        image.onerror = () => reject(
          new Error("PNG 이미지를 읽을 수 없습니다.")
        );
        image.src = sourceUrl;
      });

      if (!image.naturalWidth || !image.naturalHeight) {
        throw new Error("이미지 크기를 확인할 수 없습니다.");
      }

      const canvas = document.createElement("canvas");
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;

      const context = canvas.getContext("2d", { alpha: true });

      if (!context) {
        throw new Error("이미지 변환 기능을 사용할 수 없습니다.");
      }

      context.drawImage(image, 0, 0);

      const blob = await new Promise((resolve, reject) => {
        canvas.toBlob((result) => {
          if (result) resolve(result);
          else reject(new Error("PNG 변환에 실패했습니다."));
        }, "image/png");
      });

      if (blob.size > MAX_AVATAR_FILE_BYTES) {
        throw new Error("변환된 프로필 PNG가 10MB를 초과합니다.");
      }

      return {
        blob,
        width: image.naturalWidth,
        height: image.naturalHeight
      };
    } finally {
      URL.revokeObjectURL(sourceUrl);
    }
  }

  async function restoreAvatarFromDatabase() {
    releaseAvatarObjectUrl();
    avatarRestoreMissing = false;

    const metadata = getAvatarMetadata();

    if (!metadata?.id) {
      renderPreview();
      return false;
    }

    try {
      const record = await getImageRecord(metadata.id);

      if (!record?.blob || record.blob.type !== "image/png") {
        avatarRestoreMissing = true;
        renderPreview();
        return false;
      }

      creatorAvatarBlob = record.blob;
      creatorAvatarPreviewUrl = URL.createObjectURL(record.blob);
      renderPreview();
      return true;
    } catch (error) {
      console.error(error);
      avatarRestoreMissing = true;
      renderPreview();
      return false;
    }
  }

  async function handleAvatarSelection() {
    const file = elements.avatarInput.files?.[0] || null;

    if (!file) return;

    elements.avatarInput.disabled = true;
    setSaveStatus("프로필 PNG 저장 중…");

    try {
      const previousMetadata = getAvatarMetadata();
      const sanitized = await sanitizePng(file);
      const id = createImageId();
      const updatedAt = new Date().toISOString();
      const record = {
        id,
        role: "creator-avatar",
        name: file.name || "profile.png",
        type: "image/png",
        size: sanitized.blob.size,
        width: sanitized.width,
        height: sanitized.height,
        updatedAt,
        blob: sanitized.blob
      };

      await putImageRecord(record);

      project.creator.avatar = {
        id,
        name: record.name,
        type: record.type,
        size: record.size,
        width: record.width,
        height: record.height,
        updatedAt
      };

      releaseAvatarObjectUrl();
      creatorAvatarBlob = sanitized.blob;
      creatorAvatarPreviewUrl = URL.createObjectURL(sanitized.blob);
      avatarRestoreMissing = false;

      if (previousMetadata?.id && previousMetadata.id !== id) {
        try {
          await deleteImageRecord(previousMetadata.id);
        } catch (cleanupError) {
          console.error(cleanupError);
        }
      }

      renderPreview();
      saveProjectToStorage();
      setSaveStatus("프로필 PNG가 브라우저에 저장됨");
    } catch (error) {
      elements.avatarInput.value = "";
      console.error(error);
      window.alert(error.message || "이미지를 처리하지 못했습니다.");
      setSaveStatus("프로필 PNG 저장 실패");
    } finally {
      elements.avatarInput.disabled = false;
    }
  }

  async function removeAvatar() {
    const metadata = getAvatarMetadata();

    releaseAvatarObjectUrl();
    avatarRestoreMissing = false;
    project.creator.avatar = "";
    renderPreview();
    saveProjectToStorage();

    if (metadata?.id) {
      try {
        await deleteImageRecord(metadata.id);
      } catch (error) {
        console.error(error);
        setSaveStatus("PNG 연결은 제거됐지만 저장 파일 정리에 실패함");
        return;
      }
    }

    setSaveStatus("프로필 PNG가 제거됨");
  }

  async function replaceCurrentProject(nextProject, restoreAvatar = true) {
    project = normalizeProject(nextProject);
    releaseAvatarObjectUrl();
    avatarRestoreMissing = false;
    populateFieldsFromProject();
    renderSocialLinks();
    renderPreview();

    if (!restoreAvatar) return false;
    return await restoreAvatarFromDatabase();
  }

  function buildDownloadFilename() {
    const baseName = (project.site.title || "portfolio-project")
      .trim()
      .replace(/[\\/:*?"<>|]+/g, "-")
      .replace(/\s+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80);

    return `${baseName || "portfolio-project"}.json`;
  }

  function downloadProject() {
    window.clearTimeout(autosaveTimer);
    autosaveTimer = 0;

    try {
      const normalizedProject = normalizeProject(project);
      const blob = new Blob(
        [JSON.stringify(normalizedProject, null, 2)],
        { type: "application/json;charset=utf-8" }
      );
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");

      anchor.href = url;
      anchor.download = buildDownloadFilename();
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);

      saveProjectToStorage();
      setSaveStatus(
        getAvatarMetadata()
          ? "프로젝트 JSON 저장됨 · PNG는 이 브라우저에 유지됨"
          : "프로젝트 JSON 저장됨"
      );
    } catch (error) {
      console.error(error);
      window.alert(error.message || "프로젝트를 저장하지 못했습니다.");
      setSaveStatus("프로젝트 저장 실패");
    }
  }

  async function importProjectFile() {
    const file = elements.importProjectInput.files?.[0] || null;
    elements.importProjectInput.value = "";

    if (!file) return;

    try {
      const text = await file.text();
      const nextProject = normalizeProject(JSON.parse(text));
      const confirmed = window.confirm(
        "현재 입력 내용을 불러온 프로젝트로 교체할까요?"
      );

      if (!confirmed) return;

      const restoredAvatar = await replaceCurrentProject(nextProject);
      saveProjectToStorage();

      if (getAvatarMetadata() && !restoredAvatar) {
        setSaveStatus("프로젝트 불러옴 · PNG를 다시 선택해 주세요");
      } else {
        setSaveStatus("프로젝트 불러오기 완료");
      }
    } catch (error) {
      console.error(error);
      window.alert(error.message || "프로젝트 JSON을 불러오지 못했습니다.");
      setSaveStatus("프로젝트 불러오기 실패");
    }
  }

  async function resetProject() {
    const confirmed = window.confirm(
      "현재 입력한 제작자 프로필, 자동 저장 데이터와 저장된 PNG를 모두 초기화할까요?"
    );

    if (!confirmed) return;

    clearStoredProject();
    releaseAvatarObjectUrl();
    avatarRestoreMissing = false;

    try {
      await clearImageRecords();
    } catch (error) {
      console.error(error);
      window.alert(
        "입력은 초기화하지만 브라우저의 저장 이미지 일부를 정리하지 못했습니다."
      );
    }

    await replaceCurrentProject(createEmptyProject(), false);
    setSaveStatus("입력, 자동 저장 데이터와 PNG가 초기화됨");
  }

  elements.profileForm.addEventListener("input", (event) => {
    if (event.target === elements.avatarInput) return;
    syncProjectFromFields();
  });

  elements.addSocialLinkButton.addEventListener(
    "click",
    addSocialLink
  );

  elements.socialUrlInput.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    addSocialLink();
  });

  elements.socialLinkList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-remove-social]");
    if (!button) return;
    removeSocialLink(button.dataset.removeSocial);
  });

  elements.avatarInput.addEventListener(
    "change",
    handleAvatarSelection
  );

  elements.removeAvatarButton.addEventListener(
    "click",
    removeAvatar
  );

  elements.downloadProjectButton.addEventListener(
    "click",
    downloadProject
  );

  elements.importProjectInput.addEventListener(
    "change",
    importProjectFile
  );

  elements.resetProjectButton.addEventListener(
    "click",
    resetProject
  );

  window.addEventListener("beforeunload", () => {
    if (autosaveTimer) {
      saveProjectToStorage();
    }

    releaseAvatarObjectUrl();
  });

  async function initialize() {
    loadProjectFromStorage();
    renderServiceOptions();
    populateFieldsFromProject();
    renderSocialLinks();
    renderPreview();

    const avatarMetadata = getAvatarMetadata();
    const restoredAvatar = avatarMetadata
      ? await restoreAvatarFromDatabase()
      : false;

    if (autosaveRestoreError) {
      setSaveStatus("자동 저장 복구 실패");
      window.setTimeout(() => {
        window.alert(autosaveRestoreError);
      }, 0);
      return;
    }

    if (avatarMetadata && !restoredAvatar) {
      setSaveStatus(
        restoredAutosave
          ? "이전 자동 저장 복구됨 · PNG를 다시 선택해 주세요"
          : "PNG를 다시 선택해 주세요"
      );
      return;
    }

    if (restoredAutosave && restoredAvatar) {
      setSaveStatus("이전 자동 저장과 PNG를 복구함");
    } else if (restoredAutosave) {
      setSaveStatus("이전 자동 저장을 복구함");
    } else {
      setSaveStatus("자동 저장 준비됨");
    }
  }

  initialize().catch((error) => {
    console.error(error);
    setSaveStatus("생성기 초기화 실패");
    window.alert(error.message || "생성기를 초기화하지 못했습니다.");
  });
})();
