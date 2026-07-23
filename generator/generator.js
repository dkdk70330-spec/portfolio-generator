(() => {
  "use strict";

  const EMPTY_FALLBACK = {
    version: 1,
    site: { title: "", description: "" },
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
    profileLinkServices: [],
    platforms: [],
    genres: []
  };

  const emptyProject =
    window.EMPTY_PROJECT ||
    (typeof EMPTY_PROJECT !== "undefined" ? EMPTY_PROJECT : null) ||
    EMPTY_FALLBACK;

  const adminCatalog =
    window.ADMIN_CATALOG ||
    (typeof ADMIN_CATALOG !== "undefined" ? ADMIN_CATALOG : null) ||
    ADMIN_FALLBACK;

  const project = JSON.parse(JSON.stringify(emptyProject));

  project.site ||= {};
  project.creator ||= {};
  project.creator.bio = arrayValue(project.creator.bio);
  project.creator.links = arrayValue(project.creator.links);
  project.worlds = arrayValue(project.worlds);
  project.characters = arrayValue(project.characters);

  const admin = {
    profileLinkServices: arrayValue(adminCatalog.profileLinkServices),
    platforms: arrayValue(adminCatalog.platforms),
    genres: arrayValue(adminCatalog.genres)
  };

  const profileServiceCatalog = new Map(
    admin.profileLinkServices.map((item) => [item.id, item])
  );
  const platformCatalog = new Map(
    admin.platforms.map((item) => [item.id, item])
  );

  const ADMIN_IMAGE_BASE = "./template/images/";

  const media = {
    avatar: null,
    worlds: new Map(),
    characters: new Map()
  };

  const state = {
    activeTab: "profile",
    selectedWorldId: null,
    selectedCharacterId: null,
    previewTheme: "dark",
    previewAllCharacters: false
  };

  const elements = {
    tabs: [...document.querySelectorAll("[data-editor-tab]")],
    panels: [...document.querySelectorAll("[data-editor-panel]")],

    worldTabCount: document.querySelector("#worldTabCount"),
    characterTabCount: document.querySelector("#characterTabCount"),
    featuredCount: document.querySelector("#featuredCount"),
    sessionStatus: document.querySelector("#sessionStatus"),
    previewStatus: document.querySelector("#previewStatus"),

    resetProjectButton: document.querySelector("#resetProjectButton"),

    profileForm: document.querySelector("#profileForm"),
    siteTitleInput: document.querySelector("#siteTitleInput"),
    siteDescriptionInput: document.querySelector("#siteDescriptionInput"),
    creatorNameInput: document.querySelector("#creatorNameInput"),
    creatorHandleInput: document.querySelector("#creatorHandleInput"),
    creatorFallbackInput: document.querySelector("#creatorFallbackInput"),
    creatorBioInput: document.querySelector("#creatorBioInput"),

    avatarInput: document.querySelector("#avatarInput"),
    avatarEditorImage: document.querySelector("#avatarEditorImage"),
    avatarEditorFallback: document.querySelector("#avatarEditorFallback"),
    removeAvatarButton: document.querySelector("#removeAvatarButton"),

    socialServiceSelect: document.querySelector("#socialServiceSelect"),
    socialUrlInput: document.querySelector("#socialUrlInput"),
    addSocialLinkButton: document.querySelector("#addSocialLinkButton"),
    socialError: document.querySelector("#socialError"),
    socialLinkList: document.querySelector("#socialLinkList"),

    addWorldButton: document.querySelector("#addWorldButton"),
    worldList: document.querySelector("#worldList"),
    worldEditor: document.querySelector("#worldEditor"),

    addCharacterButton: document.querySelector("#addCharacterButton"),
    characterList: document.querySelector("#characterList"),
    characterEditor: document.querySelector("#characterEditor"),

    previewRoot: document.querySelector("#previewRoot")
  };

  function arrayValue(value) {
    return Array.isArray(value) ? value : [];
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function makeId(prefix) {
    if (crypto?.randomUUID) {
      return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
    }

    return `${prefix}-${Date.now().toString(36)}-${Math.random()
      .toString(36)
      .slice(2, 7)}`;
  }

  function deepClone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function textToParagraphs(value) {
    return String(value ?? "")
      .split(/\n\s*\n/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  function paragraphsToText(value) {
    return arrayValue(value).join("\n\n");
  }

  function textToTags(value) {
    return [...new Set(
      String(value ?? "")
        .split(/[,\n]/)
        .map((item) => item.trim())
        .filter(Boolean)
    )];
  }

  function tagsToText(value) {
    return arrayValue(value).join(", ");
  }

  function validHttpUrl(value) {
    try {
      const url = new URL(String(value ?? "").trim());
      return ["http:", "https:"].includes(url.protocol) ? url.href : "";
    } catch {
      return "";
    }
  }

  function markChanged() {
    elements.previewStatus.textContent = "프로젝트 반영됨";
    elements.sessionStatus.textContent = "저장되지 않은 세션 데이터";

    clearTimeout(markChanged.timer);
    markChanged.timer = setTimeout(() => {
      elements.previewStatus.textContent = "입력 대기 중";
    }, 1200);
  }

  function adminImageUrl(path) {
    return path ? `${ADMIN_IMAGE_BASE}${path}` : "";
  }

  function iconMarkup(item, className) {
    const name = item?.name || item?.id || "?";
    const image = item?.icon
      ? `<img src="${escapeHtml(adminImageUrl(item.icon))}" alt="" data-icon-image>`
      : "";

    return `
      <span class="${className}" title="${escapeHtml(name)}">
        ${image}
        <span class="preview-fallback-icon" ${item?.icon ? "hidden" : ""}>
          ${escapeHtml(name.slice(0, 1))}
        </span>
      </span>
    `;
  }

  async function sanitizePng(file) {
    if (!file) throw new Error("이미지 파일이 없습니다.");

    const pngType = file.type === "image/png";
    const pngExtension = /\.png$/i.test(file.name || "");

    if (!pngType && !pngExtension) {
      throw new Error("PNG 파일만 업로드할 수 있습니다.");
    }

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

      const canvas = document.createElement("canvas");
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;

      const context = canvas.getContext("2d", { alpha: true });
      if (!context) {
        throw new Error("이미지 변환 기능을 사용할 수 없습니다.");
      }

      context.drawImage(image, 0, 0);

      return await new Promise((resolve, reject) => {
        canvas.toBlob((blob) => {
          if (blob) resolve(blob);
          else reject(new Error("PNG 재인코딩에 실패했습니다."));
        }, "image/png");
      });
    } finally {
      URL.revokeObjectURL(sourceUrl);
    }
  }

  function createMediaEntry(blob) {
    return {
      id: makeId("media"),
      blob,
      url: URL.createObjectURL(blob)
    };
  }

  function releaseMediaEntry(entry) {
    if (entry?.url) URL.revokeObjectURL(entry.url);
  }

  function releaseAllMedia() {
    releaseMediaEntry(media.avatar);
    media.worlds.forEach(releaseMediaEntry);
    media.characters.forEach((items) => items.forEach(releaseMediaEntry));
  }

  function setActiveTab(tab) {
    state.activeTab = tab;

    elements.tabs.forEach((button) => {
      button.classList.toggle("is-active", button.dataset.editorTab === tab);
    });

    elements.panels.forEach((panel) => {
      const active = panel.dataset.editorPanel === tab;
      panel.classList.toggle("is-active", active);
      panel.hidden = !active;
    });
  }

  function renderCounts() {
    elements.worldTabCount.textContent = project.worlds.length;
    elements.characterTabCount.textContent = project.characters.length;

    const featured = project.characters.filter((item) => item.featured).length;
    elements.featuredCount.textContent = `${featured} / 3`;
  }

  function syncProfileFields() {
    elements.siteTitleInput.value = project.site.title || "";
    elements.siteDescriptionInput.value = project.site.description || "";
    elements.creatorNameInput.value = project.creator.name || "";
    elements.creatorHandleInput.value = project.creator.handle || "";
    elements.creatorFallbackInput.value = project.creator.fallbackText || "";
    elements.creatorBioInput.value = paragraphsToText(project.creator.bio);
  }

  function updateProjectFromProfile() {
    project.site.title = elements.siteTitleInput.value.trim();
    project.site.description = elements.siteDescriptionInput.value.trim();

    project.creator.name = elements.creatorNameInput.value.trim();
    project.creator.handle = elements.creatorHandleInput.value.trim();
    project.creator.fallbackText = elements.creatorFallbackInput.value.trim();
    project.creator.bio = textToParagraphs(elements.creatorBioInput.value);

    renderAvatarEditor();
    renderPreview();
    markChanged();
  }

  function renderAvatarEditor() {
    const fallback =
      project.creator.fallbackText ||
      project.creator.name?.trim()?.slice(0, 1) ||
      "✦";

    elements.avatarEditorFallback.textContent = fallback;

    if (media.avatar) {
      elements.avatarEditorImage.src = media.avatar.url;
      elements.avatarEditorImage.alt = "";
      elements.avatarEditorImage.hidden = false;
      elements.avatarEditorFallback.hidden = true;
      elements.removeAvatarButton.hidden = false;
    } else {
      elements.avatarEditorImage.hidden = true;
      elements.avatarEditorImage.removeAttribute("src");
      elements.avatarEditorFallback.hidden = false;
      elements.removeAvatarButton.hidden = true;
    }

    elements.avatarEditorImage.removeAttribute("title");
  }

  function renderSocialServiceOptions() {
    if (admin.profileLinkServices.length === 0) {
      elements.socialServiceSelect.innerHTML =
        '<option value="">관리자 서비스 목록 없음</option>';
      elements.socialServiceSelect.disabled = true;
      elements.addSocialLinkButton.disabled = true;
      showSocialError(
        "shared/admin-catalog.js에 profileLinkServices를 등록해야 합니다."
      );
      return;
    }

    elements.socialServiceSelect.disabled = false;
    elements.addSocialLinkButton.disabled = false;
    elements.socialServiceSelect.innerHTML = admin.profileLinkServices
      .map((service) => `
        <option value="${escapeHtml(service.id)}">
          ${escapeHtml(service.name)}
        </option>
      `)
      .join("");
  }

  function showSocialError(message = "") {
    elements.socialError.textContent = message;
    elements.socialError.hidden = !message;
  }

  function addSocialLink() {
    showSocialError();

    const id = elements.socialServiceSelect.value;
    const url = validHttpUrl(elements.socialUrlInput.value);

    if (!profileServiceCatalog.has(id)) {
      showSocialError("관리자가 제공한 서비스를 선택해 주세요.");
      return;
    }

    if (!url) {
      showSocialError("http:// 또는 https://로 시작하는 주소를 입력해 주세요.");
      elements.socialUrlInput.focus();
      return;
    }

    const existing = project.creator.links.find((link) => link.id === id);
    if (existing) existing.url = url;
    else project.creator.links.push({ id, url });

    elements.socialUrlInput.value = "";
    renderSocialLinks();
    renderPreview();
    markChanged();
  }

  function renderSocialLinks() {
    if (project.creator.links.length === 0) {
      elements.socialLinkList.innerHTML =
        '<div class="empty-record">선택한 소셜 링크가 없습니다.</div>';
      return;
    }

    elements.socialLinkList.innerHTML = project.creator.links
      .map((link) => {
        const service = profileServiceCatalog.get(link.id);
        if (!service) return "";

        return `
          <article class="record-card">
            <button class="record-main" type="button" tabindex="-1">
              <strong>${escapeHtml(service.name)}</strong>
              <small>${escapeHtml(link.url)}</small>
            </button>
            <div class="record-actions">
              <button
                class="icon-action"
                type="button"
                data-social-remove="${escapeHtml(link.id)}"
                aria-label="${escapeHtml(service.name)} 링크 삭제"
              >
                ×
              </button>
            </div>
          </article>
        `;
      })
      .join("");
  }

  function newWorld() {
    return {
      id: makeId("world"),
      name: "",
      subtitle: "",
      image: "",
      tags: [],
      description: [],
      sections: []
    };
  }

  function addWorld() {
    const world = newWorld();
    project.worlds.push(world);
    state.selectedWorldId = world.id;
    setActiveTab("worlds");
    renderWorldManager();
    renderPreview();
    markChanged();
  }

  function selectedWorld() {
    return project.worlds.find((item) => item.id === state.selectedWorldId) || null;
  }

  function worldCharacters(worldId) {
    return project.characters.filter((character) => character.worldId === worldId);
  }

  function renderWorldList() {
    if (project.worlds.length === 0) {
      elements.worldList.innerHTML =
        '<div class="empty-record">등록된 세계관이 없습니다.</div>';
      return;
    }

    elements.worldList.innerHTML = project.worlds
      .map((world, index) => {
        const selected = world.id === state.selectedWorldId;
        const count = worldCharacters(world.id).length;

        return `
          <article class="record-card ${selected ? "is-selected" : ""}">
            <button
              class="record-main"
              type="button"
              data-world-select="${escapeHtml(world.id)}"
            >
              <strong>${escapeHtml(world.name || "이름 없는 세계관")}</strong>
              <small>연결된 캐릭터 ${count}명</small>
            </button>
            <div class="record-actions">
              <button class="icon-action" type="button"
                data-world-move="${escapeHtml(world.id)}"
                data-direction="-1"
                aria-label="위로 이동"
                ${index === 0 ? "disabled" : ""}>↑</button>
              <button class="icon-action" type="button"
                data-world-move="${escapeHtml(world.id)}"
                data-direction="1"
                aria-label="아래로 이동"
                ${index === project.worlds.length - 1 ? "disabled" : ""}>↓</button>
            </div>
          </article>
        `;
      })
      .join("");
  }

  function renderWorldEditor() {
    const world = selectedWorld();

    if (!world) {
      elements.worldEditor.className = "manager-editor-column empty-editor";
      elements.worldEditor.innerHTML =
        "<p>세계관을 추가하거나 목록에서 선택하세요.</p>";
      return;
    }

    elements.worldEditor.className = "manager-editor-column";

    const image = media.worlds.get(world.id);
    const connected = worldCharacters(world.id);

    const sectionMarkup = arrayValue(world.sections)
      .map((section, index) => `
        <article class="dynamic-box" data-world-section="${index}">
          <div class="dynamic-box-header">
            <strong>추가 섹션 ${index + 1}</strong>
            <div class="dynamic-box-actions">
              <button class="icon-action" type="button"
                data-world-section-move="${index}"
                data-direction="-1"
                ${index === 0 ? "disabled" : ""}>↑</button>
              <button class="icon-action" type="button"
                data-world-section-move="${index}"
                data-direction="1"
                ${index === world.sections.length - 1 ? "disabled" : ""}>↓</button>
              <button class="icon-action" type="button"
                data-world-section-remove="${index}"
                aria-label="섹션 삭제">×</button>
            </div>
          </div>

          <label class="field">
            <span>제목</span>
            <input type="text"
              data-world-section-field="title"
              data-index="${index}"
              value="${escapeHtml(section.title || "")}">
          </label>

          <label class="field">
            <span>내용</span>
            <textarea rows="4"
              data-world-section-field="content"
              data-index="${index}">${escapeHtml(paragraphsToText(section.content))}</textarea>
          </label>
        </article>
      `)
      .join("");

    elements.worldEditor.innerHTML = `
      <form class="editor-form" id="worldEditForm" novalidate>
        <section class="editor-section">
          <div class="editor-section-heading">
            <h3>기본 정보</h3>
            <span class="admin-lock">사용자 작성 데이터</span>
          </div>

          <div class="image-upload-row">
            <div class="editor-avatar">
              ${image
                ? `<img src="${escapeHtml(image.url)}" alt="">`
                : `<span>WORLD</span>`}
            </div>
            <div class="image-upload-copy">
              <label class="button button--outline file-button">
                대표 이미지 PNG
                <input class="visually-hidden"
                  type="file"
                  accept="image/png"
                  data-world-image-input>
              </label>
              <p>원본 파일명과 PNG 메타데이터는 보관하지 않습니다.</p>
              ${image
                ? `<button class="text-button text-button--danger"
                    type="button"
                    data-world-image-remove>이미지 제거</button>`
                : ""}
            </div>
          </div>

          <div class="field-grid field-grid--two">
            <label class="field">
              <span>세계관 이름</span>
              <input type="text"
                data-world-field="name"
                maxlength="80"
                value="${escapeHtml(world.name || "")}">
            </label>

            <label class="field">
              <span>부제</span>
              <input type="text"
                data-world-field="subtitle"
                maxlength="140"
                value="${escapeHtml(world.subtitle || "")}">
            </label>
          </div>

          <label class="field">
            <span>태그</span>
            <input type="text"
              data-world-field="tags"
              value="${escapeHtml(tagsToText(world.tags))}"
              placeholder="쉼표로 구분">
          </label>

          <label class="field">
            <span>소개 문단</span>
            <textarea rows="6"
              data-world-field="description"
              placeholder="빈 줄을 기준으로 문단이 나뉩니다.">${escapeHtml(paragraphsToText(world.description))}</textarea>
          </label>
        </section>

        <section class="editor-section">
          <div class="editor-section-heading">
            <h3>추가 섹션</h3>
            <button class="button button--outline button--small"
              type="button"
              data-world-section-add>섹션 추가</button>
          </div>
          <div class="dynamic-list">
            ${sectionMarkup || '<div class="empty-record">추가 섹션이 없습니다.</div>'}
          </div>
        </section>

        <section class="editor-section">
          <div class="editor-section-heading">
            <h3>연결된 캐릭터</h3>
            <span>${connected.length}명</span>
          </div>
          <div class="connected-list">
            ${connected.length
              ? connected.map((character) => `
                  <span class="connected-chip">
                    ${escapeHtml(character.name || "이름 없는 캐릭터")}
                  </span>
                `).join("")
              : '<span class="connected-chip">연결된 캐릭터 없음</span>'}
          </div>
        </section>

        <section class="editor-section danger-zone">
          <p>
            삭제하면 연결된 캐릭터는 자동으로 ‘독립 캐릭터’가 됩니다.
          </p>
          <button class="button button--outline button--small"
            type="button"
            data-world-delete>
            세계관 삭제
          </button>
        </section>
      </form>
    `;
  }

  function renderWorldManager() {
    renderCounts();
    renderWorldList();
    renderWorldEditor();
  }

  function moveWorld(id, direction) {
    const index = project.worlds.findIndex((item) => item.id === id);
    const nextIndex = index + Number(direction);

    if (index < 0 || nextIndex < 0 || nextIndex >= project.worlds.length) return;

    [project.worlds[index], project.worlds[nextIndex]] =
      [project.worlds[nextIndex], project.worlds[index]];

    renderWorldManager();
    renderPreview();
    markChanged();
  }

  function deleteWorld(id) {
    const world = project.worlds.find((item) => item.id === id);
    if (!world) return;

    const confirmed = confirm(
      `"${world.name || "이름 없는 세계관"}"을 삭제할까요?\n` +
      "연결된 캐릭터는 독립 캐릭터로 변경됩니다."
    );

    if (!confirmed) return;

    project.characters.forEach((character) => {
      if (character.worldId === id) character.worldId = null;
    });

    const image = media.worlds.get(id);
    releaseMediaEntry(image);
    media.worlds.delete(id);

    project.worlds = project.worlds.filter((item) => item.id !== id);
    state.selectedWorldId = project.worlds[0]?.id || null;

    renderWorldManager();
    renderCharacterManager();
    renderPreview();
    markChanged();
  }

  function newCharacter() {
    return {
      id: makeId("character"),
      worldId: null,
      name: "",
      subtitle: "",
      description: [],
      genres: [],
      tags: [],
      featured: false,
      images: [],
      platforms: [],
      contents: []
    };
  }

  function addCharacter() {
    const character = newCharacter();
    project.characters.push(character);
    media.characters.set(character.id, []);
    state.selectedCharacterId = character.id;
    setActiveTab("characters");
    renderCharacterManager();
    renderWorldManager();
    renderPreview();
    markChanged();
  }

  function selectedCharacter() {
    return project.characters.find(
      (item) => item.id === state.selectedCharacterId
    ) || null;
  }

  function characterMedia(characterId) {
    if (!media.characters.has(characterId)) {
      media.characters.set(characterId, []);
    }

    return media.characters.get(characterId);
  }

  function renderCharacterList() {
    if (project.characters.length === 0) {
      elements.characterList.innerHTML =
        '<div class="empty-record">등록된 캐릭터가 없습니다.</div>';
      return;
    }

    elements.characterList.innerHTML = project.characters
      .map((character, index) => {
        const selected = character.id === state.selectedCharacterId;
        const world = project.worlds.find((item) => item.id === character.worldId);

        return `
          <article class="record-card ${selected ? "is-selected" : ""}">
            <button
              class="record-main"
              type="button"
              data-character-select="${escapeHtml(character.id)}"
            >
              <strong>
                ${character.featured ? "★ " : ""}
                ${escapeHtml(character.name || "이름 없는 캐릭터")}
              </strong>
              <small>
                ${escapeHtml(world?.name || "독립 캐릭터")}
              </small>
            </button>
            <div class="record-actions">
              <button class="icon-action" type="button"
                data-character-move="${escapeHtml(character.id)}"
                data-direction="-1"
                aria-label="위로 이동"
                ${index === 0 ? "disabled" : ""}>↑</button>
              <button class="icon-action" type="button"
                data-character-move="${escapeHtml(character.id)}"
                data-direction="1"
                aria-label="아래로 이동"
                ${index === project.characters.length - 1 ? "disabled" : ""}>↓</button>
            </div>
          </article>
        `;
      })
      .join("");
  }

  function renderGenreChoices(character) {
    if (admin.genres.length === 0) {
      return '<div class="empty-record">관리자가 등록한 장르가 없습니다.</div>';
    }

    return admin.genres.map((genre) => `
      <label class="choice-row">
        <input type="checkbox"
          data-character-genre="${escapeHtml(genre)}"
          ${character.genres.includes(genre) ? "checked" : ""}>
        <span>${escapeHtml(genre)}</span>
      </label>
    `).join("");
  }

  function renderPlatformChoices(character) {
    if (admin.platforms.length === 0) {
      return '<div class="empty-record">관리자가 등록한 플랫폼이 없습니다.</div>';
    }

    return admin.platforms.map((platform) => {
      const link = character.platforms.find((item) => item.id === platform.id);
      const selected = Boolean(link);

      return `
        <label class="choice-row platform-choice">
          <input type="checkbox"
            data-character-platform-toggle="${escapeHtml(platform.id)}"
            ${selected ? "checked" : ""}>
          <span>${escapeHtml(platform.name)}</span>
          <input type="url"
            inputmode="url"
            data-character-platform-url="${escapeHtml(platform.id)}"
            value="${escapeHtml(link?.url || "")}"
            placeholder="https://..."
            ${selected ? "" : "disabled"}>
        </label>
      `;
    }).join("");
  }

  function renderCharacterImages(character) {
    const items = characterMedia(character.id);

    if (items.length === 0) {
      return '<div class="empty-record">등록된 이미지가 없습니다.</div>';
    }

    return `
      <div class="image-strip">
        ${items.map((item, index) => `
          <article class="editor-image-card">
            <div class="editor-image-thumb">
              <img src="${escapeHtml(item.url)}" alt="">
            </div>
            <small>${index === 0 ? "대표 이미지" : `이미지 ${index + 1}`}</small>
            <div class="editor-image-actions">
              <button class="icon-action" type="button"
                data-character-image-move="${index}"
                data-direction="-1"
                ${index === 0 ? "disabled" : ""}>←</button>
              <button class="icon-action" type="button"
                data-character-image-move="${index}"
                data-direction="1"
                ${index === items.length - 1 ? "disabled" : ""}>→</button>
              <button class="icon-action" type="button"
                data-character-image-remove="${index}"
                aria-label="이미지 삭제">×</button>
            </div>
          </article>
        `).join("")}
      </div>
    `;
  }

  function renderCharacterContents(character) {
    if (character.contents.length === 0) {
      return '<div class="empty-record">추가 콘텐츠가 없습니다.</div>';
    }

    return character.contents.map((content, index) => `
      <article class="dynamic-box" data-character-content="${index}">
        <div class="dynamic-box-header">
          <strong>콘텐츠 ${index + 1}</strong>
          <div class="dynamic-box-actions">
            <button class="icon-action" type="button"
              data-character-content-move="${index}"
              data-direction="-1"
              ${index === 0 ? "disabled" : ""}>↑</button>
            <button class="icon-action" type="button"
              data-character-content-move="${index}"
              data-direction="1"
              ${index === character.contents.length - 1 ? "disabled" : ""}>↓</button>
            <button class="icon-action" type="button"
              data-character-content-remove="${index}"
              aria-label="콘텐츠 삭제">×</button>
          </div>
        </div>

        <div class="field-grid field-grid--two">
          <label class="field">
            <span>분류</span>
            <input type="text"
              data-character-content-field="type"
              data-index="${index}"
              value="${escapeHtml(content.type || "")}"
              placeholder="예: 제작 비하인드">
          </label>

          <label class="field">
            <span>제목</span>
            <input type="text"
              data-character-content-field="title"
              data-index="${index}"
              value="${escapeHtml(content.title || "")}">
          </label>
        </div>

        <label class="field">
          <span>내용</span>
          <textarea rows="5"
            data-character-content-field="content"
            data-index="${index}">${escapeHtml(paragraphsToText(content.content))}</textarea>
        </label>

        <div class="spoiler-options">
          <label class="toggle-line">
            <input type="checkbox"
              data-character-content-field="spoiler"
              data-index="${index}"
              ${content.spoiler ? "checked" : ""}>
            스포일러 콘텐츠
          </label>

          <label class="field" ${content.spoiler ? "" : "hidden"}>
            <span>스포일러 경고문</span>
            <input type="text"
              data-character-content-field="warning"
              data-index="${index}"
              value="${escapeHtml(content.warning || "")}"
              placeholder="예: 핵심 결말이 포함되어 있습니다.">
          </label>
        </div>
      </article>
    `).join("");
  }

  function renderCharacterEditor() {
    const character = selectedCharacter();

    if (!character) {
      elements.characterEditor.className =
        "manager-editor-column empty-editor";
      elements.characterEditor.innerHTML =
        "<p>캐릭터를 추가하거나 목록에서 선택하세요.</p>";
      return;
    }

    elements.characterEditor.className = "manager-editor-column";

    const worldOptions = project.worlds.map((world) => `
      <option value="${escapeHtml(world.id)}"
        ${character.worldId === world.id ? "selected" : ""}>
        ${escapeHtml(world.name || "이름 없는 세계관")}
      </option>
    `).join("");

    const imageCount = characterMedia(character.id).length;

    elements.characterEditor.innerHTML = `
      <form class="editor-form" id="characterEditForm" novalidate>
        <section class="editor-section">
          <div class="editor-section-heading">
            <h3>기본 정보</h3>
            <div class="editor-toolbar">
              <button class="button button--outline button--small"
                type="button"
                data-character-clone>복제</button>
            </div>
          </div>

          <label class="toggle-line">
            <input type="checkbox"
              data-character-field="featured"
              ${character.featured ? "checked" : ""}>
            대표 캐릭터로 지정
          </label>

          <label class="field">
            <span>세계관</span>
            <select data-character-field="worldId">
              <option value="">독립 캐릭터</option>
              ${worldOptions}
            </select>
          </label>

          <div class="field-grid field-grid--two">
            <label class="field">
              <span>이름</span>
              <input type="text"
                data-character-field="name"
                maxlength="80"
                value="${escapeHtml(character.name || "")}">
            </label>

            <label class="field">
              <span>부제</span>
              <input type="text"
                data-character-field="subtitle"
                maxlength="140"
                value="${escapeHtml(character.subtitle || "")}">
            </label>
          </div>

          <label class="field">
            <span>소개 문단</span>
            <textarea rows="6"
              data-character-field="description"
              placeholder="빈 줄을 기준으로 문단이 나뉩니다.">${escapeHtml(paragraphsToText(character.description))}</textarea>
          </label>
        </section>

        <section class="editor-section">
          <div class="editor-section-heading">
            <h3>장르</h3>
            <span class="admin-lock">관리자 제공 목록에서 선택</span>
          </div>
          <div class="choice-grid">
            ${renderGenreChoices(character)}
          </div>
        </section>

        <section class="editor-section">
          <div class="editor-section-heading">
            <h3>사용자 태그</h3>
            <span>자유 입력</span>
          </div>
          <label class="field">
            <span>태그</span>
            <input type="text"
              data-character-field="tags"
              value="${escapeHtml(tagsToText(character.tags))}"
              placeholder="쉼표로 구분">
          </label>
        </section>

        <section class="editor-section">
          <div class="editor-section-heading">
            <h3>캐릭터 이미지</h3>
            <span>${imageCount} / 5</span>
          </div>

          <label class="button button--outline button--small file-button"
            ${imageCount >= 5 ? 'aria-disabled="true"' : ""}>
            PNG 추가
            <input class="visually-hidden"
              type="file"
              accept="image/png"
              multiple
              data-character-image-input
              ${imageCount >= 5 ? "disabled" : ""}>
          </label>

          <p class="form-message">
            최대 5장. 첫 번째 이미지가 대표 이미지입니다.
            원본 파일명과 PNG 메타데이터는 보관하지 않습니다.
          </p>

          ${renderCharacterImages(character)}
        </section>

        <section class="editor-section">
          <div class="editor-section-heading">
            <h3>플랫폼과 링크</h3>
            <span class="admin-lock">관리자 제공 플랫폼에서 선택</span>
          </div>
          <div class="dynamic-list">
            ${renderPlatformChoices(character)}
          </div>
        </section>

        <section class="editor-section">
          <div class="editor-section-heading">
            <h3>추가 콘텐츠</h3>
            <button class="button button--outline button--small"
              type="button"
              data-character-content-add>콘텐츠 추가</button>
          </div>
          <div class="dynamic-list">
            ${renderCharacterContents(character)}
          </div>
        </section>

        <section class="editor-section danger-zone">
          <p>캐릭터 데이터와 업로드한 이미지가 함께 삭제됩니다.</p>
          <button class="button button--outline button--small"
            type="button"
            data-character-delete>
            캐릭터 삭제
          </button>
        </section>
      </form>
    `;
  }

  function renderCharacterManager() {
    renderCounts();
    renderCharacterList();
    renderCharacterEditor();
  }

  function moveCharacter(id, direction) {
    const index = project.characters.findIndex((item) => item.id === id);
    const nextIndex = index + Number(direction);

    if (index < 0 || nextIndex < 0 || nextIndex >= project.characters.length) {
      return;
    }

    [project.characters[index], project.characters[nextIndex]] =
      [project.characters[nextIndex], project.characters[index]];

    renderCharacterManager();
    renderPreview();
    markChanged();
  }

  function cloneCharacter(id) {
    const source = project.characters.find((item) => item.id === id);
    if (!source) return;

    const clone = deepClone(source);
    clone.id = makeId("character");
    clone.name = source.name
      ? `${source.name} 복사본`
      : "복사된 캐릭터";
    clone.featured = false;

    const sourceIndex = project.characters.findIndex((item) => item.id === id);
    project.characters.splice(sourceIndex + 1, 0, clone);

    const clonedMedia = characterMedia(id).map((entry) =>
      createMediaEntry(entry.blob)
    );
    media.characters.set(clone.id, clonedMedia);

    state.selectedCharacterId = clone.id;
    renderCharacterManager();
    renderWorldManager();
    renderPreview();
    markChanged();
  }

  function deleteCharacter(id) {
    const character = project.characters.find((item) => item.id === id);
    if (!character) return;

    const confirmed = confirm(
      `"${character.name || "이름 없는 캐릭터"}"을 삭제할까요?`
    );

    if (!confirmed) return;

    characterMedia(id).forEach(releaseMediaEntry);
    media.characters.delete(id);

    project.characters = project.characters.filter((item) => item.id !== id);
    state.selectedCharacterId = project.characters[0]?.id || null;

    renderCharacterManager();
    renderWorldManager();
    renderPreview();
    markChanged();
  }

  function setFeatured(character, checked) {
    if (checked && !character.featured) {
      const count = project.characters.filter((item) => item.featured).length;
      if (count >= 3) {
        alert("대표 캐릭터는 최대 3명까지 지정할 수 있습니다.");
        return false;
      }
    }

    character.featured = checked;
    return true;
  }

  function mediaPreviewForWorld(worldId) {
    return media.worlds.get(worldId)?.url || "";
  }

  function mediaPreviewForCharacter(characterId, index = 0) {
    return characterMedia(characterId)[index]?.url || "";
  }

  function renderPreviewSocials() {
    return project.creator.links
      .map((link) => {
        const service = profileServiceCatalog.get(link.id);
        if (!service || !link.url) return "";

        return `
          <a href="${escapeHtml(link.url)}"
            target="_blank"
            rel="noreferrer"
            aria-label="${escapeHtml(service.name)}">
            ${iconMarkup(service, "preview-social-icon")}
          </a>
        `;
      })
      .join("");
  }

  function renderPreviewWorlds() {
    if (project.worlds.length === 0) {
      return '<div class="preview-empty">등록된 세계관이 없습니다.</div>';
    }

    return `
      <div class="preview-world-grid">
        ${project.worlds.map((world) => {
          const image = mediaPreviewForWorld(world.id);
          return `
            <article class="preview-card preview-world-card">
              <div class="preview-card-image">
                ${image
                  ? `<img src="${escapeHtml(image)}" alt="">`
                  : "WORLD"}
              </div>
              <div class="preview-card-copy">
                <div class="preview-badges">
                  ${world.tags.slice(0, 2).map((tag) =>
                    `<span class="preview-badge">${escapeHtml(tag)}</span>`
                  ).join("")}
                </div>
                <h4>${escapeHtml(world.name || "이름 없는 세계관")}</h4>
                <p>${escapeHtml(world.subtitle || "")}</p>
              </div>
            </article>
          `;
        }).join("")}
      </div>
    `;
  }

  function previewCharacters() {
    if (state.previewAllCharacters) return project.characters;

    const featured = project.characters.filter((character) => character.featured);
    const fallback = project.characters.filter((character) => !character.featured);

    return [...featured, ...fallback].slice(0, 3);
  }

  function renderPreviewCharacters() {
    const characters = previewCharacters();

    if (characters.length === 0) {
      return '<div class="preview-empty">등록된 캐릭터가 없습니다.</div>';
    }

    return `
      <div class="preview-character-grid">
        ${characters.map((character) => {
          const image = mediaPreviewForCharacter(character.id);
          const platformIcons = character.platforms
            .filter((link) => link.url)
            .slice(0, 4)
            .map((link) => {
              const platform = platformCatalog.get(link.id);
              return platform
                ? iconMarkup(platform, "preview-platform-icon")
                : "";
            })
            .join("");

          return `
            <article class="preview-card">
              <div class="preview-card-image">
                ${image
                  ? `<img src="${escapeHtml(image)}" alt="">`
                  : "CHARACTER"}
                <div class="preview-card-platforms">${platformIcons}</div>
              </div>
              <div class="preview-card-copy">
                <div class="preview-badges">
                  ${character.genres.slice(0, 2).map((genre) =>
                    `<span class="preview-badge">${escapeHtml(genre)}</span>`
                  ).join("")}
                </div>
                <h4>
                  ${character.featured ? "★ " : ""}
                  ${escapeHtml(character.name || "이름 없는 캐릭터")}
                </h4>
                <p>${escapeHtml(character.subtitle || "")}</p>
              </div>
            </article>
          `;
        }).join("")}
      </div>
    `;
  }

  function renderPreview() {
    const title = project.site.title || "캐릭터 아카이브";
    const creatorName = project.creator.name || "제작자 이름";
    const fallback =
      project.creator.fallbackText ||
      project.creator.name?.trim()?.slice(0, 1) ||
      "✦";

    elements.previewRoot.dataset.theme = state.previewTheme;

    elements.previewRoot.innerHTML = `
      <header class="preview-topbar">
        <div class="preview-brand">
          <span class="preview-brand-mark">✦</span>
          <span>${escapeHtml(title)}</span>
        </div>

        <div class="preview-nav-actions">
          <button class="preview-button"
            type="button"
            data-preview-action="toggle-all">
            ${state.previewAllCharacters ? "대표 화면 보기" : "전체 캐릭터 보기"}
          </button>
          <button class="preview-button ${state.previewTheme === "dark" ? "is-active" : ""}"
            type="button"
            data-preview-action="theme-dark">
            블랙 테마
          </button>
          <button class="preview-button ${state.previewTheme === "light" ? "is-active" : ""}"
            type="button"
            data-preview-action="theme-light">
            화이트 테마
          </button>
        </div>
      </header>

      <div class="preview-body">
        <section class="preview-hero">
          <div class="preview-avatar" aria-hidden="true">
            ${media.avatar
              ? `<img src="${escapeHtml(media.avatar.url)}" alt="">`
              : `<span>${escapeHtml(fallback)}</span>`}
          </div>

          <div>
            <p class="preview-manifesto">
              ${escapeHtml(project.site.description || "")}
            </p>
            <h3>${escapeHtml(creatorName)}</h3>
            <p class="preview-handle">${escapeHtml(project.creator.handle || "")}</p>
            <div class="preview-bio">
              ${project.creator.bio.map((paragraph) =>
                `<p>${escapeHtml(paragraph)}</p>`
              ).join("")}
            </div>
            <div class="preview-socials">
              ${renderPreviewSocials()}
            </div>
          </div>
        </section>

        ${state.previewAllCharacters ? "" : `
          <section class="preview-section">
            <div class="preview-section-heading">
              <h3>세계관</h3>
              <span>${project.worlds.length} Worlds</span>
            </div>
            ${renderPreviewWorlds()}
          </section>
        `}

        <section class="preview-section">
          <div class="preview-section-heading">
            <h3>
              ${state.previewAllCharacters ? "전체 캐릭터" : "대표 캐릭터"}
            </h3>
            <span>${project.characters.length} Characters</span>
          </div>
          ${renderPreviewCharacters()}
        </section>
      </div>
    `;

    elements.previewRoot.querySelectorAll("[data-icon-image]").forEach((image) => {
      image.addEventListener("error", () => {
        image.hidden = true;
        const fallbackIcon = image.nextElementSibling;
        if (fallbackIcon) fallbackIcon.hidden = false;
      }, { once: true });
    });
  }

  function renderEverything() {
    renderCounts();
    syncProfileFields();
    renderAvatarEditor();
    renderSocialServiceOptions();
    renderSocialLinks();
    renderWorldManager();
    renderCharacterManager();
    renderPreview();
  }

  elements.tabs.forEach((button) => {
    button.addEventListener("click", () => {
      setActiveTab(button.dataset.editorTab);
    });
  });

  elements.profileForm.addEventListener("input", (event) => {
    if (event.target === elements.avatarInput) return;
    updateProjectFromProfile();
  });

  elements.addSocialLinkButton.addEventListener("click", addSocialLink);

  elements.socialUrlInput.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    addSocialLink();
  });

  elements.socialLinkList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-social-remove]");
    if (!button) return;

    project.creator.links = project.creator.links.filter(
      (link) => link.id !== button.dataset.socialRemove
    );

    renderSocialLinks();
    renderPreview();
    markChanged();
  });

  elements.avatarInput.addEventListener("change", async () => {
    const file = elements.avatarInput.files?.[0] || null;
    elements.avatarInput.value = "";
    if (!file) return;

    try {
      const blob = await sanitizePng(file);
      releaseMediaEntry(media.avatar);
      media.avatar = createMediaEntry(blob);
      renderAvatarEditor();
      renderPreview();
      markChanged();
    } catch (error) {
      alert(error.message || "이미지를 처리하지 못했습니다.");
    }
  });

  elements.removeAvatarButton.addEventListener("click", () => {
    releaseMediaEntry(media.avatar);
    media.avatar = null;
    renderAvatarEditor();
    renderPreview();
    markChanged();
  });

  elements.addWorldButton.addEventListener("click", addWorld);

  elements.worldList.addEventListener("click", (event) => {
    const select = event.target.closest("[data-world-select]");
    if (select) {
      state.selectedWorldId = select.dataset.worldSelect;
      renderWorldManager();
      return;
    }

    const move = event.target.closest("[data-world-move]");
    if (move) {
      moveWorld(move.dataset.worldMove, move.dataset.direction);
    }
  });

  elements.worldEditor.addEventListener("input", (event) => {
    const world = selectedWorld();
    if (!world) return;

    const field = event.target.dataset.worldField;
    if (field) {
      if (field === "tags") world.tags = textToTags(event.target.value);
      else if (field === "description") {
        world.description = textToParagraphs(event.target.value);
      } else {
        world[field] = event.target.value;
      }

      renderWorldList();
      renderPreview();
      markChanged();
      return;
    }

    const sectionField = event.target.dataset.worldSectionField;
    const index = Number(event.target.dataset.index);

    if (sectionField && Number.isInteger(index) && world.sections[index]) {
      if (sectionField === "content") {
        world.sections[index].content = textToParagraphs(event.target.value);
      } else {
        world.sections[index][sectionField] = event.target.value;
      }

      renderPreview();
      markChanged();
    }
  });

  elements.worldEditor.addEventListener("change", async (event) => {
    if (!event.target.matches("[data-world-image-input]")) return;

    const world = selectedWorld();
    const file = event.target.files?.[0] || null;
    event.target.value = "";
    if (!world || !file) return;

    try {
      const blob = await sanitizePng(file);
      releaseMediaEntry(media.worlds.get(world.id));
      media.worlds.set(world.id, createMediaEntry(blob));
      renderWorldEditor();
      renderPreview();
      markChanged();
    } catch (error) {
      alert(error.message || "이미지를 처리하지 못했습니다.");
    }
  });

  elements.worldEditor.addEventListener("click", (event) => {
    const world = selectedWorld();
    if (!world) return;

    if (event.target.closest("[data-world-image-remove]")) {
      releaseMediaEntry(media.worlds.get(world.id));
      media.worlds.delete(world.id);
      renderWorldEditor();
      renderPreview();
      markChanged();
      return;
    }

    if (event.target.closest("[data-world-section-add]")) {
      world.sections.push({
        title: "",
        content: []
      });
      renderWorldEditor();
      markChanged();
      return;
    }

    const removeSection = event.target.closest("[data-world-section-remove]");
    if (removeSection) {
      world.sections.splice(Number(removeSection.dataset.worldSectionRemove), 1);
      renderWorldEditor();
      renderPreview();
      markChanged();
      return;
    }

    const moveSection = event.target.closest("[data-world-section-move]");
    if (moveSection) {
      const index = Number(moveSection.dataset.worldSectionMove);
      const nextIndex = index + Number(moveSection.dataset.direction);

      if (nextIndex >= 0 && nextIndex < world.sections.length) {
        [world.sections[index], world.sections[nextIndex]] =
          [world.sections[nextIndex], world.sections[index]];
      }

      renderWorldEditor();
      renderPreview();
      markChanged();
      return;
    }

    if (event.target.closest("[data-world-delete]")) {
      deleteWorld(world.id);
    }
  });

  elements.addCharacterButton.addEventListener("click", addCharacter);

  elements.characterList.addEventListener("click", (event) => {
    const select = event.target.closest("[data-character-select]");
    if (select) {
      state.selectedCharacterId = select.dataset.characterSelect;
      renderCharacterManager();
      return;
    }

    const move = event.target.closest("[data-character-move]");
    if (move) {
      moveCharacter(move.dataset.characterMove, move.dataset.direction);
    }
  });

  elements.characterEditor.addEventListener("input", (event) => {
    const character = selectedCharacter();
    if (!character) return;

    const field = event.target.dataset.characterField;
    if (field && !["featured", "worldId"].includes(field)) {
      if (field === "description") {
        character.description = textToParagraphs(event.target.value);
      } else if (field === "tags") {
        character.tags = textToTags(event.target.value);
      } else {
        character[field] = event.target.value;
      }

      renderCharacterList();
      renderWorldManager();
      renderPreview();
      markChanged();
      return;
    }

    const platformId = event.target.dataset.characterPlatformUrl;
    if (platformId) {
      const link = character.platforms.find((item) => item.id === platformId);
      if (link) link.url = event.target.value;
      renderPreview();
      markChanged();
      return;
    }

    const contentField = event.target.dataset.characterContentField;
    const index = Number(event.target.dataset.index);

    if (
      contentField &&
      contentField !== "spoiler" &&
      Number.isInteger(index) &&
      character.contents[index]
    ) {
      if (contentField === "content") {
        character.contents[index].content =
          textToParagraphs(event.target.value);
      } else {
        character.contents[index][contentField] = event.target.value;
      }

      renderPreview();
      markChanged();
    }
  });

  elements.characterEditor.addEventListener("change", async (event) => {
    const character = selectedCharacter();
    if (!character) return;

    const field = event.target.dataset.characterField;

    if (field === "featured") {
      const accepted = setFeatured(character, event.target.checked);
      if (!accepted) event.target.checked = false;

      renderCharacterManager();
      renderPreview();
      markChanged();
      return;
    }

    if (field === "worldId") {
      character.worldId = event.target.value || null;
      renderCharacterList();
      renderWorldManager();
      renderPreview();
      markChanged();
      return;
    }

    const genre = event.target.dataset.characterGenre;
    if (genre) {
      if (!admin.genres.includes(genre)) return;

      if (event.target.checked) {
        if (!character.genres.includes(genre)) character.genres.push(genre);
      } else {
        character.genres = character.genres.filter((item) => item !== genre);
      }

      renderPreview();
      markChanged();
      return;
    }

    const platformToggle = event.target.dataset.characterPlatformToggle;
    if (platformToggle) {
      if (!platformCatalog.has(platformToggle)) return;

      if (event.target.checked) {
        if (!character.platforms.some((item) => item.id === platformToggle)) {
          character.platforms.push({ id: platformToggle, url: "" });
        }
      } else {
        character.platforms = character.platforms.filter(
          (item) => item.id !== platformToggle
        );
      }

      renderCharacterEditor();
      renderPreview();
      markChanged();
      return;
    }

    const contentField = event.target.dataset.characterContentField;
    const contentIndex = Number(event.target.dataset.index);

    if (
      contentField === "spoiler" &&
      Number.isInteger(contentIndex) &&
      character.contents[contentIndex]
    ) {
      character.contents[contentIndex].spoiler = event.target.checked;
      if (!event.target.checked) {
        character.contents[contentIndex].warning = "";
      }

      renderCharacterEditor();
      renderPreview();
      markChanged();
      return;
    }

    if (event.target.matches("[data-character-image-input]")) {
      const files = [...(event.target.files || [])];
      event.target.value = "";
      if (files.length === 0) return;

      const current = characterMedia(character.id);
      const available = 5 - current.length;

      if (available <= 0) {
        alert("캐릭터 이미지는 최대 5장입니다.");
        return;
      }

      const selectedFiles = files.slice(0, available);

      try {
        for (const file of selectedFiles) {
          const blob = await sanitizePng(file);
          current.push(createMediaEntry(blob));
        }

        if (files.length > available) {
          alert(`최대 5장까지만 추가되어 ${files.length - available}장은 제외되었습니다.`);
        }

        renderCharacterEditor();
        renderPreview();
        markChanged();
      } catch (error) {
        alert(error.message || "이미지를 처리하지 못했습니다.");
      }
    }
  });

  elements.characterEditor.addEventListener("click", (event) => {
    const character = selectedCharacter();
    if (!character) return;

    if (event.target.closest("[data-character-clone]")) {
      cloneCharacter(character.id);
      return;
    }

    const imageRemove = event.target.closest("[data-character-image-remove]");
    if (imageRemove) {
      const index = Number(imageRemove.dataset.characterImageRemove);
      const items = characterMedia(character.id);
      const [removed] = items.splice(index, 1);
      releaseMediaEntry(removed);

      renderCharacterEditor();
      renderPreview();
      markChanged();
      return;
    }

    const imageMove = event.target.closest("[data-character-image-move]");
    if (imageMove) {
      const index = Number(imageMove.dataset.characterImageMove);
      const nextIndex = index + Number(imageMove.dataset.direction);
      const items = characterMedia(character.id);

      if (nextIndex >= 0 && nextIndex < items.length) {
        [items[index], items[nextIndex]] = [items[nextIndex], items[index]];
      }

      renderCharacterEditor();
      renderPreview();
      markChanged();
      return;
    }

    if (event.target.closest("[data-character-content-add]")) {
      character.contents.push({
        id: makeId("content"),
        type: "",
        title: "",
        content: [],
        spoiler: false,
        warning: ""
      });

      renderCharacterEditor();
      markChanged();
      return;
    }

    const contentRemove = event.target.closest("[data-character-content-remove]");
    if (contentRemove) {
      character.contents.splice(
        Number(contentRemove.dataset.characterContentRemove),
        1
      );

      renderCharacterEditor();
      renderPreview();
      markChanged();
      return;
    }

    const contentMove = event.target.closest("[data-character-content-move]");
    if (contentMove) {
      const index = Number(contentMove.dataset.characterContentMove);
      const nextIndex = index + Number(contentMove.dataset.direction);

      if (nextIndex >= 0 && nextIndex < character.contents.length) {
        [character.contents[index], character.contents[nextIndex]] =
          [character.contents[nextIndex], character.contents[index]];
      }

      renderCharacterEditor();
      renderPreview();
      markChanged();
      return;
    }

    if (event.target.closest("[data-character-delete]")) {
      deleteCharacter(character.id);
    }
  });

  elements.previewRoot.addEventListener("click", (event) => {
    const button = event.target.closest("[data-preview-action]");
    if (!button) return;

    const action = button.dataset.previewAction;

    if (action === "toggle-all") {
      state.previewAllCharacters = !state.previewAllCharacters;
    } else if (action === "theme-dark") {
      state.previewTheme = "dark";
    } else if (action === "theme-light") {
      state.previewTheme = "light";
    }

    renderPreview();
  });

  elements.resetProjectButton.addEventListener("click", () => {
    const confirmed = confirm(
      "현재 입력한 제작자, 세계관, 캐릭터와 업로드 이미지를 모두 초기화할까요?"
    );

    if (!confirmed) return;

    releaseAllMedia();
    media.avatar = null;
    media.worlds.clear();
    media.characters.clear();

    const fresh = deepClone(emptyProject);

    project.version = fresh.version ?? 1;
    project.site = fresh.site || {};
    project.creator = fresh.creator || {};
    project.creator.bio = arrayValue(project.creator.bio);
    project.creator.links = arrayValue(project.creator.links);
    project.worlds = arrayValue(fresh.worlds);
    project.characters = arrayValue(fresh.characters);

    state.selectedWorldId = null;
    state.selectedCharacterId = null;
    state.previewAllCharacters = false;

    renderEverything();
    setActiveTab("profile");
    markChanged();
  });

  window.addEventListener("beforeunload", releaseAllMedia);

  renderEverything();
  setActiveTab("profile");
})();
