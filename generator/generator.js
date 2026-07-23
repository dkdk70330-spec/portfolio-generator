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
    profileLinkServices: [],
    platforms: [],
    genres: []
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
  const MAX_IMAGE_FILE_BYTES = 10 * 1024 * 1024;
  const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];

  const services = Array.isArray(adminCatalog.profileLinkServices)
    ? adminCatalog.profileLinkServices
    : [];

  const serviceCatalog = new Map(
    services.map((service) => [service.id, service])
  );

  const platformOptions = Array.isArray(adminCatalog.platforms)
    ? adminCatalog.platforms
    : [];
  const platformCatalog = new Map(
    platformOptions.map((platform) => [platform.id, platform])
  );
  const genreOptions = Array.isArray(adminCatalog.genres)
    ? adminCatalog.genres.filter((genre) => typeof genre === "string" && genre.trim())
    : [];

  let project = createEmptyProject();
  let creatorAvatarBlob = null;
  let creatorAvatarPreviewUrl = "";
  let avatarRestoreMissing = false;
  let selectedWorldId = "";
  let worldPreviewExpanded = false;
  let selectedCharacterId = "";
  let characterPreviewExpanded = false;
  const worldImageBlobs = new Map();
  const worldImagePreviewUrls = new Map();
  const missingWorldImageIds = new Set();
  const characterImageBlobs = new Map();
  const characterImagePreviewUrls = new Map();
  const missingCharacterImageIds = new Set();
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

    addWorldButton: document.querySelector("#addWorldButton"),
    worldEditorList: document.querySelector("#worldEditorList"),
    worldEditorEmpty: document.querySelector("#worldEditorEmpty"),
    worldForm: document.querySelector("#worldForm"),
    moveWorldUpButton: document.querySelector("#moveWorldUpButton"),
    moveWorldDownButton: document.querySelector("#moveWorldDownButton"),
    deleteWorldButton: document.querySelector("#deleteWorldButton"),
    worldImageInput: document.querySelector("#worldImageInput"),
    worldImageEditorPreview: document.querySelector("#worldImageEditorPreview"),
    worldImageEditorFallback: document.querySelector("#worldImageEditorFallback"),
    worldImageStorageStatus: document.querySelector("#worldImageStorageStatus"),
    removeWorldImageButton: document.querySelector("#removeWorldImageButton"),
    worldNameInput: document.querySelector("#worldNameInput"),
    worldSubtitleInput: document.querySelector("#worldSubtitleInput"),
    worldTagsInput: document.querySelector("#worldTagsInput"),
    worldDescriptionInput: document.querySelector("#worldDescriptionInput"),
    worldCharacterLinkList: document.querySelector("#worldCharacterLinkList"),
    addWorldSectionButton: document.querySelector("#addWorldSectionButton"),
    worldSectionList: document.querySelector("#worldSectionList"),

    addCharacterButton: document.querySelector("#addCharacterButton"),
    characterEditorList: document.querySelector("#characterEditorList"),
    characterEditorEmpty: document.querySelector("#characterEditorEmpty"),
    characterForm: document.querySelector("#characterForm"),
    moveCharacterUpButton: document.querySelector("#moveCharacterUpButton"),
    moveCharacterDownButton: document.querySelector("#moveCharacterDownButton"),
    deleteCharacterButton: document.querySelector("#deleteCharacterButton"),
    characterImageInput: document.querySelector("#characterImageInput"),
    characterImageStorageStatus: document.querySelector("#characterImageStorageStatus"),
    characterImageList: document.querySelector("#characterImageList"),
    characterNameInput: document.querySelector("#characterNameInput"),
    characterSubtitleInput: document.querySelector("#characterSubtitleInput"),
    characterWorldSelect: document.querySelector("#characterWorldSelect"),
    characterFeaturedInput: document.querySelector("#characterFeaturedInput"),
    characterGenreList: document.querySelector("#characterGenreList"),
    characterTagsInput: document.querySelector("#characterTagsInput"),
    characterDescriptionInput: document.querySelector("#characterDescriptionInput"),
    characterPlatformList: document.querySelector("#characterPlatformList"),
    addCharacterContentButton: document.querySelector("#addCharacterContentButton"),
    characterContentList: document.querySelector("#characterContentList"),

    previewSiteTitle: document.querySelector("#previewSiteTitle"),
    previewSiteDescription: document.querySelector("#previewSiteDescription"),
    previewCreatorName: document.querySelector("#previewCreatorName"),
    previewCreatorHandle: document.querySelector("#previewCreatorHandle"),
    previewCreatorBio: document.querySelector("#previewCreatorBio"),
    previewCreatorLinks: document.querySelector("#previewCreatorLinks"),
    previewAvatarImage: document.querySelector("#previewAvatarImage"),
    previewAvatarFallback: document.querySelector("#previewAvatarFallback"),

    previewWorldSection: document.querySelector("#previewWorldSection"),
    previewWorldGrid: document.querySelector("#previewWorldGrid"),
    previewWorldToggleWrap: document.querySelector("#previewWorldToggleWrap"),
    previewWorldToggle: document.querySelector("#previewWorldToggle"),
    previewWorldEmpty: document.querySelector("#previewWorldEmpty"),
    worldPreviewModal: document.querySelector("#worldPreviewModal"),
    worldPreviewModalClose: document.querySelector("#worldPreviewModalClose"),
    worldPreviewModalImage: document.querySelector("#worldPreviewModalImage"),
    worldPreviewModalImageFallback: document.querySelector("#worldPreviewModalImageFallback"),
    worldPreviewModalTitle: document.querySelector("#worldPreviewModalTitle"),
    worldPreviewModalSummary: document.querySelector("#worldPreviewModalSummary"),
    worldPreviewModalTags: document.querySelector("#worldPreviewModalTags"),
    worldPreviewModalDescription: document.querySelector("#worldPreviewModalDescription"),
    worldPreviewModalSections: document.querySelector("#worldPreviewModalSections"),
    worldPreviewCharacterSection: document.querySelector("#worldPreviewCharacterSection"),
    worldPreviewCharacterList: document.querySelector("#worldPreviewCharacterList"),

    previewFeaturedSection: document.querySelector("#previewFeaturedSection"),
    previewFeaturedGrid: document.querySelector("#previewFeaturedGrid"),
    previewCharacterSection: document.querySelector("#previewCharacterSection"),
    previewCharacterGrid: document.querySelector("#previewCharacterGrid"),
    previewCharacterToggleWrap: document.querySelector("#previewCharacterToggleWrap"),
    previewCharacterToggle: document.querySelector("#previewCharacterToggle"),
    previewCharacterEmpty: document.querySelector("#previewCharacterEmpty"),
    characterPreviewModal: document.querySelector("#characterPreviewModal"),
    characterPreviewModalClose: document.querySelector("#characterPreviewModalClose"),
    characterPreviewModalTitle: document.querySelector("#characterPreviewModalTitle"),
    characterPreviewModalSummary: document.querySelector("#characterPreviewModalSummary"),
    characterPreviewMainImage: document.querySelector("#characterPreviewMainImage"),
    characterPreviewMainImageFallback: document.querySelector("#characterPreviewMainImageFallback"),
    characterPreviewThumbnails: document.querySelector("#characterPreviewThumbnails"),
    characterPreviewPlatforms: document.querySelector("#characterPreviewPlatforms"),
    characterPreviewKicker: document.querySelector("#characterPreviewKicker"),
    characterPreviewModalTags: document.querySelector("#characterPreviewModalTags"),
    characterPreviewModalDescription: document.querySelector("#characterPreviewModalDescription"),
    characterPreviewWorldPanel: document.querySelector("#characterPreviewWorldPanel"),
    characterPreviewWorldButton: document.querySelector("#characterPreviewWorldButton"),
    characterPreviewWorldName: document.querySelector("#characterPreviewWorldName"),
    characterPreviewWorldSummary: document.querySelector("#characterPreviewWorldSummary"),
    characterPreviewContentSection: document.querySelector("#characterPreviewContentSection"),
    characterPreviewContents: document.querySelector("#characterPreviewContents"),

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


  function normalizeWorldImage(value, fieldName) {
    if (value === undefined || value === null || value === "") return "";

    if (typeof value === "string") {
      return value;
    }

    if (!isPlainObject(value)) {
      throw new Error(`${fieldName} 항목의 형식이 올바르지 않습니다.`);
    }

    const id = normalizeString(value.id, `${fieldName}.id`).trim();
    const name = normalizeString(
      value.name || "world.png",
      `${fieldName}.name`
    ).trim();
    const type = normalizeString(
      value.type || "image/png",
      `${fieldName}.type`
    ).trim();
    const size = Number(value.size || 0);
    const width = Number(value.width || 0);
    const height = Number(value.height || 0);
    const updatedAt = normalizeString(
      value.updatedAt || "",
      `${fieldName}.updatedAt`
    ).trim();

    if (!id) throw new Error(`${fieldName}.id가 비어 있습니다.`);
    if (type !== "image/png") {
      throw new Error(`${fieldName}는 PNG 이미지여야 합니다.`);
    }
    if (!Number.isFinite(size) || size < 0) {
      throw new Error(`${fieldName}.size가 올바르지 않습니다.`);
    }
    if (!Number.isFinite(width) || width < 0) {
      throw new Error(`${fieldName}.width가 올바르지 않습니다.`);
    }
    if (!Number.isFinite(height) || height < 0) {
      throw new Error(`${fieldName}.height가 올바르지 않습니다.`);
    }

    return {
      id,
      name: name || "world.png",
      type: "image/png",
      size: Math.round(size),
      width: Math.round(width),
      height: Math.round(height),
      updatedAt
    };
  }

  function normalizeWorldSection(section, worldIndex, sectionIndex) {
    if (!isPlainObject(section)) {
      throw new Error(
        `worlds[${worldIndex}].sections[${sectionIndex}] 항목의 형식이 올바르지 않습니다.`
      );
    }

    const rawContent = section.content ?? section.body ?? [];
    const content = Array.isArray(rawContent)
      ? rawContent.map((paragraph, paragraphIndex) =>
          normalizeString(
            paragraph,
            `worlds[${worldIndex}].sections[${sectionIndex}].content[${paragraphIndex}]`
          ).trim()
        ).filter(Boolean)
      : bioTextToArray(
          normalizeString(
            rawContent,
            `worlds[${worldIndex}].sections[${sectionIndex}].content`
          )
        );

    return {
      ...cloneJson(section),
      id: normalizeString(
        section.id || `section-${sectionIndex + 1}`,
        `worlds[${worldIndex}].sections[${sectionIndex}].id`
      ).trim(),
      title: normalizeString(
        section.title,
        `worlds[${worldIndex}].sections[${sectionIndex}].title`
      ),
      content,
      collapsible: section.collapsible === true
    };
  }

  function normalizeWorld(world, index) {
    if (!isPlainObject(world)) {
      throw new Error(`worlds[${index}] 항목의 형식이 올바르지 않습니다.`);
    }

    const id = normalizeString(world.id, `worlds[${index}].id`).trim();
    if (!id) throw new Error(`worlds[${index}].id가 비어 있습니다.`);

    const rawTags = world.tags || [];
    const rawDescription = world.description || [];
    const rawSections = world.sections || [];

    if (!Array.isArray(rawTags)) {
      throw new Error(`worlds[${index}].tags 항목은 배열이어야 합니다.`);
    }
    if (!Array.isArray(rawDescription)) {
      throw new Error(`worlds[${index}].description 항목은 배열이어야 합니다.`);
    }
    if (!Array.isArray(rawSections)) {
      throw new Error(`worlds[${index}].sections 항목은 배열이어야 합니다.`);
    }

    return {
      ...cloneJson(world),
      id,
      name: normalizeString(world.name, `worlds[${index}].name`),
      subtitle: normalizeString(world.subtitle, `worlds[${index}].subtitle`),
      image: normalizeWorldImage(world.image, `worlds[${index}].image`),
      tags: rawTags.map((tag, tagIndex) =>
        normalizeString(tag, `worlds[${index}].tags[${tagIndex}]`).trim()
      ).filter(Boolean),
      description: rawDescription.map((paragraph, paragraphIndex) =>
        normalizeString(
          paragraph,
          `worlds[${index}].description[${paragraphIndex}]`
        ).trim()
      ).filter(Boolean),
      sections: rawSections.map((section, sectionIndex) =>
        normalizeWorldSection(section, index, sectionIndex)
      )
    };
  }


  function normalizeCharacterImage(value, fieldName) {
    if (value === undefined || value === null || value === "") return "";
    if (typeof value === "string") return value;
    if (!isPlainObject(value)) {
      throw new Error(`${fieldName} 항목의 형식이 올바르지 않습니다.`);
    }

    const id = normalizeString(value.id, `${fieldName}.id`).trim();
    const name = normalizeString(value.name || "character.png", `${fieldName}.name`).trim();
    const type = normalizeString(value.type || "image/png", `${fieldName}.type`).trim();
    const size = Number(value.size || 0);
    const width = Number(value.width || 0);
    const height = Number(value.height || 0);
    const updatedAt = normalizeString(value.updatedAt || "", `${fieldName}.updatedAt`).trim();

    if (!id) throw new Error(`${fieldName}.id가 비어 있습니다.`);
    if (type !== "image/png") throw new Error(`${fieldName}는 PNG 이미지여야 합니다.`);
    if (!Number.isFinite(size) || size < 0) throw new Error(`${fieldName}.size가 올바르지 않습니다.`);
    if (!Number.isFinite(width) || width < 0) throw new Error(`${fieldName}.width가 올바르지 않습니다.`);
    if (!Number.isFinite(height) || height < 0) throw new Error(`${fieldName}.height가 올바르지 않습니다.`);

    return {
      id,
      name: name || "character.png",
      type: "image/png",
      size: Math.round(size),
      width: Math.round(width),
      height: Math.round(height),
      updatedAt
    };
  }

  function normalizeCharacterContent(item, characterIndex, contentIndex) {
    if (!isPlainObject(item)) {
      throw new Error(`characters[${characterIndex}].contents[${contentIndex}] 항목의 형식이 올바르지 않습니다.`);
    }

    const rawContent = item.content ?? item.body ?? [];
    const content = Array.isArray(rawContent)
      ? rawContent.map((paragraph, paragraphIndex) =>
          normalizeString(
            paragraph,
            `characters[${characterIndex}].contents[${contentIndex}].content[${paragraphIndex}]`
          ).trim()
        ).filter(Boolean)
      : bioTextToArray(normalizeString(
          rawContent,
          `characters[${characterIndex}].contents[${contentIndex}].content`
        ));

    return {
      ...cloneJson(item),
      id: normalizeString(
        item.id || `content-${contentIndex + 1}`,
        `characters[${characterIndex}].contents[${contentIndex}].id`
      ).trim(),
      type: normalizeString(item.type, `characters[${characterIndex}].contents[${contentIndex}].type`),
      title: normalizeString(item.title, `characters[${characterIndex}].contents[${contentIndex}].title`),
      content,
      spoiler: item.spoiler === true,
      warning: normalizeString(item.warning, `characters[${characterIndex}].contents[${contentIndex}].warning`)
    };
  }

  function normalizeCharacter(character, index) {
    if (!isPlainObject(character)) {
      throw new Error(`characters[${index}] 항목의 형식이 올바르지 않습니다.`);
    }

    const id = normalizeString(character.id, `characters[${index}].id`).trim();
    if (!id) throw new Error(`characters[${index}].id가 비어 있습니다.`);

    const rawDescription = character.description || [];
    const rawGenres = character.genres || [];
    const rawTags = character.tags || [];
    const rawImages = character.images || [];
    const rawPlatforms = character.platforms || [];
    const rawContents = character.contents || character.content || [];

    if (!Array.isArray(rawDescription)) throw new Error(`characters[${index}].description 항목은 배열이어야 합니다.`);
    if (!Array.isArray(rawGenres)) throw new Error(`characters[${index}].genres 항목은 배열이어야 합니다.`);
    if (!Array.isArray(rawTags)) throw new Error(`characters[${index}].tags 항목은 배열이어야 합니다.`);
    if (!Array.isArray(rawImages)) throw new Error(`characters[${index}].images 항목은 배열이어야 합니다.`);
    if (!Array.isArray(rawPlatforms)) throw new Error(`characters[${index}].platforms 항목은 배열이어야 합니다.`);
    if (!Array.isArray(rawContents)) throw new Error(`characters[${index}].contents 항목은 배열이어야 합니다.`);
    if (rawImages.length > 5) throw new Error(`characters[${index}].images는 최대 5개까지 사용할 수 있습니다.`);

    return {
      ...cloneJson(character),
      id,
      worldId: normalizeString(character.worldId, `characters[${index}].worldId`).trim(),
      name: normalizeString(character.name, `characters[${index}].name`),
      subtitle: normalizeString(character.subtitle, `characters[${index}].subtitle`),
      description: rawDescription.map((paragraph, paragraphIndex) =>
        normalizeString(paragraph, `characters[${index}].description[${paragraphIndex}]`).trim()
      ).filter(Boolean),
      genres: rawGenres.map((genre, genreIndex) =>
        normalizeString(genre, `characters[${index}].genres[${genreIndex}]`).trim()
      ).filter(Boolean),
      tags: rawTags.map((tag, tagIndex) =>
        normalizeString(tag, `characters[${index}].tags[${tagIndex}]`).trim()
      ).filter(Boolean),
      featured: character.featured === true,
      images: rawImages.map((image, imageIndex) =>
        normalizeCharacterImage(image, `characters[${index}].images[${imageIndex}]`)
      ).filter(Boolean),
      platforms: rawPlatforms.map((platform, platformIndex) => {
        if (!isPlainObject(platform)) {
          throw new Error(`characters[${index}].platforms[${platformIndex}] 항목의 형식이 올바르지 않습니다.`);
        }
        const platformId = normalizeString(
          platform.id,
          `characters[${index}].platforms[${platformIndex}].id`
        ).trim();
        const url = normalizeString(
          platform.url,
          `characters[${index}].platforms[${platformIndex}].url`
        ).trim();
        if (!platformId) {
          throw new Error(`characters[${index}].platforms[${platformIndex}].id가 비어 있습니다.`);
        }
        return { id: platformId, url };
      }),
      contents: rawContents.map((item, contentIndex) =>
        normalizeCharacterContent(item, index, contentIndex)
      )
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

    const worlds = (rawProject.worlds || []).map(normalizeWorld);
    const characters = (rawProject.characters || []).map(normalizeCharacter);
    const worldIds = new Set();

    for (const world of worlds) {
      if (worldIds.has(world.id)) {
        throw new Error(`중복된 세계관 ID가 있습니다: ${world.id}`);
      }
      worldIds.add(world.id);
    }

    const characterIds = new Set();
    for (const character of characters) {
      if (characterIds.has(character.id)) {
        throw new Error(`중복된 캐릭터 ID가 있습니다: ${character.id}`);
      }
      characterIds.add(character.id);
    }

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
      worlds,
      characters
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


  function createEntityId(prefix) {
    if (window.crypto?.randomUUID) {
      return `${prefix}-${window.crypto.randomUUID()}`;
    }

    return `${prefix}-${Date.now().toString(36)}-${Math.random()
      .toString(36)
      .slice(2, 10)}`;
  }

  function createWorld() {
    return {
      id: createEntityId("world"),
      name: "",
      subtitle: "",
      image: "",
      tags: [],
      description: [],
      sections: []
    };
  }

  function createWorldSection() {
    return {
      id: createEntityId("world-section"),
      title: "",
      content: [],
      collapsible: false
    };
  }


  function createCharacter() {
    return {
      id: createEntityId("character"),
      worldId: "",
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

  function createCharacterContent() {
    return {
      id: createEntityId("character-content"),
      type: "",
      title: "",
      content: [],
      spoiler: false,
      warning: ""
    };
  }

  function getSelectedCharacter() {
    return project.characters.find(
      (character) => character.id === selectedCharacterId
    ) || null;
  }

  function getCharacterImageMetadata(image) {
    return isPlainObject(image) ? image : null;
  }

  function platformIconUrl(platform) {
    if (!platform?.icon) return "";
    return `${ADMIN_ASSET_BASE}${platform.icon}`;
  }

  function getSelectedWorld() {
    return project.worlds.find((world) => world.id === selectedWorldId) || null;
  }

  function getWorldImageMetadata(world) {
    return isPlainObject(world?.image) ? world.image : null;
  }

  function splitTags(value) {
    const seen = new Set();

    return String(value || "")
      .split(/[,\n]/)
      .map((tag) => tag.trim())
      .filter((tag) => {
        if (!tag || seen.has(tag)) return false;
        seen.add(tag);
        return true;
      });
  }

  function legacyImageUrl(path) {
    const value = String(path || "").trim();
    if (!value) return "";
    if (/^(?:https?:|data:|blob:)/i.test(value)) return value;
    return `${ADMIN_ASSET_BASE}${value.replace(/^\.?\//, "")}`;
  }

  function worldImageUrl(world) {
    if (!world) return "";
    const storedUrl = worldImagePreviewUrls.get(world.id);
    if (storedUrl) return storedUrl;
    return typeof world.image === "string" ? legacyImageUrl(world.image) : "";
  }

  function characterImageEntryUrl(image) {
    if (!image) return "";
    if (typeof image === "string") return legacyImageUrl(image);
    const metadata = getCharacterImageMetadata(image);
    if (!metadata?.id) return "";
    return characterImagePreviewUrls.get(metadata.id) || "";
  }

  function characterImageUrl(character, index = 0) {
    const image = Array.isArray(character?.images)
      ? character.images[index]
      : "";
    return characterImageEntryUrl(image);
  }

  function charactersInWorld(worldId) {
    return project.characters.filter(
      (character) => character && character.worldId === worldId
    );
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


  function releaseWorldImageObjectUrl(worldId) {
    const url = worldImagePreviewUrls.get(worldId);
    if (url) URL.revokeObjectURL(url);
    worldImagePreviewUrls.delete(worldId);
    worldImageBlobs.delete(worldId);
    missingWorldImageIds.delete(worldId);
  }

  function releaseAllWorldImageObjectUrls() {
    for (const worldId of [...worldImagePreviewUrls.keys()]) {
      releaseWorldImageObjectUrl(worldId);
    }
    worldImageBlobs.clear();
    missingWorldImageIds.clear();
  }


  function releaseCharacterImageObjectUrl(imageId) {
    const url = characterImagePreviewUrls.get(imageId);
    if (url) URL.revokeObjectURL(url);
    characterImagePreviewUrls.delete(imageId);
    characterImageBlobs.delete(imageId);
    missingCharacterImageIds.delete(imageId);
  }

  function releaseAllCharacterImageObjectUrls() {
    for (const imageId of [...characterImagePreviewUrls.keys()]) {
      releaseCharacterImageObjectUrl(imageId);
    }
    characterImageBlobs.clear();
    missingCharacterImageIds.clear();
  }

  function updateWorldImageStorageStatus() {
    const world = getSelectedWorld();
    if (!elements.worldImageStorageStatus || !world) return;

    const metadata = getWorldImageMetadata(world);

    if (missingWorldImageIds.has(world.id)) {
      elements.worldImageStorageStatus.textContent =
        "저장된 PNG 파일을 찾을 수 없습니다. PNG를 다시 선택해 주세요.";
      return;
    }

    if (worldImageBlobs.has(world.id) && metadata) {
      elements.worldImageStorageStatus.textContent =
        `브라우저에 저장됨: ${metadata.name} · ${formatBytes(metadata.size)}`;
      return;
    }

    if (metadata) {
      elements.worldImageStorageStatus.textContent = "저장된 PNG를 확인하는 중입니다.";
      return;
    }

    if (typeof world.image === "string" && world.image) {
      elements.worldImageStorageStatus.textContent =
        "프로젝트의 기존 이미지 경로를 사용 중입니다. 새 PNG로 교체할 수 있습니다.";
      return;
    }

    elements.worldImageStorageStatus.textContent =
      "PNG는 이 브라우저에 저장되어 새로고침 후에도 유지됩니다. 최대 10MB.";
  }

  function renderWorldImageEditorPreview() {
    const world = getSelectedWorld();
    if (!world) return;

    const url = worldImageUrl(world);
    elements.worldImageEditorPreview.hidden = !url;
    elements.worldImageEditorFallback.hidden = Boolean(url);
    elements.removeWorldImageButton.hidden = !world.image;

    if (url) elements.worldImageEditorPreview.src = url;
    else elements.worldImageEditorPreview.removeAttribute("src");

    updateWorldImageStorageStatus();
  }


  function characterDisplayName(character, index = 0) {
    return character?.name || `새 캐릭터 ${index + 1}`;
  }

  function renderCharacterList() {
    if (project.characters.length === 0) {
      elements.characterEditorList.innerHTML =
        '<p class="empty-message">등록된 캐릭터가 없습니다.</p>';
      return;
    }

    elements.characterEditorList.innerHTML = project.characters.map((character, index) => {
      const imageUrl = characterImageUrl(character);
      const thumb = imageUrl
        ? `<img src="${escapeHtml(imageUrl)}" alt="" loading="lazy">`
        : `<span>${escapeHtml(String(character.name || "?").slice(0, 1))}</span>`;
      return `
        <button
          class="character-editor-list-item ${character.id === selectedCharacterId ? "is-active" : ""}"
          type="button"
          data-select-character="${escapeHtml(character.id)}"
          aria-pressed="${character.id === selectedCharacterId}"
        >
          <span class="character-editor-list-thumb" aria-hidden="true">${thumb}</span>
          <span class="character-editor-list-copy">
            <strong>${escapeHtml(characterDisplayName(character, index))}</strong>
            <small>${escapeHtml(character.subtitle || "부제를 입력해 주세요")}</small>
          </span>
          ${character.featured ? '<b class="character-editor-featured-mark" title="추천 캐릭터">★</b>' : ""}
        </button>
      `;
    }).join("");
  }

  function renderCharacterWorldOptions() {
    const character = getSelectedCharacter();
    if (!character) return;

    elements.characterWorldSelect.innerHTML = [
      '<option value="">독립 캐릭터</option>',
      ...project.worlds.map((world) => `
        <option value="${escapeHtml(world.id)}" ${character.worldId === world.id ? "selected" : ""}>
          ${escapeHtml(world.name || "이름 없는 세계관")}
        </option>
      `)
    ].join("");
  }

  function renderCharacterGenres() {
    const character = getSelectedCharacter();
    if (!character) return;

    const allGenres = [...new Set([
      ...genreOptions,
      ...(character.genres || [])
    ])];

    if (allGenres.length === 0) {
      elements.characterGenreList.innerHTML =
        '<p class="empty-message">관리자 장르가 등록되어 있지 않습니다.</p>';
      return;
    }

    elements.characterGenreList.innerHTML = allGenres.map((genre) => `
      <label class="character-option-item">
        <input
          type="checkbox"
          data-character-genre="${escapeHtml(genre)}"
          ${(character.genres || []).includes(genre) ? "checked" : ""}
        >
        <span>${escapeHtml(genre)}</span>
      </label>
    `).join("");
  }

  function characterPlatformOptions(character) {
    const selectedIds = (character.platforms || []).map((item) => item.id);
    const unknown = selectedIds
      .filter((id) => !platformCatalog.has(id))
      .map((id) => ({ id, name: id, icon: "" }));
    return [...platformOptions, ...unknown];
  }

  function renderCharacterPlatforms() {
    const character = getSelectedCharacter();
    if (!character) return;

    const options = characterPlatformOptions(character);
    if (options.length === 0) {
      elements.characterPlatformList.innerHTML =
        '<p class="empty-message">관리자 플랫폼이 등록되어 있지 않습니다.</p>';
      return;
    }

    elements.characterPlatformList.innerHTML = options.map((platform) => {
      const selected = (character.platforms || []).find((item) => item.id === platform.id);
      const icon = platform.icon
        ? `<img src="${escapeHtml(platformIconUrl(platform))}" alt="">`
        : `<span>${escapeHtml(String(platform.name || platform.id).slice(0, 1))}</span>`;
      return `
        <div class="character-platform-editor-item" data-character-platform-id="${escapeHtml(platform.id)}">
          <label class="character-platform-toggle">
            <input type="checkbox" data-character-platform-toggle ${selected ? "checked" : ""}>
            <span class="character-platform-editor-icon" aria-hidden="true">${icon}</span>
            <strong>${escapeHtml(platform.name || platform.id)}</strong>
          </label>
          <input
            type="url"
            inputmode="url"
            data-character-platform-url
            value="${escapeHtml(selected?.url || "")}"
            placeholder="https://..."
            ${selected ? "" : "disabled"}
            aria-label="${escapeHtml(platform.name || platform.id)} 캐릭터 주소"
          >
        </div>
      `;
    }).join("");
  }

  function renderCharacterImagesEditor() {
    const character = getSelectedCharacter();
    if (!character || character.images.length === 0) {
      elements.characterImageList.innerHTML =
        '<p class="empty-message">등록된 이미지가 없습니다.</p>';
      elements.characterImageStorageStatus.textContent =
        "PNG는 이 브라우저에 저장되어 새로고침 후에도 유지됩니다. 이미지당 최대 10MB.";
      return;
    }

    elements.characterImageList.innerHTML = character.images.map((image, index) => {
      const imageUrl = characterImageEntryUrl(image);
      const metadata = getCharacterImageMetadata(image);
      const missing = Boolean(metadata?.id && missingCharacterImageIds.has(metadata.id));
      const preview = imageUrl
        ? `<img src="${escapeHtml(imageUrl)}" alt="캐릭터 이미지 ${index + 1}">`
        : `<span>${missing ? "파일 없음" : "IMAGE"}</span>`;
      return `
        <article class="character-image-editor-item" data-character-image-index="${index}">
          <div class="character-image-editor-preview">${preview}</div>
          <div class="character-image-editor-meta">
            <strong>${index === 0 ? "대표 이미지" : `이미지 ${index + 1}`}</strong>
            <small>${escapeHtml(metadata?.name || (typeof image === "string" ? image : "이미지"))}</small>
          </div>
          <div class="character-image-editor-actions">
            <button type="button" data-move-character-image="up" ${index === 0 ? "disabled" : ""}>위로</button>
            <button type="button" data-move-character-image="down" ${index === character.images.length - 1 ? "disabled" : ""}>아래로</button>
            <button type="button" data-delete-character-image>삭제</button>
          </div>
        </article>
      `;
    }).join("");

    const missingCount = character.images.filter((image) => {
      const metadata = getCharacterImageMetadata(image);
      return metadata?.id && missingCharacterImageIds.has(metadata.id);
    }).length;
    elements.characterImageStorageStatus.textContent = missingCount > 0
      ? `저장된 PNG ${missingCount}개를 찾을 수 없습니다. 다시 선택해 주세요.`
      : `등록 이미지 ${character.images.length}/5 · 브라우저에 저장됨`;
  }

  function renderCharacterContentsEditor() {
    const character = getSelectedCharacter();
    if (!character || character.contents.length === 0) {
      elements.characterContentList.innerHTML =
        '<p class="empty-message">추가 콘텐츠가 없습니다.</p>';
      return;
    }

    elements.characterContentList.innerHTML = character.contents.map((item, index) => `
      <article class="character-content-editor-item" data-character-content-id="${escapeHtml(item.id)}">
        <div class="character-content-editor-toolbar">
          <span>추가 콘텐츠 ${index + 1}</span>
          <button type="button" data-move-character-content="up" ${index === 0 ? "disabled" : ""}>위로</button>
          <button type="button" data-move-character-content="down" ${index === character.contents.length - 1 ? "disabled" : ""}>아래로</button>
          <button type="button" data-delete-character-content>삭제</button>
        </div>
        <label>
          <span>분류</span>
          <input type="text" value="${escapeHtml(item.type)}" placeholder="예: 제작 비하인드" data-character-content-field="type">
        </label>
        <label>
          <span>제목</span>
          <input type="text" value="${escapeHtml(item.title)}" placeholder="예: 이름과 모티프" data-character-content-field="title">
        </label>
        <label>
          <span>내용</span>
          <textarea rows="5" placeholder="문단을 나누려면 빈 줄을 하나 넣어주세요." data-character-content-field="content">${escapeHtml(bioArrayToText(item.content))}</textarea>
        </label>
        <label class="character-content-spoiler-option">
          <input type="checkbox" data-character-content-field="spoiler" ${item.spoiler ? "checked" : ""}>
          <span>스포일러 콘텐츠</span>
        </label>
        <label data-character-warning-field ${item.spoiler ? "" : "hidden"}>
          <span>스포일러 경고문</span>
          <input type="text" value="${escapeHtml(item.warning)}" placeholder="예: 핵심 반전이 포함되어 있습니다." data-character-content-field="warning">
        </label>
      </article>
    `).join("");
  }

  function populateCharacterFields() {
    const character = getSelectedCharacter();
    const hasCharacter = Boolean(character);
    elements.characterForm.hidden = !hasCharacter;
    elements.characterEditorEmpty.hidden = hasCharacter;
    if (!character) return;

    elements.characterNameInput.value = character.name || "";
    elements.characterSubtitleInput.value = character.subtitle || "";
    elements.characterFeaturedInput.checked = character.featured === true;
    elements.characterTagsInput.value = (character.tags || []).join(", ");
    elements.characterDescriptionInput.value = bioArrayToText(character.description);

    const index = project.characters.findIndex((item) => item.id === character.id);
    elements.moveCharacterUpButton.disabled = index <= 0;
    elements.moveCharacterDownButton.disabled = index < 0 || index >= project.characters.length - 1;

    renderCharacterWorldOptions();
    renderCharacterGenres();
    renderCharacterPlatforms();
    renderCharacterImagesEditor();
    renderCharacterContentsEditor();
  }

  function renderCharacterEditor() {
    if (!project.characters.some((character) => character.id === selectedCharacterId)) {
      selectedCharacterId = project.characters[0]?.id || "";
    }
    renderCharacterList();
    populateCharacterFields();
  }

  function characterPlatformDots(character) {
    return (character.platforms || []).map((link) => {
      const platform = platformCatalog.get(link.id) || { id: link.id, name: link.id, icon: "" };
      return platform.icon
        ? `<span class="character-preview-platform-dot" title="${escapeHtml(platform.name)}"><img src="${escapeHtml(platformIconUrl(platform))}" alt=""></span>`
        : `<span class="character-preview-platform-dot" title="${escapeHtml(platform.name)}">${escapeHtml(String(platform.name).slice(0, 1))}</span>`;
    }).join("");
  }

  function characterCardMarkup(character, featured = false) {
    const imageUrl = characterImageUrl(character);
    const image = imageUrl
      ? `<img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(character.name || "캐릭터")} 대표 이미지" loading="lazy">`
      : '<span class="character-preview-card-image-fallback">CHARACTER</span>';
    const genres = (character.genres || []).slice(0, 2)
      .map((genre) => `<span>${escapeHtml(genre)}</span>`).join("");

    return `
      <article class="character-preview-card ${featured ? "is-featured" : ""}" data-preview-character-card="${escapeHtml(character.id)}">
        <button type="button" class="character-preview-card-button" data-preview-character="${escapeHtml(character.id)}" aria-label="${escapeHtml(character.name || "이름 없는 캐릭터")} 상세 보기">
          <div class="character-preview-card-image-wrap">
            ${image}
            <div class="character-preview-card-platforms">${characterPlatformDots(character)}</div>
          </div>
          <div class="character-preview-card-body">
            <div class="character-preview-card-genres">${genres}</div>
            <h3>${escapeHtml(character.name || "이름 없는 캐릭터")}</h3>
            <p>${escapeHtml(character.subtitle || "캐릭터 부제를 입력해 주세요.")}</p>
            <span class="character-preview-card-more">상세 보기 <b aria-hidden="true">↗</b></span>
          </div>
        </button>
      </article>
    `;
  }

  function previewCharacterColumnCount() {
    const template = getComputedStyle(elements.previewCharacterGrid).gridTemplateColumns;
    if (!template || template === "none") return 1;
    return Math.max(1, template.split(/\s+/).filter(Boolean).length);
  }

  function updateCharacterPreviewLimit() {
    const cards = [...elements.previewCharacterGrid.children];
    const visibleLimit = previewCharacterColumnCount() * 2;
    const canCollapse = cards.length > visibleLimit;
    const expanded = characterPreviewExpanded || !canCollapse;
    cards.forEach((card, index) => {
      card.hidden = !expanded && index >= visibleLimit;
    });
    elements.previewCharacterToggleWrap.hidden = !canCollapse;
    elements.previewCharacterToggle.setAttribute("aria-expanded", String(expanded));
    elements.previewCharacterToggle.classList.toggle("is-expanded", expanded);
    const hiddenCount = Math.max(0, cards.length - visibleLimit);
    const label = elements.previewCharacterToggle.querySelector("span");
    if (label) label.textContent = expanded ? "캐릭터 접기" : `캐릭터 더보기 +${hiddenCount}`;
  }

  function renderCharacterPreview() {
    const featured = [
      ...project.characters.filter((character) => character.featured),
      ...project.characters.filter((character) => !character.featured)
    ].filter((character, index, list) =>
      list.findIndex((item) => item.id === character.id) === index
    ).slice(0, 3);

    elements.previewFeaturedSection.hidden = featured.length === 0;
    elements.previewFeaturedGrid.innerHTML = featured
      .map((character) => characterCardMarkup(character, true)).join("");

    const hasCharacters = project.characters.length > 0;
    elements.previewCharacterGrid.innerHTML = hasCharacters
      ? project.characters.map((character) => characterCardMarkup(character)).join("")
      : "";
    elements.previewCharacterEmpty.hidden = hasCharacters;
    if (!hasCharacters) characterPreviewExpanded = false;
    updateCharacterPreviewLimit();
  }

  function characterContentMarkup(item) {
    const type = item.type || (item.spoiler ? "스포일러" : "추가 정보");
    const title = item.title || "제목 없는 콘텐츠";
    const body = (item.content || []).map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join("");
    if (item.spoiler) {
      return `
        <details class="character-preview-content-box is-spoiler">
          <summary>
            <span class="character-preview-content-icon">⚠</span>
            <span>
              <small>${escapeHtml(type)}</small>
              <strong>${escapeHtml(title)}</strong>
              <em>${escapeHtml(item.warning || "스포일러가 포함되어 있습니다.")}</em>
            </span>
            <b aria-hidden="true">⌄</b>
          </summary>
          <div class="character-preview-content-body">${body}</div>
        </details>
      `;
    }
    return `
      <article class="character-preview-content-box is-public">
        <header>
          <span class="character-preview-content-icon">✦</span>
          <span><small>${escapeHtml(type)}</small><strong>${escapeHtml(title)}</strong></span>
        </header>
        <div class="character-preview-content-body">${body}</div>
      </article>
    `;
  }

  function openCharacterPreview(character) {
    if (!character) return;
    if (elements.worldPreviewModal.open) closeWorldPreview();

    const images = (character.images || []).slice(0, 5);
    const urls = images.map(characterImageEntryUrl);
    const firstAvailableIndex = urls.findIndex(Boolean);
    const mainIndex = firstAvailableIndex >= 0 ? firstAvailableIndex : 0;
    const mainUrl = urls[mainIndex] || "";

    elements.characterPreviewModalTitle.textContent = character.name || "이름 없는 캐릭터";
    elements.characterPreviewModalSummary.textContent = character.subtitle || "";
    elements.characterPreviewModalSummary.hidden = !character.subtitle;
    elements.characterPreviewMainImage.hidden = !mainUrl;
    elements.characterPreviewMainImageFallback.hidden = Boolean(mainUrl);
    if (mainUrl) {
      elements.characterPreviewMainImage.src = mainUrl;
      elements.characterPreviewMainImage.alt = `${character.name || "캐릭터"} 이미지 ${mainIndex + 1}`;
    } else {
      elements.characterPreviewMainImage.removeAttribute("src");
      elements.characterPreviewMainImage.alt = "";
    }

    const validImages = urls.map((url, index) => ({ url, index })).filter((item) => item.url);
    elements.characterPreviewThumbnails.hidden = validImages.length <= 1;
    elements.characterPreviewThumbnails.innerHTML = validImages.length > 1
      ? validImages.map(({ url, index }) => `
          <button type="button" class="character-preview-thumbnail ${index === mainIndex ? "is-active" : ""}" data-character-preview-image="${escapeHtml(url)}" data-character-preview-alt="${escapeHtml(`${character.name || "캐릭터"} 이미지 ${index + 1}`)}">
            <img src="${escapeHtml(url)}" alt="">
          </button>
        `).join("")
      : "";

    elements.characterPreviewKicker.textContent = (character.genres || []).join(" · ") || "CHARACTER";
    elements.characterPreviewModalTags.innerHTML = [
      ...(character.genres || []),
      ...(character.tags || [])
    ].map((tag) => `<span>${escapeHtml(tag)}</span>`).join("");
    elements.characterPreviewModalTags.hidden = !(character.genres || []).length && !(character.tags || []).length;
    elements.characterPreviewModalDescription.innerHTML = (character.description || [])
      .map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join("");
    elements.characterPreviewModalDescription.hidden = !(character.description || []).length;

    elements.characterPreviewPlatforms.innerHTML = (character.platforms || []).map((link) => {
      const platform = platformCatalog.get(link.id) || { id: link.id, name: link.id, icon: "" };
      const content = platform.icon
        ? `<img src="${escapeHtml(platformIconUrl(platform))}" alt=""><span class="sr-only">${escapeHtml(platform.name)}</span>`
        : `<span>${escapeHtml(String(platform.name).slice(0, 1))}</span>`;
      if (link.url && normalizeUrl(link.url)) {
        return `<a href="${escapeHtml(link.url)}" target="_blank" rel="noreferrer" title="${escapeHtml(platform.name)}">${content}</a>`;
      }
      return `<span class="is-disabled" title="${escapeHtml(platform.name)}">${content}</span>`;
    }).join("");
    elements.characterPreviewPlatforms.hidden = !(character.platforms || []).length;

    const world = project.worlds.find((item) => item.id === character.worldId);
    elements.characterPreviewWorldPanel.hidden = !world;
    if (world) {
      elements.characterPreviewWorldButton.dataset.previewWorld = world.id;
      elements.characterPreviewWorldName.textContent = world.name || "이름 없는 세계관";
      elements.characterPreviewWorldSummary.textContent = world.subtitle || "";
    } else {
      delete elements.characterPreviewWorldButton.dataset.previewWorld;
      elements.characterPreviewWorldName.textContent = "";
      elements.characterPreviewWorldSummary.textContent = "";
    }

    elements.characterPreviewContentSection.hidden = !(character.contents || []).length;
    elements.characterPreviewContents.innerHTML = (character.contents || [])
      .map(characterContentMarkup).join("");

    elements.characterPreviewModal.showModal();
    document.body.classList.add("character-preview-modal-open");
  }

  function closeCharacterPreview() {
    if (elements.characterPreviewModal.open) elements.characterPreviewModal.close();
    document.body.classList.remove("character-preview-modal-open");
  }

  function syncCharacterFromFields() {
    const character = getSelectedCharacter();
    if (!character) return;

    const requestedFeatured = elements.characterFeaturedInput.checked;
    if (requestedFeatured && !character.featured) {
      const featuredCount = project.characters.filter((item) => item.featured).length;
      if (featuredCount >= 3) {
        elements.characterFeaturedInput.checked = false;
        window.alert("추천 캐릭터는 최대 3명까지 지정할 수 있습니다.");
      } else {
        character.featured = true;
      }
    } else {
      character.featured = requestedFeatured;
    }

    character.name = elements.characterNameInput.value.trim();
    character.subtitle = elements.characterSubtitleInput.value.trim();
    character.worldId = elements.characterWorldSelect.value;
    character.tags = splitTags(elements.characterTagsInput.value);
    character.description = bioTextToArray(elements.characterDescriptionInput.value);

    renderCharacterList();
    renderWorldCharacterLinks();
    renderCharacterPreview();
    renderWorldPreview();
    scheduleAutosave();
  }

  function addCharacter() {
    const character = createCharacter();
    project.characters.push(character);
    selectedCharacterId = character.id;
    if (project.characters.length > previewCharacterColumnCount() * 2) {
      characterPreviewExpanded = true;
    }
    renderCharacterEditor();
    renderWorldEditor();
    renderCharacterPreview();
    renderWorldPreview();
    scheduleAutosave();
    elements.characterNameInput.focus();
  }

  async function deleteSelectedCharacter() {
    const character = getSelectedCharacter();
    if (!character) return;
    if (!window.confirm(`“${character.name || "이름 없는 캐릭터"}”을 삭제할까요?`)) return;

    const index = project.characters.findIndex((item) => item.id === character.id);
    const metadata = character.images.map(getCharacterImageMetadata).filter(Boolean);
    for (const image of metadata) releaseCharacterImageObjectUrl(image.id);
    project.characters.splice(index, 1);
    selectedCharacterId = project.characters[index]?.id || project.characters[index - 1]?.id || "";
    if (project.characters.length <= previewCharacterColumnCount() * 2) characterPreviewExpanded = false;

    renderCharacterEditor();
    renderWorldEditor();
    renderCharacterPreview();
    renderWorldPreview();
    saveProjectToStorage();

    for (const image of metadata) {
      try { await deleteImageRecord(image.id); } catch (error) { console.error(error); }
    }
    setSaveStatus("캐릭터가 삭제됨");
  }

  function moveSelectedCharacter(direction) {
    const index = project.characters.findIndex((character) => character.id === selectedCharacterId);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= project.characters.length) return;
    const [character] = project.characters.splice(index, 1);
    project.characters.splice(target, 0, character);
    renderCharacterEditor();
    renderWorldEditor();
    renderCharacterPreview();
    renderWorldPreview();
    scheduleAutosave();
  }

  function toggleCharacterGenre(target) {
    const character = getSelectedCharacter();
    if (!character) return;
    const genre = target.dataset.characterGenre;
    if (target.checked) {
      if (!character.genres.includes(genre)) character.genres.push(genre);
    } else {
      character.genres = character.genres.filter((item) => item !== genre);
    }
    renderCharacterPreview();
    scheduleAutosave();
  }

  function updateCharacterPlatform(target) {
    const character = getSelectedCharacter();
    const row = target.closest("[data-character-platform-id]");
    if (!character || !row) return;
    const id = row.dataset.characterPlatformId;
    const existingIndex = character.platforms.findIndex((item) => item.id === id);

    if (target.hasAttribute("data-character-platform-toggle")) {
      if (target.checked && existingIndex < 0) character.platforms.push({ id, url: "" });
      if (!target.checked && existingIndex >= 0) character.platforms.splice(existingIndex, 1);
      renderCharacterPlatforms();
    } else if (target.hasAttribute("data-character-platform-url")) {
      if (existingIndex >= 0) character.platforms[existingIndex].url = target.value.trim();
    }

    renderCharacterPreview();
    scheduleAutosave();
  }

  function addCharacterContent() {
    const character = getSelectedCharacter();
    if (!character) return;
    character.contents.push(createCharacterContent());
    renderCharacterContentsEditor();
    renderCharacterPreview();
    scheduleAutosave();
    requestAnimationFrame(() => {
      const items = elements.characterContentList.querySelectorAll(".character-content-editor-item");
      items[items.length - 1]?.querySelector("input")?.focus();
    });
  }

  function updateCharacterContentFromInput(target) {
    const character = getSelectedCharacter();
    const itemElement = target.closest("[data-character-content-id]");
    if (!character || !itemElement) return;
    const item = character.contents.find((entry) => entry.id === itemElement.dataset.characterContentId);
    if (!item) return;

    const field = target.dataset.characterContentField;
    if (field === "content") item.content = bioTextToArray(target.value);
    else if (field === "spoiler") {
      item.spoiler = target.checked;
      itemElement.querySelector("[data-character-warning-field]").hidden = !item.spoiler;
    } else if (["type", "title", "warning"].includes(field)) item[field] = target.value.trim();
    else return;

    renderCharacterPreview();
    scheduleAutosave();
  }

  function handleCharacterContentAction(button) {
    const character = getSelectedCharacter();
    const itemElement = button.closest("[data-character-content-id]");
    if (!character || !itemElement) return;
    const index = character.contents.findIndex((item) => item.id === itemElement.dataset.characterContentId);
    if (index < 0) return;

    if (button.hasAttribute("data-delete-character-content")) {
      character.contents.splice(index, 1);
    } else {
      const direction = button.dataset.moveCharacterContent === "up" ? -1 : 1;
      const target = index + direction;
      if (target < 0 || target >= character.contents.length) return;
      const [item] = character.contents.splice(index, 1);
      character.contents.splice(target, 0, item);
    }
    renderCharacterContentsEditor();
    renderCharacterPreview();
    scheduleAutosave();
  }

  async function handleCharacterImageSelection() {
    const character = getSelectedCharacter();
    const files = [...(elements.characterImageInput.files || [])];
    elements.characterImageInput.value = "";
    if (!character || files.length === 0) return;

    const remaining = 5 - character.images.length;
    if (remaining <= 0) {
      window.alert("캐릭터 이미지는 최대 5장까지 등록할 수 있습니다.");
      return;
    }
    if (files.length > remaining) {
      window.alert(`현재 ${remaining}장만 더 추가할 수 있습니다.`);
      return;
    }

    elements.characterImageInput.disabled = true;
    setSaveStatus("캐릭터 PNG 저장 중…");
    const storedIds = [];
    try {
      const nextMetadata = [];
      for (const file of files) {
        const sanitized = await sanitizePng(file, "캐릭터 PNG");
        const id = createImageId();
        const updatedAt = new Date().toISOString();
        const record = {
          id,
          role: "character-image",
          ownerId: character.id,
          name: file.name || "character.png",
          type: "image/png",
          size: sanitized.blob.size,
          width: sanitized.width,
          height: sanitized.height,
          updatedAt,
          blob: sanitized.blob
        };
        await putImageRecord(record);
        storedIds.push(id);
        characterImageBlobs.set(id, sanitized.blob);
        characterImagePreviewUrls.set(id, URL.createObjectURL(sanitized.blob));
        nextMetadata.push({
          id,
          name: record.name,
          type: record.type,
          size: record.size,
          width: record.width,
          height: record.height,
          updatedAt
        });
      }
      character.images.push(...nextMetadata);
      renderCharacterEditor();
      renderWorldEditor();
      renderCharacterPreview();
      renderWorldPreview();
      saveProjectToStorage();
      setSaveStatus(`캐릭터 PNG ${nextMetadata.length}개가 브라우저에 저장됨`);
    } catch (error) {
      for (const id of storedIds) {
        releaseCharacterImageObjectUrl(id);
        try { await deleteImageRecord(id); } catch (cleanupError) { console.error(cleanupError); }
      }
      console.error(error);
      window.alert(error.message || "캐릭터 이미지를 처리하지 못했습니다.");
      setSaveStatus("캐릭터 PNG 저장 실패");
    } finally {
      elements.characterImageInput.disabled = false;
    }
  }

  async function handleCharacterImageAction(button) {
    const character = getSelectedCharacter();
    const item = button.closest("[data-character-image-index]");
    if (!character || !item) return;
    const index = Number(item.dataset.characterImageIndex);
    if (!Number.isInteger(index) || !character.images[index]) return;

    if (button.hasAttribute("data-delete-character-image")) {
      const [image] = character.images.splice(index, 1);
      const metadata = getCharacterImageMetadata(image);
      if (metadata?.id) {
        releaseCharacterImageObjectUrl(metadata.id);
        try { await deleteImageRecord(metadata.id); } catch (error) { console.error(error); }
      }
    } else {
      const direction = button.dataset.moveCharacterImage === "up" ? -1 : 1;
      const target = index + direction;
      if (target < 0 || target >= character.images.length) return;
      const [image] = character.images.splice(index, 1);
      character.images.splice(target, 0, image);
    }

    renderCharacterEditor();
    renderWorldEditor();
    renderCharacterPreview();
    renderWorldPreview();
    saveProjectToStorage();
  }

  function renderWorldList() {
    if (project.worlds.length === 0) {
      elements.worldEditorList.innerHTML =
        '<p class="empty-message">등록된 세계관이 없습니다.</p>';
      return;
    }

    elements.worldEditorList.innerHTML = project.worlds.map((world, index) => {
      const url = worldImageUrl(world);
      const thumb = url
        ? `<img src="${escapeHtml(url)}" alt="">`
        : "WORLD";

      return `
        <button
          class="world-editor-list-item ${world.id === selectedWorldId ? "is-active" : ""}"
          type="button"
          data-select-world="${escapeHtml(world.id)}"
          aria-pressed="${world.id === selectedWorldId}"
        >
          <span class="world-editor-list-thumb" aria-hidden="true">${thumb}</span>
          <span class="world-editor-list-copy">
            <strong>${escapeHtml(world.name || `새 세계관 ${index + 1}`)}</strong>
            <small>${escapeHtml(world.subtitle || "부제를 입력해 주세요")}</small>
          </span>
        </button>
      `;
    }).join("");
  }

  function renderWorldSectionsEditor() {
    const world = getSelectedWorld();
    if (!world || world.sections.length === 0) {
      elements.worldSectionList.innerHTML =
        '<p class="empty-message">추가 정보가 없습니다.</p>';
      return;
    }

    elements.worldSectionList.innerHTML = world.sections.map((section, index) => `
      <article
        class="world-section-editor-item"
        data-world-section-id="${escapeHtml(section.id)}"
      >
        <div class="world-section-editor-toolbar">
          <span>추가 정보 ${index + 1}</span>
          <button type="button" data-move-world-section="up" ${index === 0 ? "disabled" : ""}>위로</button>
          <button type="button" data-move-world-section="down" ${index === world.sections.length - 1 ? "disabled" : ""}>아래로</button>
          <button type="button" data-delete-world-section>삭제</button>
        </div>
        <label>
          <span>제목</span>
          <input
            type="text"
            value="${escapeHtml(section.title)}"
            placeholder="예: 세계의 핵심"
            data-world-section-field="title"
          >
        </label>
        <label>
          <span>내용</span>
          <textarea
            rows="5"
            placeholder="문단을 나누려면 빈 줄을 하나 넣어주세요."
            data-world-section-field="content"
          >${escapeHtml(bioArrayToText(section.content))}</textarea>
        </label>
        <label class="world-section-collapsible-option">
          <input
            type="checkbox"
            data-world-section-field="collapsible"
            ${section.collapsible ? "checked" : ""}
          >
          <span>
            <strong>상세 화면에서 접기 사용</strong>
            <small>선택하면 상세 화면에서 제목만 보이는 닫힌 상태로 시작합니다.</small>
          </span>
        </label>
      </article>
    `).join("");
  }

  function renderWorldCharacterLinks() {
    const world = getSelectedWorld();

    if (!world || project.characters.length === 0) {
      elements.worldCharacterLinkList.innerHTML =
        '<p class="empty-message">등록된 캐릭터가 없습니다.</p>';
      return;
    }

    const characters = project.characters
      .map((character, index) => ({ character, index }))
      .filter(({ character }) => character && typeof character === "object");

    if (characters.length === 0) {
      elements.worldCharacterLinkList.innerHTML =
        '<p class="empty-message">등록된 캐릭터가 없습니다.</p>';
      return;
    }

    elements.worldCharacterLinkList.innerHTML = characters.map(
      ({ character, index }) => {
        const imageUrl = characterImageUrl(character);
        const currentWorld = project.worlds.find(
          (entry) => entry.id === character.worldId
        );
        const isLinked = character.worldId === world.id;
        const status = isLinked
          ? "현재 세계관에 연결됨"
          : currentWorld
            ? `${currentWorld.name || "이름 없는 세계관"}에 연결됨`
            : "연결된 세계관 없음";
        const thumbnail = imageUrl
          ? `<img src="${escapeHtml(imageUrl)}" alt="" loading="lazy">`
          : `<span aria-hidden="true">${escapeHtml(
              String(character.name || "?").slice(0, 1)
            )}</span>`;

        return `
          <label class="world-character-link-item">
            <input
              type="checkbox"
              data-world-character-index="${index}"
              ${isLinked ? "checked" : ""}
            >
            <span class="world-character-link-thumb" aria-hidden="true">
              ${thumbnail}
            </span>
            <span class="world-character-link-copy">
              <strong>${escapeHtml(character.name || "이름 없는 캐릭터")}</strong>
              <small>${escapeHtml(status)}</small>
            </span>
          </label>
        `;
      }
    ).join("");
  }

  function updateWorldCharacterLink(target) {
    const world = getSelectedWorld();
    const characterIndex = Number(target.dataset.worldCharacterIndex);
    const character = project.characters[characterIndex];

    if (!world || !Number.isInteger(characterIndex) || !character) return;

    if (target.checked) {
      character.worldId = world.id;
    } else if (character.worldId === world.id) {
      character.worldId = "";
    }

    renderWorldCharacterLinks();
    renderCharacterEditor();
    renderCharacterPreview();
    renderWorldPreview();
    scheduleAutosave();
  }

  function populateWorldFields() {
    const world = getSelectedWorld();
    const hasWorld = Boolean(world);

    elements.worldForm.hidden = !hasWorld;
    elements.worldEditorEmpty.hidden = hasWorld;

    if (!world) return;

    elements.worldNameInput.value = world.name || "";
    elements.worldSubtitleInput.value = world.subtitle || "";
    elements.worldTagsInput.value = (world.tags || []).join(", ");
    elements.worldDescriptionInput.value = bioArrayToText(world.description);

    const index = project.worlds.findIndex((item) => item.id === world.id);
    elements.moveWorldUpButton.disabled = index <= 0;
    elements.moveWorldDownButton.disabled = index < 0 || index >= project.worlds.length - 1;

    renderWorldCharacterLinks();
    renderWorldSectionsEditor();
    renderWorldImageEditorPreview();
  }

  function renderWorldEditor() {
    if (!project.worlds.some((world) => world.id === selectedWorldId)) {
      selectedWorldId = project.worlds[0]?.id || "";
    }

    renderWorldList();
    populateWorldFields();
  }

  function worldFaceMarkup(character) {
    const imageUrl = characterImageUrl(character);
    if (imageUrl) {
      return `<img src="${escapeHtml(imageUrl)}" alt="" loading="lazy">`;
    }
    return escapeHtml(String(character?.name || "?").slice(0, 1));
  }

  function worldCardMarkup(world) {
    const related = charactersInWorld(world.id);
    const tags = (world.tags || []).slice(0, 3)
      .map((tag) => `<span>${escapeHtml(tag)}</span>`)
      .join("");
    const faces = related.slice(0, 4).map((character) => `
      <span class="world-face" title="${escapeHtml(character.name || "캐릭터")}">
        ${worldFaceMarkup(character)}
      </span>
    `).join("");
    const imageUrl = worldImageUrl(world);
    const cover = imageUrl
      ? `<img src="${escapeHtml(imageUrl)}" alt="" loading="lazy">`
      : '<span class="world-card-image-fallback">WORLD ARCHIVE</span>';

    return `
      <article class="world-card">
        <button
          class="world-card-button"
          type="button"
          data-preview-world="${escapeHtml(world.id)}"
          aria-label="${escapeHtml(world.name || "이름 없는 세계관")} 세계관 보기"
        >
          <div class="world-card-image">
            ${cover}
            <div class="world-face-stack" aria-label="연결된 캐릭터">${faces}</div>
          </div>
          <div class="world-card-body">
            <div class="world-card-meta"><span>${related.length} Characters</span><b aria-hidden="true">↗</b></div>
            <h3>${escapeHtml(world.name || "이름 없는 세계관")}</h3>
            <p>${escapeHtml(world.subtitle || "세계관 부제를 입력해 주세요.")}</p>
            <div class="world-card-tags">${tags}</div>
          </div>
        </button>
      </article>
    `;
  }

  function previewWorldColumnCount() {
    if (!elements.previewWorldGrid) return 3;
    const template = getComputedStyle(elements.previewWorldGrid).gridTemplateColumns;
    if (!template || template === "none") return 3;
    return Math.max(1, template.split(/\s+/).filter(Boolean).length);
  }

  function updateWorldPreviewLimit() {
    const cards = [...elements.previewWorldGrid.children];
    const visibleLimit = previewWorldColumnCount();
    const canCollapse = cards.length > visibleLimit;
    const isExpanded = worldPreviewExpanded || !canCollapse;

    cards.forEach((card, index) => {
      card.hidden = !isExpanded && index >= visibleLimit;
    });

    elements.previewWorldToggleWrap.hidden = !canCollapse;
    elements.previewWorldToggle.classList.toggle("is-expanded", isExpanded);
    elements.previewWorldToggle.setAttribute("aria-expanded", String(isExpanded));

    const label = elements.previewWorldToggle.querySelector("span");
    if (label) {
      label.textContent = isExpanded
        ? "세계관 접기"
        : `세계관 더보기 +${Math.max(0, cards.length - visibleLimit)}`;
    }
  }

  function renderWorldPreview() {
    const hasWorlds = project.worlds.length > 0;
    elements.previewWorldGrid.hidden = !hasWorlds;
    elements.previewWorldEmpty.hidden = hasWorlds;
    elements.previewWorldGrid.innerHTML = hasWorlds
      ? project.worlds.map(worldCardMarkup).join("")
      : "";

    if (!hasWorlds) worldPreviewExpanded = false;
    updateWorldPreviewLimit();
    renderWorldImageEditorPreview();
  }

  function worldInfoSectionMarkup(section) {
    const title = escapeHtml(section.title || "세계관 정보");
    const content = (section.content || []).map((paragraph) =>
      `<p>${escapeHtml(paragraph)}</p>`
    ).join("");

    if (section.collapsible) {
      return `
        <details class="world-info-block world-info-block-collapsible">
          <summary>${title}</summary>
          <div class="world-info-block-content">${content}</div>
        </details>
      `;
    }

    return `
      <article class="world-info-block">
        <h3>${title}</h3>
        <div>${content}</div>
      </article>
    `;
  }

  function openWorldPreview(world) {
    if (!world) return;

    const imageUrl = worldImageUrl(world);
    elements.worldPreviewModalImage.hidden = !imageUrl;
    elements.worldPreviewModalImageFallback.hidden = Boolean(imageUrl);

    if (imageUrl) {
      elements.worldPreviewModalImage.src = imageUrl;
      elements.worldPreviewModalImage.alt = `${world.name || "세계관"} 대표 이미지`;
    } else {
      elements.worldPreviewModalImage.removeAttribute("src");
      elements.worldPreviewModalImage.alt = "";
    }

    elements.worldPreviewModalTitle.textContent = world.name || "이름 없는 세계관";
    elements.worldPreviewModalSummary.textContent = world.subtitle || "";
    elements.worldPreviewModalSummary.hidden = !world.subtitle;
    elements.worldPreviewModalTags.innerHTML = (world.tags || [])
      .map((tag) => `<span>${escapeHtml(tag)}</span>`)
      .join("");
    elements.worldPreviewModalTags.hidden = !(world.tags || []).length;
    elements.worldPreviewModalDescription.innerHTML = (world.description || [])
      .map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`)
      .join("");
    elements.worldPreviewModalDescription.hidden = !(world.description || []).length;
    elements.worldPreviewModalSections.innerHTML = (world.sections || [])
      .map(worldInfoSectionMarkup)
      .join("");
    elements.worldPreviewModalSections.hidden = !(world.sections || []).length;

    const related = charactersInWorld(world.id);
    elements.worldPreviewCharacterSection.hidden = related.length === 0;
    elements.worldPreviewCharacterList.innerHTML = related.map((character) => {
      const imageUrl = characterImageUrl(character);
      const face = imageUrl
        ? `<img src="${escapeHtml(imageUrl)}" alt="">`
        : `<span class="world-character-face-fallback" aria-hidden="true">${escapeHtml(String(character.name || "?").slice(0, 1))}</span>`;

      return `
        <button class="world-character-button" type="button" data-preview-character="${escapeHtml(character.id)}">
          ${face}
          <span>
            <strong>${escapeHtml(character.name || "이름 없는 캐릭터")}</strong>
            <small>${escapeHtml(character.subtitle || "")}</small>
          </span>
        </button>
      `;
    }).join("");

    elements.worldPreviewModal.showModal();
    document.body.classList.add("world-preview-modal-open");
  }

  function closeWorldPreview() {
    if (elements.worldPreviewModal.open) {
      elements.worldPreviewModal.close();
    }
    document.body.classList.remove("world-preview-modal-open");
  }

  function syncWorldFromFields() {
    const world = getSelectedWorld();
    if (!world) return;

    world.name = elements.worldNameInput.value.trim();
    world.subtitle = elements.worldSubtitleInput.value.trim();
    world.tags = splitTags(elements.worldTagsInput.value);
    world.description = bioTextToArray(elements.worldDescriptionInput.value);

    renderWorldList();
    renderCharacterWorldOptions();
    renderCharacterPreview();
    renderWorldPreview();
    scheduleAutosave();
  }

  function addWorld() {
    const world = createWorld();
    project.worlds.push(world);
    selectedWorldId = world.id;
    if (project.worlds.length > previewWorldColumnCount()) {
      worldPreviewExpanded = true;
    }
    renderWorldEditor();
    renderCharacterEditor();
    renderWorldPreview();
    renderCharacterPreview();
    scheduleAutosave();
    elements.worldNameInput.focus();
  }

  async function deleteSelectedWorld() {
    const world = getSelectedWorld();
    if (!world) return;

    const linkedCharacters = charactersInWorld(world.id);
    const linkedMessage = linkedCharacters.length
      ? `\n연결된 캐릭터 ${linkedCharacters.length}명은 독립 캐릭터로 변경됩니다.`
      : "";
    const confirmed = window.confirm(
      `“${world.name || "이름 없는 세계관"}”을 삭제할까요?${linkedMessage}`
    );

    if (!confirmed) return;

    const metadata = getWorldImageMetadata(world);
    const index = project.worlds.findIndex((item) => item.id === world.id);

    for (const character of linkedCharacters) {
      character.worldId = "";
    }

    releaseWorldImageObjectUrl(world.id);
    project.worlds.splice(index, 1);
    selectedWorldId = project.worlds[index]?.id || project.worlds[index - 1]?.id || "";
    if (project.worlds.length <= previewWorldColumnCount()) {
      worldPreviewExpanded = false;
    }

    if (metadata?.id) {
      try {
        await deleteImageRecord(metadata.id);
      } catch (error) {
        console.error(error);
        setSaveStatus("세계관은 삭제됐지만 저장 이미지 정리에 실패함");
      }
    }

    renderWorldEditor();
    renderCharacterEditor();
    renderWorldPreview();
    renderCharacterPreview();
    saveProjectToStorage();
  }

  function moveSelectedWorld(direction) {
    const index = project.worlds.findIndex((world) => world.id === selectedWorldId);
    const targetIndex = index + direction;
    if (index < 0 || targetIndex < 0 || targetIndex >= project.worlds.length) return;

    const [world] = project.worlds.splice(index, 1);
    project.worlds.splice(targetIndex, 0, world);
    renderWorldEditor();
    renderWorldPreview();
    scheduleAutosave();
  }

  function addWorldSection() {
    const world = getSelectedWorld();
    if (!world) return;
    world.sections.push(createWorldSection());
    renderWorldSectionsEditor();
    renderWorldPreview();
    scheduleAutosave();

    requestAnimationFrame(() => {
      const items = elements.worldSectionList.querySelectorAll(".world-section-editor-item");
      items[items.length - 1]?.querySelector("input")?.focus();
    });
  }

  function updateWorldSectionFromInput(target) {
    const item = target.closest("[data-world-section-id]");
    const world = getSelectedWorld();
    if (!item || !world) return;

    const section = world.sections.find(
      (entry) => entry.id === item.dataset.worldSectionId
    );
    if (!section) return;

    if (target.dataset.worldSectionField === "title") {
      section.title = target.value.trim();
    } else if (target.dataset.worldSectionField === "content") {
      section.content = bioTextToArray(target.value);
    } else if (target.dataset.worldSectionField === "collapsible") {
      section.collapsible = target.checked;
    } else {
      return;
    }

    renderWorldPreview();
    scheduleAutosave();
  }

  function handleWorldSectionAction(button) {
    const item = button.closest("[data-world-section-id]");
    const world = getSelectedWorld();
    if (!item || !world) return;

    const index = world.sections.findIndex(
      (section) => section.id === item.dataset.worldSectionId
    );
    if (index < 0) return;

    if (button.hasAttribute("data-delete-world-section")) {
      world.sections.splice(index, 1);
    } else {
      const direction = button.dataset.moveWorldSection === "up" ? -1 : 1;
      const targetIndex = index + direction;
      if (targetIndex < 0 || targetIndex >= world.sections.length) return;
      const [section] = world.sections.splice(index, 1);
      world.sections.splice(targetIndex, 0, section);
    }

    renderWorldSectionsEditor();
    renderWorldPreview();
    scheduleAutosave();
  }

  async function restoreWorldImagesFromDatabase() {
    releaseAllWorldImageObjectUrls();

    for (const world of project.worlds) {
      const metadata = getWorldImageMetadata(world);
      if (!metadata?.id) continue;

      try {
        const record = await getImageRecord(metadata.id);
        if (!record?.blob || record.blob.type !== "image/png") {
          missingWorldImageIds.add(world.id);
          continue;
        }

        worldImageBlobs.set(world.id, record.blob);
        worldImagePreviewUrls.set(world.id, URL.createObjectURL(record.blob));
      } catch (error) {
        console.error(error);
        missingWorldImageIds.add(world.id);
      }
    }

    renderWorldEditor();
    renderWorldPreview();
    return missingWorldImageIds.size;
  }


  async function restoreCharacterImagesFromDatabase() {
    releaseAllCharacterImageObjectUrls();

    for (const character of project.characters) {
      for (const image of character.images || []) {
        const metadata = getCharacterImageMetadata(image);
        if (!metadata?.id) continue;
        try {
          const record = await getImageRecord(metadata.id);
          if (!record?.blob || record.blob.type !== "image/png") {
            missingCharacterImageIds.add(metadata.id);
            continue;
          }
          characterImageBlobs.set(metadata.id, record.blob);
          characterImagePreviewUrls.set(metadata.id, URL.createObjectURL(record.blob));
        } catch (error) {
          console.error(error);
          missingCharacterImageIds.add(metadata.id);
        }
      }
    }

    renderCharacterEditor();
    renderWorldEditor();
    renderCharacterPreview();
    renderWorldPreview();
    return missingCharacterImageIds.size;
  }

  async function handleWorldImageSelection() {
    const world = getSelectedWorld();
    const file = elements.worldImageInput.files?.[0] || null;
    if (!world || !file) return;

    elements.worldImageInput.disabled = true;
    setSaveStatus("세계관 PNG 저장 중…");

    try {
      const previousMetadata = getWorldImageMetadata(world);
      const sanitized = await sanitizePng(file, "세계관 PNG");
      const id = createImageId();
      const updatedAt = new Date().toISOString();
      const record = {
        id,
        role: "world-cover",
        ownerId: world.id,
        name: file.name || "world.png",
        type: "image/png",
        size: sanitized.blob.size,
        width: sanitized.width,
        height: sanitized.height,
        updatedAt,
        blob: sanitized.blob
      };

      await putImageRecord(record);

      world.image = {
        id,
        name: record.name,
        type: record.type,
        size: record.size,
        width: record.width,
        height: record.height,
        updatedAt
      };

      releaseWorldImageObjectUrl(world.id);
      worldImageBlobs.set(world.id, sanitized.blob);
      worldImagePreviewUrls.set(world.id, URL.createObjectURL(sanitized.blob));
      missingWorldImageIds.delete(world.id);

      if (previousMetadata?.id && previousMetadata.id !== id) {
        try {
          await deleteImageRecord(previousMetadata.id);
        } catch (cleanupError) {
          console.error(cleanupError);
        }
      }

      renderWorldEditor();
      renderWorldPreview();
      saveProjectToStorage();
      setSaveStatus("세계관 PNG가 브라우저에 저장됨");
    } catch (error) {
      elements.worldImageInput.value = "";
      console.error(error);
      window.alert(error.message || "세계관 이미지를 처리하지 못했습니다.");
      setSaveStatus("세계관 PNG 저장 실패");
    } finally {
      elements.worldImageInput.disabled = false;
    }
  }

  async function removeWorldImage() {
    const world = getSelectedWorld();
    if (!world) return;

    const metadata = getWorldImageMetadata(world);
    releaseWorldImageObjectUrl(world.id);
    world.image = "";
    elements.worldImageInput.value = "";
    renderWorldEditor();
    renderWorldPreview();
    saveProjectToStorage();

    if (metadata?.id) {
      try {
        await deleteImageRecord(metadata.id);
      } catch (error) {
        console.error(error);
        setSaveStatus("이미지 연결은 제거됐지만 저장 파일 정리에 실패함");
        return;
      }
    }

    setSaveStatus("세계관 PNG가 제거됨");
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
    renderWorldPreview();
    renderCharacterPreview();

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

  async function validatePngFile(file, label = "PNG 이미지") {
    if (!file || file.size <= 0) {
      throw new Error("비어 있는 이미지 파일은 사용할 수 없습니다.");
    }

    if (file.size > MAX_IMAGE_FILE_BYTES) {
      throw new Error(`${label}는 10MB 이하만 사용할 수 있습니다.`);
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

  async function sanitizePng(file, label = "PNG 이미지") {
    await validatePngFile(file, label);
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

      if (blob.size > MAX_IMAGE_FILE_BYTES) {
        throw new Error(`변환된 ${label}가 10MB를 초과합니다.`);
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
      const sanitized = await sanitizePng(file, "프로필 PNG");
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

  async function replaceCurrentProject(nextProject, restoreImages = true) {
    project = normalizeProject(nextProject);
    releaseAvatarObjectUrl();
    releaseAllWorldImageObjectUrls();
    releaseAllCharacterImageObjectUrls();
    avatarRestoreMissing = false;
    selectedWorldId = project.worlds[0]?.id || "";
    selectedCharacterId = project.characters[0]?.id || "";
    worldPreviewExpanded = false;
    characterPreviewExpanded = false;
    populateFieldsFromProject();
    renderSocialLinks();
    renderWorldEditor();
    renderCharacterEditor();
    renderPreview();

    if (!restoreImages) return false;
    const avatarRestored = await restoreAvatarFromDatabase();
    await restoreWorldImagesFromDatabase();
    await restoreCharacterImagesFromDatabase();
    return avatarRestored;
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
      const storedImageCount =
        (getAvatarMetadata() ? 1 : 0) +
        project.worlds.filter((world) => getWorldImageMetadata(world)).length +
        project.characters.reduce((count, character) =>
          count + (character.images || []).filter(getCharacterImageMetadata).length,
        0);
      setSaveStatus(
        storedImageCount > 0
          ? `프로젝트 JSON 저장됨 · PNG ${storedImageCount}개는 이 브라우저에 유지됨`
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

      const missingWorldCount = missingWorldImageIds.size;
      const missingCharacterCount = missingCharacterImageIds.size;

      if ((getAvatarMetadata() && !restoredAvatar) || missingWorldCount > 0 || missingCharacterCount > 0) {
        const missingImages = [];
        if (getAvatarMetadata() && !restoredAvatar) missingImages.push("프로필 PNG");
        if (missingWorldCount > 0) missingImages.push(`세계관 PNG ${missingWorldCount}개`);
        if (missingCharacterCount > 0) missingImages.push(`캐릭터 PNG ${missingCharacterCount}개`);
        setSaveStatus(
          `프로젝트 불러옴 · ${missingImages.join(" · ")}를 다시 선택해 주세요`
        );
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
      "현재 입력한 제작자 프로필과 세계관, 캐릭터, 자동 저장 데이터와 저장된 PNG를 모두 초기화할까요?"
    );

    if (!confirmed) return;

    clearStoredProject();
    releaseAvatarObjectUrl();
    releaseAllWorldImageObjectUrls();
    releaseAllCharacterImageObjectUrls();
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



  elements.addCharacterButton.addEventListener("click", addCharacter);

  elements.characterEditorList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-select-character]");
    if (!button) return;
    selectedCharacterId = button.dataset.selectCharacter;
    renderCharacterEditor();
  });

  elements.characterForm.addEventListener("input", (event) => {
    const target = event.target;
    if (target === elements.characterImageInput) return;
    if (target.matches("[data-character-genre]")) {
      toggleCharacterGenre(target);
      return;
    }
    if (target.matches("[data-character-platform-toggle], [data-character-platform-url]")) {
      updateCharacterPlatform(target);
      return;
    }
    if (target.matches("[data-character-content-field]")) {
      updateCharacterContentFromInput(target);
      return;
    }
    syncCharacterFromFields();
  });

  elements.characterImageInput.addEventListener("change", handleCharacterImageSelection);
  elements.characterImageList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-delete-character-image], [data-move-character-image]");
    if (!button) return;
    handleCharacterImageAction(button);
  });
  elements.addCharacterContentButton.addEventListener("click", addCharacterContent);
  elements.characterContentList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-delete-character-content], [data-move-character-content]");
    if (!button) return;
    handleCharacterContentAction(button);
  });
  elements.moveCharacterUpButton.addEventListener("click", () => moveSelectedCharacter(-1));
  elements.moveCharacterDownButton.addEventListener("click", () => moveSelectedCharacter(1));
  elements.deleteCharacterButton.addEventListener("click", deleteSelectedCharacter);

  function handleCharacterPreviewClick(event) {
    const imageButton = event.target.closest("[data-character-preview-image]");
    if (imageButton) {
      elements.characterPreviewMainImage.src = imageButton.dataset.characterPreviewImage;
      elements.characterPreviewMainImage.alt = imageButton.dataset.characterPreviewAlt;
      elements.characterPreviewThumbnails.querySelectorAll(".character-preview-thumbnail")
        .forEach((button) => button.classList.remove("is-active"));
      imageButton.classList.add("is-active");
      return true;
    }

    const characterButton = event.target.closest("[data-preview-character]");
    if (characterButton) {
      openCharacterPreview(
        project.characters.find((character) => character.id === characterButton.dataset.previewCharacter)
      );
      return true;
    }
    return false;
  }

  elements.previewFeaturedGrid.addEventListener("click", handleCharacterPreviewClick);
  elements.previewCharacterGrid.addEventListener("click", handleCharacterPreviewClick);
  elements.worldPreviewCharacterList.addEventListener("click", handleCharacterPreviewClick);
  elements.characterPreviewThumbnails.addEventListener("click", handleCharacterPreviewClick);

  elements.previewCharacterToggle.addEventListener("click", () => {
    characterPreviewExpanded = !characterPreviewExpanded;
    updateCharacterPreviewLimit();
  });

  elements.characterPreviewModalClose.addEventListener("click", closeCharacterPreview);
  elements.characterPreviewModal.addEventListener("click", (event) => {
    if (event.target === elements.characterPreviewModal) closeCharacterPreview();
  });
  elements.characterPreviewModal.addEventListener("close", () => {
    document.body.classList.remove("character-preview-modal-open");
  });
  elements.characterPreviewWorldButton.addEventListener("click", (event) => {
    const worldId = event.currentTarget.dataset.previewWorld;
    if (!worldId) return;
    closeCharacterPreview();
    openWorldPreview(project.worlds.find((world) => world.id === worldId));
  });

  let platformRailDrag = null;
  elements.characterPreviewPlatforms.addEventListener("pointerdown", (event) => {
    if (event.pointerType !== "mouse" || event.button !== 0) return;
    platformRailDrag = {
      pointerId: event.pointerId,
      startX: event.clientX,
      scrollLeft: elements.characterPreviewPlatforms.scrollLeft
    };
    elements.characterPreviewPlatforms.setPointerCapture(event.pointerId);
    elements.characterPreviewPlatforms.classList.add("is-dragging");
  });
  elements.characterPreviewPlatforms.addEventListener("pointermove", (event) => {
    if (!platformRailDrag || platformRailDrag.pointerId !== event.pointerId) return;
    elements.characterPreviewPlatforms.scrollLeft =
      platformRailDrag.scrollLeft - (event.clientX - platformRailDrag.startX);
  });
  function stopPlatformRailDrag(event) {
    if (!platformRailDrag || platformRailDrag.pointerId !== event.pointerId) return;
    platformRailDrag = null;
    elements.characterPreviewPlatforms.classList.remove("is-dragging");
  }
  elements.characterPreviewPlatforms.addEventListener("pointerup", stopPlatformRailDrag);
  elements.characterPreviewPlatforms.addEventListener("pointercancel", stopPlatformRailDrag);

  elements.addWorldButton.addEventListener("click", addWorld);

  elements.worldEditorList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-select-world]");
    if (!button) return;
    selectedWorldId = button.dataset.selectWorld;
    renderWorldEditor();
  });

  elements.worldForm.addEventListener("input", (event) => {
    if (event.target === elements.worldImageInput) return;
    if (event.target.matches("[data-world-section-field]")) {
      updateWorldSectionFromInput(event.target);
      return;
    }
    syncWorldFromFields();
  });

  elements.worldSectionList.addEventListener("click", (event) => {
    const button = event.target.closest(
      "[data-delete-world-section], [data-move-world-section]"
    );
    if (!button) return;
    handleWorldSectionAction(button);
  });

  elements.worldCharacterLinkList.addEventListener("change", (event) => {
    const checkbox = event.target.closest("[data-world-character-index]");
    if (!checkbox) return;
    updateWorldCharacterLink(checkbox);
  });

  elements.addWorldSectionButton.addEventListener("click", addWorldSection);
  elements.moveWorldUpButton.addEventListener("click", () => moveSelectedWorld(-1));
  elements.moveWorldDownButton.addEventListener("click", () => moveSelectedWorld(1));
  elements.deleteWorldButton.addEventListener("click", deleteSelectedWorld);
  elements.worldImageInput.addEventListener("change", handleWorldImageSelection);
  elements.removeWorldImageButton.addEventListener("click", removeWorldImage);

  elements.previewWorldGrid.addEventListener("click", (event) => {
    const button = event.target.closest("[data-preview-world]");
    if (!button) return;
    openWorldPreview(
      project.worlds.find((world) => world.id === button.dataset.previewWorld)
    );
  });

  elements.previewWorldToggle.addEventListener("click", () => {
    worldPreviewExpanded = !worldPreviewExpanded;
    updateWorldPreviewLimit();
  });

  window.addEventListener("resize", () => {
    updateWorldPreviewLimit();
    updateCharacterPreviewLimit();
  });

  elements.worldPreviewModalClose.addEventListener("click", closeWorldPreview);
  elements.worldPreviewModal.addEventListener("click", (event) => {
    if (event.target === elements.worldPreviewModal) closeWorldPreview();
  });
  elements.worldPreviewModal.addEventListener("close", () => {
    document.body.classList.remove("world-preview-modal-open");
  });

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
    releaseAllWorldImageObjectUrls();
    releaseAllCharacterImageObjectUrls();
  });

  async function initialize() {
    loadProjectFromStorage();
    renderServiceOptions();
    selectedWorldId = project.worlds[0]?.id || "";
    selectedCharacterId = project.characters[0]?.id || "";
    populateFieldsFromProject();
    renderSocialLinks();
    renderWorldEditor();
    renderCharacterEditor();
    renderPreview();

    const avatarMetadata = getAvatarMetadata();
    const restoredAvatar = avatarMetadata
      ? await restoreAvatarFromDatabase()
      : false;
    const missingWorldCount = await restoreWorldImagesFromDatabase();
    const missingCharacterCount = await restoreCharacterImagesFromDatabase();

    if (autosaveRestoreError) {
      setSaveStatus("자동 저장 복구 실패");
      window.setTimeout(() => {
        window.alert(autosaveRestoreError);
      }, 0);
      return;
    }

    if ((avatarMetadata && !restoredAvatar) || missingWorldCount > 0 || missingCharacterCount > 0) {
      const messages = [];
      if (avatarMetadata && !restoredAvatar) messages.push("프로필 PNG");
      if (missingWorldCount > 0) messages.push(`세계관 PNG ${missingWorldCount}개`);
      if (missingCharacterCount > 0) messages.push(`캐릭터 PNG ${missingCharacterCount}개`);
      setSaveStatus(
        `${restoredAutosave ? "이전 자동 저장 복구됨 · " : ""}${messages.join(" · ")}를 다시 선택해 주세요`
      );
      return;
    }

    if (restoredAutosave && project.worlds.length > 0) {
      setSaveStatus("자동저장된 세계관 데이터를 복구함");
    } else if (restoredAutosave && restoredAvatar) {
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
