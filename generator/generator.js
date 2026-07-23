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
  const adminCatalog = window.ADMIN_CATALOG || ADMIN_FALLBACK;

  const project = JSON.parse(JSON.stringify(emptyProject));

  project.site ||= {};
  project.creator ||= {};
  project.creator.bio = Array.isArray(project.creator.bio)
    ? project.creator.bio
    : [];
  project.creator.links = Array.isArray(project.creator.links)
    ? project.creator.links
    : [];

  const services = Array.isArray(adminCatalog.profileLinkServices)
    ? adminCatalog.profileLinkServices
    : [];

  const serviceCatalog = new Map(
    services.map((service) => [service.id, service])
  );

  const ADMIN_ASSET_BASE = "../template/images/";

  let creatorAvatarFile = null;
  let creatorAvatarPreviewUrl = "";

  const elements = {
    profileForm: document.querySelector("#profileForm"),
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

    projectJsonPreview: document.querySelector("#projectJsonPreview"),
    saveStatus: document.querySelector("#saveStatus")
  };

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

  function markChanged() {
    elements.saveStatus.textContent = "미리보기 반영됨";
    window.clearTimeout(markChanged.timer);
    markChanged.timer = window.setTimeout(() => {
      elements.saveStatus.textContent = "입력 대기 중";
    }, 1200);
  }

  function syncProjectFromFields() {
    project.site.title = elements.siteTitleInput.value.trim();
    project.site.description = elements.siteDescriptionInput.value.trim();

    project.creator.name = elements.creatorNameInput.value.trim();
    project.creator.handle = elements.creatorHandleInput.value.trim();
    project.creator.fallbackText = elements.creatorFallbackInput.value.trim();
    project.creator.bio = bioTextToArray(elements.creatorBioInput.value);

    renderPreview();
    markChanged();
  }

  function renderServiceOptions() {
    if (services.length === 0) {
      elements.socialServiceSelect.innerHTML =
        '<option value="">등록된 서비스가 없습니다</option>';
      elements.socialServiceSelect.disabled = true;
      elements.addSocialLinkButton.disabled = true;
      return;
    }

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

  function normalizeUrl(value) {
    const trimmed = value.trim();
    if (!trimmed) return "";

    try {
      const url = new URL(trimmed);
      if (!["http:", "https:"].includes(url.protocol)) return "";
      return url.href;
    } catch {
      return "";
    }
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
    renderPreview();
    markChanged();
  }

  function removeSocialLink(id) {
    project.creator.links = project.creator.links.filter(
      (link) => link.id !== id
    );

    renderSocialLinks();
    renderPreview();
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
    elements.removeAvatarButton.hidden = !hasPreview;

    elements.previewAvatarImage.alt = project.creator.name
      ? `${project.creator.name} 프로필 이미지`
      : "제작자 프로필 이미지";
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

    const serializableProject = JSON.parse(JSON.stringify(project));
    if (creatorAvatarFile) {
      serializableProject.creator.avatar =
        `[선택된 파일: ${creatorAvatarFile.name}]`;
    }

    elements.projectJsonPreview.textContent =
      JSON.stringify(serializableProject, null, 2);

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

  function handleAvatarSelection() {
    const file = elements.avatarInput.files?.[0] || null;

    if (!file) return;

    if (file.type !== "image/png") {
      elements.avatarInput.value = "";
      window.alert("PNG 파일만 선택할 수 있습니다.");
      return;
    }

    if (creatorAvatarPreviewUrl) {
      URL.revokeObjectURL(creatorAvatarPreviewUrl);
    }

    creatorAvatarFile = file;
    creatorAvatarPreviewUrl = URL.createObjectURL(file);

    renderPreview();
    markChanged();
  }

  function removeAvatar() {
    if (creatorAvatarPreviewUrl) {
      URL.revokeObjectURL(creatorAvatarPreviewUrl);
    }

    creatorAvatarFile = null;
    creatorAvatarPreviewUrl = "";
    elements.avatarInput.value = "";

    renderPreview();
    markChanged();
  }

  function resetProject() {
    const confirmed = window.confirm(
      "현재 입력한 제작자 프로필을 모두 초기화할까요?"
    );

    if (!confirmed) return;

    const freshProject = JSON.parse(JSON.stringify(emptyProject));

    project.version = freshProject.version ?? 1;
    project.site = freshProject.site || {};
    project.creator = freshProject.creator || {};
    project.creator.bio = Array.isArray(project.creator.bio)
      ? project.creator.bio
      : [];
    project.creator.links = Array.isArray(project.creator.links)
      ? project.creator.links
      : [];
    project.worlds = freshProject.worlds || [];
    project.characters = freshProject.characters || [];

    removeAvatar();
    populateFieldsFromProject();
    renderSocialLinks();
    renderPreview();
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

  elements.resetProjectButton.addEventListener(
    "click",
    resetProject
  );

  window.addEventListener("beforeunload", () => {
    if (creatorAvatarPreviewUrl) {
      URL.revokeObjectURL(creatorAvatarPreviewUrl);
    }
  });

  renderServiceOptions();
  populateFieldsFromProject();
  renderSocialLinks();
  renderPreview();
})();
