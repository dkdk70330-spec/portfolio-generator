(() => {
  "use strict";

  const EMPTY_FALLBACK = {
    version: 1,
    site: {
      title: "",
      description: "",
      textColor: "#f4f1ea",
      themeColor: "#a897ff"
    },
    creator: {
      avatar: "",
      background: "",
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
  const PREVIEW_WIDTH_STORAGE_KEY = "portfolio-generator:preview-width";
  const PREVIEW_WIDTH_MIN = 380;
  const PREVIEW_WIDTH_MAX = 760;
  const PREVIEW_WIDTH_DEFAULT = 620;
  const DEFAULT_TEXT_COLOR = "#f4f1ea";
  const DEFAULT_THEME_COLOR = "#a897ff";
  const FULL_BACKUP_FORMAT = "portfolio-generator-full-backup";
  const FULL_BACKUP_VERSION = 1;
  const ADMIN_ASSET_BASE = "../template/images/";

  const IMAGE_DB_NAME = "portfolio-generator-images";
  const IMAGE_DB_VERSION = 1;
  const IMAGE_STORE_NAME = "images";
  const MAX_IMAGE_FILE_BYTES = 10 * 1024 * 1024;
  const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];
  const MP3_MIME_TYPE = "audio/mpeg";

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
  ? adminCatalog.genres
      .filter(
        (genre) =>
          genre &&
          typeof genre === "object" &&
          !Array.isArray(genre) &&
          typeof genre.id === "string" &&
          genre.id.trim() &&
          typeof genre.name === "string" &&
          genre.name.trim()
      )
      .map((genre) => ({
        id: genre.id.trim(),
        name: genre.name.trim()
      }))
  : [];

const genreCatalog = new Map(
  genreOptions.map((genre) => [genre.id, genre])
);

function genreLabel(id) {
  return genreCatalog.get(id)?.name || id;
}

function normalizeGenreId(value) {
  const normalized = String(value || "").trim();

  if (!normalized) return "";

  // 이미 ID로 저장된 데이터
  if (genreCatalog.has(normalized)) {
    return normalized;
  }

  // 기존 프로젝트의 "판타지" 같은 이름 데이터를 ID로 변환
  const legacyGenre = genreOptions.find(
    (genre) => genre.name === normalized
  );

  return legacyGenre?.id || normalized;
}

  let project = createEmptyProject();
  let creatorAvatarBlob = null;
  let creatorAvatarPreviewUrl = "";
  let avatarRestoreMissing = false;
  let creatorBackgroundBlob = null;
  let creatorBackgroundPreviewUrl = "";
  let creatorBackgroundRestoreMissing = false;
  let selectedWorldId = "";
  let worldPreviewExpanded = false;
  let selectedCharacterId = "";
  let characterPreviewExpanded = false;
  const characterPreviewFilterState = {
    query: "",
    genre: new Set(),
    tag: new Set(),
    platform: new Set(),
    world: new Set()
  };
  let activeCharacterFilterPickerGroup = null;
  let characterFilterPickerQuery = "";
  const worldImageBlobs = new Map();
  const worldImagePreviewUrls = new Map();
  const missingWorldImageIds = new Set();
  const characterImageBlobs = new Map();
  const characterImagePreviewUrls = new Map();
  const missingCharacterImageIds = new Set();
  const musicBlobs = new Map();
  const musicPreviewUrls = new Map();
  const missingMusicIds = new Set();
  let imageDatabasePromise = null;
  let autosaveTimer = 0;
  let activeImageDropTarget = null;
  let restoredAutosave = false;
  let autosaveRestoreError = "";

const elements = {
  profileForm: document.querySelector("#profileForm"),

  netlifyGuideButton:
    document.querySelector("#netlifyGuideButton"),
  netlifyGuideDialog:
    document.querySelector("#netlifyGuideDialog"),
  netlifyGuideClose:
    document.querySelector("#netlifyGuideClose"),

  backupMenu: document.querySelector("#backupMenu"),
    downloadTextBackupButton: document.querySelector("#downloadTextBackupButton"),
    downloadEditorBackupButton: document.querySelector("#downloadEditorBackupButton"),
    downloadFullBackupButton: document.querySelector("#downloadFullBackupButton"),
    importProjectInput: document.querySelector("#importProjectInput"),
    resetProjectButton: document.querySelector("#resetProjectButton"),

    siteTitleInput: document.querySelector("#siteTitleInput"),
    siteDescriptionInput: document.querySelector("#siteDescriptionInput"),
    siteTextColorInput: document.querySelector("#siteTextColorInput"),
    siteTextColorValue: document.querySelector("#siteTextColorValue"),
    siteThemeColorInput: document.querySelector("#siteThemeColorInput"),
    siteThemeColorValue: document.querySelector("#siteThemeColorValue"),
    creatorNameInput: document.querySelector("#creatorNameInput"),
    creatorHandleInput: document.querySelector("#creatorHandleInput"),
    creatorFallbackInput: document.querySelector("#creatorFallbackInput"),
    creatorBioInput: document.querySelector("#creatorBioInput"),

    avatarInput: document.querySelector("#avatarInput"),
    avatarEditorPreview: document.querySelector("#avatarEditorPreview"),
    avatarEditorFallback: document.querySelector("#avatarEditorFallback"),
    avatarStorageStatus: document.querySelector("#avatarStorageStatus"),
    removeAvatarButton: document.querySelector("#removeAvatarButton"),
    profileBackgroundInput: document.querySelector("#profileBackgroundInput"),
    profileBackgroundEditorPreview: document.querySelector("#profileBackgroundEditorPreview"),
    profileBackgroundEditorFallback: document.querySelector("#profileBackgroundEditorFallback"),
    profileBackgroundStorageStatus: document.querySelector("#profileBackgroundStorageStatus"),
    removeProfileBackgroundButton: document.querySelector("#removeProfileBackgroundButton"),

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
    addWorldMusicButton: document.querySelector("#addWorldMusicButton"),
    worldMusicList: document.querySelector("#worldMusicList"),
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
    addCharacterMusicButton: document.querySelector("#addCharacterMusicButton"),
    characterMusicList: document.querySelector("#characterMusicList"),
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
    previewProfileBackgroundImage: document.querySelector("#previewProfileBackgroundImage"),
    previewCharacterCount: document.querySelector("#previewCharacterCount"),
    previewWorldCount: document.querySelector("#previewWorldCount"),
    previewGenreCount: document.querySelector("#previewGenreCount"),
    previewWidthInput: document.querySelector("#previewWidthInput"),
    previewWidthOutput: document.querySelector("#previewWidthOutput"),
    previewCanvas: document.querySelector("#previewCanvas"),

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
    worldPreviewSoundtrack: document.querySelector("#worldPreviewSoundtrack"),
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
    previewCharacterResultSummary: document.querySelector("#previewCharacterResultSummary"),
    previewCharacterSearchInput: document.querySelector("#previewCharacterSearchInput"),
    previewGenreFilters: document.querySelector("#previewGenreFilters"),
    previewTagFilters: document.querySelector("#previewTagFilters"),
    previewPlatformFilters: document.querySelector("#previewPlatformFilters"),
    previewWorldFilters: document.querySelector("#previewWorldFilters"),
    previewCharacterResetFilters: document.querySelector("#previewCharacterResetFilters"),
    previewCharacterFilterPicker: document.querySelector("#previewCharacterFilterPicker"),
    previewCharacterFilterPickerTitle: document.querySelector("#previewCharacterFilterPickerTitle"),
    previewCharacterFilterPickerClose: document.querySelector("#previewCharacterFilterPickerClose"),
    previewCharacterFilterPickerSearch: document.querySelector("#previewCharacterFilterPickerSearch"),
    previewCharacterFilterPickerOptions: document.querySelector("#previewCharacterFilterPickerOptions"),
    previewCharacterFilterPickerEmpty: document.querySelector("#previewCharacterFilterPickerEmpty"),
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
    characterPreviewSoundtrack: document.querySelector("#characterPreviewSoundtrack"),
    characterPreviewModalDescription: document.querySelector("#characterPreviewModalDescription"),
    characterPreviewWorldPanel: document.querySelector("#characterPreviewWorldPanel"),
    characterPreviewWorldButton: document.querySelector("#characterPreviewWorldButton"),
    characterPreviewWorldName: document.querySelector("#characterPreviewWorldName"),
    characterPreviewWorldSummary: document.querySelector("#characterPreviewWorldSummary"),
    characterPreviewContentSection: document.querySelector("#characterPreviewContentSection"),
    characterPreviewContents: document.querySelector("#characterPreviewContents"),

    saveStatus: document.querySelector("#saveStatus"),
    imageDropZones: [...document.querySelectorAll("[data-image-drop-target]")]
  };

  const observedCharacterFilterRows = new WeakSet();
  let characterFilterFitFrame = 0;
  const characterFilterResizeObserver =
    typeof window.ResizeObserver === "function"
      ? new ResizeObserver((entries) => {
          window.cancelAnimationFrame(characterFilterFitFrame);
          characterFilterFitFrame = window.requestAnimationFrame(() => {
            entries.forEach((entry) =>
              fitCharacterPreviewFilterRow(entry.target)
            );
          });
        })
      : null;

  function cloneJson(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function isPlainObject(value) {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
  }

  function normalizeCreatorBackground(value) {
    if (value === undefined || value === null || value === "") return "";
    if (typeof value === "string") return value;
    if (!isPlainObject(value)) {
      throw new Error("creator.background 항목의 형식이 올바르지 않습니다.");
    }

    const id = normalizeString(value.id, "creator.background.id").trim();
    const name = normalizeString(
      value.name || "profile-background.png",
      "creator.background.name"
    ).trim();
    const type = normalizeString(
      value.type || "image/png",
      "creator.background.type"
    ).trim();
    const size = Number(value.size || 0);
    const width = Number(value.width || 0);
    const height = Number(value.height || 0);
    const updatedAt = normalizeString(
      value.updatedAt || "",
      "creator.background.updatedAt"
    ).trim();

    if (!id) throw new Error("creator.background.id가 비어 있습니다.");
    if (type !== "image/png") {
      throw new Error("creator.background는 PNG 이미지여야 합니다.");
    }
    if (!Number.isFinite(size) || size < 0) {
      throw new Error("creator.background.size가 올바르지 않습니다.");
    }
    if (!Number.isFinite(width) || width < 0) {
      throw new Error("creator.background.width가 올바르지 않습니다.");
    }
    if (!Number.isFinite(height) || height < 0) {
      throw new Error("creator.background.height가 올바르지 않습니다.");
    }

    return {
      id,
      name: name || "profile-background.png",
      type: "image/png",
      size: Math.round(size),
      width: Math.round(width),
      height: Math.round(height),
      updatedAt
    };
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


  function normalizeMusicFile(value, fieldName) {
    if (value === undefined || value === null || value === "") return "";
    if (typeof value === "string") return value;

    if (!isPlainObject(value)) {
      throw new Error(`${fieldName} 항목의 형식이 올바르지 않습니다.`);
    }

    const id = normalizeString(value.id, `${fieldName}.id`).trim();
    const name = normalizeString(
      value.name || "soundtrack.mp3",
      `${fieldName}.name`
    ).trim();
    const type = normalizeString(
      value.type || MP3_MIME_TYPE,
      `${fieldName}.type`
    ).trim();
    const size = Number(value.size || 0);
    const duration = Number(value.duration || 0);
    const updatedAt = normalizeString(
      value.updatedAt || "",
      `${fieldName}.updatedAt`
    ).trim();

    if (!id) throw new Error(`${fieldName}.id가 비어 있습니다.`);
    if (!["audio/mpeg", "audio/mp3"].includes(type)) {
      throw new Error(`${fieldName}는 MP3 파일이어야 합니다.`);
    }
    if (!Number.isFinite(size) || size < 0) {
      throw new Error(`${fieldName}.size가 올바르지 않습니다.`);
    }
    if (!Number.isFinite(duration) || duration < 0) {
      throw new Error(`${fieldName}.duration이 올바르지 않습니다.`);
    }

    return {
      id,
      name: name || "soundtrack.mp3",
      type: MP3_MIME_TYPE,
      size: Math.round(size),
      duration,
      updatedAt
    };
  }

  function normalizeMusicTrack(track, ownerField, trackIndex) {
    if (!isPlainObject(track)) {
      throw new Error(
        `${ownerField}.music[${trackIndex}] 항목의 형식이 올바르지 않습니다.`
      );
    }

    const type = track.type === "mp3" ? "mp3" : "youtube";

    return {
      ...cloneJson(track),
      id: normalizeString(
        track.id || `music-${trackIndex + 1}`,
        `${ownerField}.music[${trackIndex}].id`
      ).trim(),
      title: normalizeString(
        track.title,
        `${ownerField}.music[${trackIndex}].title`
      ),
      type,
      url: normalizeString(
        track.url,
        `${ownerField}.music[${trackIndex}].url`
      ).trim(),
      file: normalizeMusicFile(
        track.file,
        `${ownerField}.music[${trackIndex}].file`
      )
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
    const rawMusic = world.music || [];

    if (!Array.isArray(rawTags)) {
      throw new Error(`worlds[${index}].tags 항목은 배열이어야 합니다.`);
    }
    if (!Array.isArray(rawDescription)) {
      throw new Error(`worlds[${index}].description 항목은 배열이어야 합니다.`);
    }
    if (!Array.isArray(rawSections)) {
      throw new Error(`worlds[${index}].sections 항목은 배열이어야 합니다.`);
    }
    if (!Array.isArray(rawMusic)) {
      throw new Error(`worlds[${index}].music 항목은 배열이어야 합니다.`);
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
      ),
      music: rawMusic.map((track, trackIndex) =>
        normalizeMusicTrack(track, `worlds[${index}]`, trackIndex)
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
      collapsible: item.collapsible === true,
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
    const rawMusic = character.music || [];

    if (!Array.isArray(rawDescription)) throw new Error(`characters[${index}].description 항목은 배열이어야 합니다.`);
    if (!Array.isArray(rawGenres)) throw new Error(`characters[${index}].genres 항목은 배열이어야 합니다.`);
    if (!Array.isArray(rawTags)) throw new Error(`characters[${index}].tags 항목은 배열이어야 합니다.`);
    if (!Array.isArray(rawImages)) throw new Error(`characters[${index}].images 항목은 배열이어야 합니다.`);
    if (!Array.isArray(rawPlatforms)) throw new Error(`characters[${index}].platforms 항목은 배열이어야 합니다.`);
    if (!Array.isArray(rawContents)) throw new Error(`characters[${index}].contents 항목은 배열이어야 합니다.`);
    if (!Array.isArray(rawMusic)) throw new Error(`characters[${index}].music 항목은 배열이어야 합니다.`);
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
      genres: [
  ...new Set(
    rawGenres
      .map((genre, genreIndex) =>
        normalizeGenreId(
          normalizeString(
            genre,
            `characters[${index}].genres[${genreIndex}]`
          ).trim()
        )
      )
      .filter(Boolean)
  )
],
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
      ),
      music: rawMusic.map((track, trackIndex) =>
        normalizeMusicTrack(track, `characters[${index}]`, trackIndex)
      )
    };
  }

  function normalizeHexColor(value, fallback) {
    const normalized = String(value || "").trim().toLowerCase();
    return /^#[0-9a-f]{6}$/.test(normalized) ? normalized : fallback;
  }

  function contrastTextColor(hexColor) {
    const hex = normalizeHexColor(hexColor, DEFAULT_THEME_COLOR).slice(1);
    const red = Number.parseInt(hex.slice(0, 2), 16);
    const green = Number.parseInt(hex.slice(2, 4), 16);
    const blue = Number.parseInt(hex.slice(4, 6), 16);
    const luminance = (0.299 * red + 0.587 * green + 0.114 * blue) / 255;
    return luminance > 0.58 ? "#15190a" : "#ffffff";
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
        description: normalizeString(rawSite.description, "site.description"),
        textColor: normalizeHexColor(rawSite.textColor, DEFAULT_TEXT_COLOR),
        themeColor: normalizeHexColor(rawSite.themeColor, DEFAULT_THEME_COLOR)
      },
      creator: {
        ...(base.creator || {}),
        ...cloneJson(rawCreator),
        avatar: normalizeAvatar(rawCreator.avatar),
        background: normalizeCreatorBackground(rawCreator.background),
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

  function creatorBackgroundUrl() {
    if (creatorBackgroundPreviewUrl) return creatorBackgroundPreviewUrl;
    return typeof project.creator.background === "string"
      ? legacyImageUrl(project.creator.background)
      : "";
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

  function getCreatorBackgroundMetadata() {
    return isPlainObject(project.creator.background)
      ? project.creator.background
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
      sections: [],
      music: []
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
      contents: [],
      music: []
    };
  }

  function createMusicTrack() {
    return {
      id: createEntityId("music"),
      title: "",
      type: "youtube",
      url: "",
      file: ""
    };
  }

  function createCharacterContent() {
    return {
      id: createEntityId("character-content"),
      type: "",
      title: "",
      content: [],
      spoiler: false,
      collapsible: false,
      warning: ""
    };
  }

  function getMusicFileMetadata(track) {
    return isPlainObject(track?.file) ? track.file : null;
  }

  function musicTrackFileUrl(track) {
    if (!track) return "";
    if (typeof track.file === "string") {
      return legacyImageUrl(track.file);
    }
    const metadata = getMusicFileMetadata(track);
    return metadata?.id ? musicPreviewUrls.get(metadata.id) || "" : "";
  }

  function youtubeVideoId(value) {
    const raw = String(value || "").trim();
    if (!raw) return "";

    try {
      const url = new URL(raw);
      const hostname = url.hostname.replace(/^www\./, "").toLowerCase();

      if (hostname === "youtu.be") {
        return url.pathname.split("/").filter(Boolean)[0] || "";
      }

      if (
        hostname === "youtube.com" ||
        hostname === "m.youtube.com" ||
        hostname === "music.youtube.com" ||
        hostname === "youtube-nocookie.com"
      ) {
        if (url.pathname === "/watch") {
          return url.searchParams.get("v") || "";
        }

        const parts = url.pathname.split("/").filter(Boolean);
        if (["embed", "shorts", "live"].includes(parts[0])) {
          return parts[1] || "";
        }
      }
    } catch {
      return "";
    }

    return "";
  }

  function youtubeEmbedUrl(value) {
    const id = youtubeVideoId(value);
    return id
      ? `https://www.youtube-nocookie.com/embed/${encodeURIComponent(
          id
        )}?rel=0&modestbranding=1`
      : "";
  }

  function playableMusicTracks(owner) {
    return (owner?.music || []).filter((track) => {
      if (track.type === "mp3") return Boolean(musicTrackFileUrl(track));
      return Boolean(youtubeVideoId(track.url));
    });
  }

  function hasPlayableMusic(owner) {
    return playableMusicTracks(owner).length > 0;
  }

  function musicOwner(ownerType) {
    return ownerType === "world"
      ? getSelectedWorld()
      : getSelectedCharacter();
  }

  function musicEditorElements(ownerType) {
    return ownerType === "world"
      ? { list: elements.worldMusicList }
      : { list: elements.characterMusicList };
  }

  function releaseMusicObjectUrl(id) {
    const url = musicPreviewUrls.get(id);
    if (url) URL.revokeObjectURL(url);
    musicPreviewUrls.delete(id);
    musicBlobs.delete(id);
    missingMusicIds.delete(id);
  }

  function releaseAllMusicObjectUrls() {
    for (const url of musicPreviewUrls.values()) {
      URL.revokeObjectURL(url);
    }
    musicPreviewUrls.clear();
    musicBlobs.clear();
    missingMusicIds.clear();
  }

  async function validateMp3File(file, label = "MP3") {
    if (!(file instanceof Blob)) {
      throw new Error(`${label} 파일을 읽을 수 없습니다.`);
    }

    const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
    const hasId3 =
      bytes.length >= 3 &&
      bytes[0] === 0x49 &&
      bytes[1] === 0x44 &&
      bytes[2] === 0x33;
    const hasFrameSync =
      bytes.length >= 2 &&
      bytes[0] === 0xff &&
      (bytes[1] & 0xe0) === 0xe0;

    if (!hasId3 && !hasFrameSync) {
      throw new Error(`${label}는 올바른 MP3 파일이 아닙니다.`);
    }
  }

  async function readAudioDuration(blob) {
    return await new Promise((resolve) => {
      const audio = document.createElement("audio");
      const url = URL.createObjectURL(blob);
      const finish = (duration = 0) => {
        URL.revokeObjectURL(url);
        audio.removeAttribute("src");
        resolve(Number.isFinite(duration) ? duration : 0);
      };
      audio.preload = "metadata";
      audio.addEventListener(
        "loadedmetadata",
        () => finish(audio.duration),
        { once: true }
      );
      audio.addEventListener("error", () => finish(0), { once: true });
      audio.src = url;
    });
  }

  function musicTitle(track, index) {
    return track.title?.trim() ||
      `Track ${String(index + 1).padStart(2, "0")}`;
  }

  function renderMusicEditor(ownerType) {
    const owner = musicOwner(ownerType);
    const { list } = musicEditorElements(ownerType);

    if (!owner || owner.music.length === 0) {
      list.innerHTML =
        '<p class="empty-message">등록된 음악이 없습니다.</p>';
      return;
    }

    list.innerHTML = owner.music.map((track, index) => {
      const metadata = getMusicFileMetadata(track);
      const missing = Boolean(
        metadata?.id && missingMusicIds.has(metadata.id)
      );
      const fileStatus = metadata
        ? missing
          ? "저장된 MP3를 찾을 수 없습니다. 다시 선택해 주세요."
          : `${metadata.name} · ${formatBytes(metadata.size)}`
        : "선택된 MP3가 없습니다.";

      const sourceEditor = track.type === "mp3"
        ? `
          <div class="music-file-row">
            <label class="file-label">
              MP3 선택
              <input
                class="file-input"
                type="file"
                accept=".mp3,audio/mpeg,audio/mp3"
                data-music-file
              >
            </label>
            <span class="music-file-status">${escapeHtml(fileStatus)}</span>
            ${metadata ? `
              <button
                class="text-button"
                type="button"
                data-remove-music-file
              >파일 제거</button>
            ` : ""}
          </div>
        `
        : `
          <label>
            <span>YouTube 링크</span>
            <input
              type="url"
              inputmode="url"
              value="${escapeHtml(track.url || "")}"
              placeholder="https://www.youtube.com/watch?v=..."
              data-music-field="url"
            >
            <small class="field-help">
              일반 영상, Shorts, youtu.be 링크를 사용할 수 있습니다.
            </small>
          </label>
        `;

      return `
        <article
          class="music-editor-item"
          data-music-owner="${ownerType}"
          data-music-id="${escapeHtml(track.id)}"
        >
          <div class="music-editor-toolbar">
            <span>Track ${String(index + 1).padStart(2, "0")}</span>
            <button
              type="button"
              data-move-music="up"
              ${index === 0 ? "disabled" : ""}
            >위로</button>
            <button
              type="button"
              data-move-music="down"
              ${index === owner.music.length - 1 ? "disabled" : ""}
            >아래로</button>
            <button type="button" data-delete-music>삭제</button>
          </div>

          <div class="music-editor-grid">
            <label>
              <span>제목</span>
              <input
                type="text"
                value="${escapeHtml(track.title || "")}"
                placeholder="예: 유리 정원의 밤"
                data-music-field="title"
              >
            </label>

            <label>
              <span>재생 방식</span>
              <select data-music-field="type">
                <option value="youtube" ${
                  track.type === "youtube" ? "selected" : ""
                }>YouTube</option>
                <option value="mp3" ${
                  track.type === "mp3" ? "selected" : ""
                }>MP3 파일</option>
              </select>
            </label>
          </div>

          <div class="music-source-editor">
            ${sourceEditor}
          </div>
        </article>
      `;
    }).join("");
  }

  function renderAllMusicEditors() {
    renderMusicEditor("world");
    renderMusicEditor("character");
  }

  function addMusicTrack(ownerType) {
    const owner = musicOwner(ownerType);
    if (!owner) return;

    owner.music.push(createMusicTrack());
    renderMusicEditor(ownerType);
    renderWorldPreview();
    renderCharacterPreview();
    scheduleAutosave();

    requestAnimationFrame(() => {
      const { list } = musicEditorElements(ownerType);
      const items = list.querySelectorAll(".music-editor-item");
      items[items.length - 1]
        ?.querySelector('[data-music-field="title"]')
        ?.focus();
    });
  }

  async function removeMusicFile(track) {
    const metadata = getMusicFileMetadata(track);
    track.file = "";

    if (metadata?.id) {
      releaseMusicObjectUrl(metadata.id);
      try {
        await deleteImageRecord(metadata.id);
      } catch (error) {
        console.error(error);
      }
    }
  }

  async function updateMusicFromInput(ownerType, target) {
    const owner = musicOwner(ownerType);
    const item = target.closest("[data-music-id]");
    if (!owner || !item) return;

    const track = owner.music.find(
      (entry) => entry.id === item.dataset.musicId
    );
    if (!track) return;

    const field = target.dataset.musicField;

    if (field === "title") {
      track.title = target.value.trim();
    } else if (field === "url") {
      track.url = target.value.trim();
    } else if (field === "type") {
      const nextType = target.value === "mp3" ? "mp3" : "youtube";
      if (track.type === "mp3" && nextType !== "mp3") {
        await removeMusicFile(track);
      }
      track.type = nextType;
      if (nextType === "mp3") track.url = "";
      renderMusicEditor(ownerType);
    } else {
      return;
    }

    renderWorldPreview();
    renderCharacterPreview();
    scheduleAutosave();
  }

  async function storeMusicFile(ownerType, trackId, file) {
    const owner = musicOwner(ownerType);
    const track = owner?.music.find((entry) => entry.id === trackId);
    if (!owner || !track || !file) return;

    await validateMp3File(file, file.name || "MP3");
    const duration = await readAudioDuration(file);
    const previous = getMusicFileMetadata(track);
    const id = createEntityId("audio");
    const updatedAt = new Date().toISOString();

    const record = {
      id,
      role: `${ownerType}-music`,
      ownerId: owner.id,
      trackId: track.id,
      name: file.name || "soundtrack.mp3",
      type: MP3_MIME_TYPE,
      size: file.size,
      duration,
      updatedAt,
      blob: file
    };

    await putImageRecord(record);

    track.type = "mp3";
    track.file = {
      id,
      name: record.name,
      type: MP3_MIME_TYPE,
      size: record.size,
      duration,
      updatedAt
    };

    if (!track.title.trim()) {
      track.title = record.name.replace(/\.mp3$/i, "");
    }

    musicBlobs.set(id, file);
    musicPreviewUrls.set(id, URL.createObjectURL(file));
    missingMusicIds.delete(id);

    if (previous?.id && previous.id !== id) {
      releaseMusicObjectUrl(previous.id);
      try {
        await deleteImageRecord(previous.id);
      } catch (error) {
        console.error(error);
      }
    }

    renderMusicEditor(ownerType);
    renderWorldPreview();
    renderCharacterPreview();
    saveProjectToStorage();
    setSaveStatus("MP3가 브라우저에 저장됨");
  }

  async function handleMusicFileSelection(ownerType, input) {
    const item = input.closest("[data-music-id]");
    const file = input.files?.[0] || null;
    input.value = "";
    if (!item || !file) return;

    try {
      await storeMusicFile(ownerType, item.dataset.musicId, file);
    } catch (error) {
      console.error(error);
      window.alert(error.message || "MP3 파일을 저장하지 못했습니다.");
      setSaveStatus("MP3 저장 실패");
    }
  }

  async function handleMusicAction(ownerType, button) {
    const owner = musicOwner(ownerType);
    const item = button.closest("[data-music-id]");
    if (!owner || !item) return;

    const index = owner.music.findIndex(
      (track) => track.id === item.dataset.musicId
    );
    if (index < 0) return;

    const track = owner.music[index];

    if (button.hasAttribute("data-delete-music")) {
      await removeMusicFile(track);
      owner.music.splice(index, 1);
    } else if (button.hasAttribute("data-remove-music-file")) {
      await removeMusicFile(track);
    } else {
      const direction = button.dataset.moveMusic === "up" ? -1 : 1;
      const target = index + direction;
      if (target < 0 || target >= owner.music.length) return;
      const [moved] = owner.music.splice(index, 1);
      owner.music.splice(target, 0, moved);
    }

    renderMusicEditor(ownerType);
    renderWorldPreview();
    renderCharacterPreview();
    saveProjectToStorage();
  }

  async function restoreMusicFromDatabase() {
    releaseAllMusicObjectUrls();

    const owners = [
      ...project.worlds,
      ...project.characters
    ];

    for (const owner of owners) {
      for (const track of owner.music || []) {
        const metadata = getMusicFileMetadata(track);
        if (!metadata?.id) continue;

        try {
          const record = await getImageRecord(metadata.id);
          if (
            !record?.blob ||
            !["audio/mpeg", "audio/mp3"].includes(record.blob.type)
          ) {
            missingMusicIds.add(metadata.id);
            continue;
          }

          musicBlobs.set(metadata.id, record.blob);
          musicPreviewUrls.set(
            metadata.id,
            URL.createObjectURL(record.blob)
          );
        } catch (error) {
          console.error(error);
          missingMusicIds.add(metadata.id);
        }
      }
    }

    renderAllMusicEditors();
    renderWorldPreview();
    renderCharacterPreview();
    return missingMusicIds.size;
  }

  
  function soundtrackPlayerMarkup(track, index) {
    const title = musicTitle(track, index);

    if (track.type === "mp3") {
      return `
        <div class="soundtrack-now-playing">
          <span class="soundtrack-disc" aria-hidden="true">♫</span>
          <span><small>NOW PLAYING</small><strong>${escapeHtml(title)}</strong></span>
        </div>
        <audio
          class="soundtrack-audio"
          controls
          controlslist="nodownload noplaybackrate"
          disablepictureinpicture
          preload="metadata"
          src="${escapeHtml(musicTrackFileUrl(track))}"
        ></audio>
      `;
    }

    return `
      <div class="soundtrack-now-playing">
        <span class="soundtrack-disc" aria-hidden="true">♫</span>
        <span><small>NOW PLAYING · YOUTUBE</small><strong>${escapeHtml(title)}</strong></span>
      </div>
      <div class="soundtrack-youtube">
        <iframe
          src="${escapeHtml(youtubeEmbedUrl(track.url))}"
          title="${escapeHtml(title)}"
          loading="lazy"
          allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
          referrerpolicy="strict-origin-when-cross-origin"
          allowfullscreen
        ></iframe>
      </div>
    `;
  }

  function renderSoundtrack(section, owner, activeIndex = 0) {
  const tracks = playableMusicTracks(owner);
  section.hidden = tracks.length === 0;

  if (tracks.length === 0) {
    section.innerHTML = "";
    return;
  }

  const safeIndex = Math.min(
    Math.max(Number(activeIndex) || 0, 0),
    tracks.length - 1
  );

  section.dataset.soundtrackOwner = owner.id;
  section.dataset.soundtrackActive = String(safeIndex);

  const trackOptions = tracks
    .map((track, index) => {
      const number = String(index + 1).padStart(2, "0");
      const type = track.type === "mp3" ? "MP3" : "YouTube";

      return `
        <option
          value="${index}"
          ${index === safeIndex ? "selected" : ""}
        >
          ${number} · ${escapeHtml(musicTitle(track, index))} · ${type}
        </option>
      `;
    })
    .join("");

  section.innerHTML = `
    <header class="soundtrack-heading">
      <span>
        <small>SOUNDTRACK</small>
        <strong>이 이야기의 음악</strong>
      </span>
      <b aria-hidden="true">♫</b>
    </header>

    <div class="soundtrack-player">
      ${soundtrackPlayerMarkup(tracks[safeIndex], safeIndex)}
    </div>

    ${
      tracks.length > 1
        ? `
          <label class="soundtrack-track-selector">
            <span>TRACK LIST</span>
            <select data-soundtrack-select>
              ${trackOptions}
            </select>
          </label>
        `
        : ""
    }
  `;
}

  function stopSoundtrack(section) {
    const audio = section.querySelector("audio");
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
    const frame = section.querySelector("iframe");
    if (frame) frame.src = "about:blank";
  }

  function activateSoundtrackTrack(section, owner, index) {
    stopSoundtrack(section);
    renderSoundtrack(section, owner, index);
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

  function updateCreatorBackgroundStorageStatus() {
    const metadata = getCreatorBackgroundMetadata();
    if (creatorBackgroundRestoreMissing) {
      elements.profileBackgroundStorageStatus.textContent =
        "저장된 배경 PNG를 찾을 수 없습니다. PNG를 다시 선택해 주세요.";
      return;
    }
    if (creatorBackgroundBlob && metadata) {
      elements.profileBackgroundStorageStatus.textContent =
        `브라우저에 저장됨: ${metadata.name} · ${formatBytes(metadata.size)}`;
      return;
    }
    if (metadata) {
      elements.profileBackgroundStorageStatus.textContent =
        "저장된 배경 PNG를 확인하는 중입니다.";
      return;
    }
    if (typeof project.creator.background === "string" && project.creator.background) {
      elements.profileBackgroundStorageStatus.textContent =
        "기존 배경 이미지 경로를 사용 중입니다. 새 PNG로 교체할 수 있습니다.";
      return;
    }
    elements.profileBackgroundStorageStatus.textContent =
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

  async function getAllImageRecords() {
    const database = await openImageDatabase();

    return await new Promise((resolve, reject) => {
      const transaction = database.transaction(IMAGE_STORE_NAME, "readonly");
      const request = transaction.objectStore(IMAGE_STORE_NAME).getAll();

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(
        request.error || new Error("저장된 이미지 목록을 읽지 못했습니다.")
      );
      transaction.onabort = () => reject(
        transaction.error || new Error("이미지 목록 읽기 작업이 중단되었습니다.")
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

  async function replaceAllImageRecords(records) {
    const database = await openImageDatabase();

    return await new Promise((resolve, reject) => {
      const transaction = database.transaction(IMAGE_STORE_NAME, "readwrite");
      const store = transaction.objectStore(IMAGE_STORE_NAME);
      store.clear();
      records.forEach((record) => store.put(record));

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(
        transaction.error || new Error("백업 이미지를 복구하지 못했습니다.")
      );
      transaction.onabort = () => reject(
        transaction.error || new Error("백업 이미지 복구 작업이 중단되었습니다.")
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
    project.site.textColor = normalizeHexColor(
      elements.siteTextColorInput.value,
      DEFAULT_TEXT_COLOR
    );
    project.site.themeColor = normalizeHexColor(
      elements.siteThemeColorInput.value,
      DEFAULT_THEME_COLOR
    );
    elements.siteTextColorValue.value = project.site.textColor;
    elements.siteThemeColorValue.value = project.site.themeColor;

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

  const unknownGenres = (character.genres || [])
    .filter((genreId) => !genreCatalog.has(genreId))
    .map((genreId) => ({
      id: genreId,
      name: genreId
    }));

  const allGenres = [
    ...genreOptions,
    ...unknownGenres
  ];

  if (allGenres.length === 0) {
    elements.characterGenreList.innerHTML =
      '<p class="empty-message">관리자 장르가 등록되어 있지 않습니다.</p>';
    return;
  }

  elements.characterGenreList.innerHTML = allGenres
    .map(
      (genre) => `
        <label class="character-option-item">
          <input
            type="checkbox"
            data-character-genre="${escapeHtml(genre.id)}"
            ${(character.genres || []).includes(genre.id)
              ? "checked"
              : ""}
          >
          <span>${escapeHtml(genre.name)}</span>
        </label>
      `
    )
    .join("");
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
        <div class="character-content-display-options">
          <label class="character-content-toggle-option">
            <input type="checkbox" data-character-content-field="spoiler" ${item.spoiler ? "checked" : ""}>
            <span><strong>스포일러 콘텐츠</strong><small>경고문 뒤에 내용을 숨깁니다.</small></span>
          </label>
          <label class="character-content-toggle-option">
            <input type="checkbox" data-character-content-field="collapsible" ${item.collapsible ? "checked" : ""}>
            <span><strong>접기 사용</strong><small>상세화면에서 제목만 보이고 눌러 펼칩니다.</small></span>
          </label>
        </div>
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
    renderMusicEditor("character");
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
const genres = (character.genres || [])
  .slice(0, 2)
  .map(
    (genreId) =>
      `<span>${escapeHtml(genreLabel(genreId))}</span>`
  )
  .join("");

    return `
      <article class="character-preview-card ${featured ? "is-featured" : ""}" data-preview-character-card="${escapeHtml(character.id)}">
        <button type="button" class="character-preview-card-button" data-preview-character="${escapeHtml(character.id)}" aria-label="${escapeHtml(character.name || "이름 없는 캐릭터")} 상세 보기">
          <div class="character-preview-card-image-wrap">
            ${image}
            <div class="character-preview-card-platforms">${characterPlatformDots(character)}</div>
            ${
              hasPlayableMusic(character)
                ? '<span class="archive-music-mark" title="음악 있음" aria-hidden="true">♫</span>'
                : ""
            }
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

  function characterPreviewUsageEntries(values) {
    const counts = new Map();

    values.forEach((value) => {
      const normalized = String(value || "").trim();
      if (!normalized) return;
      counts.set(normalized, (counts.get(normalized) || 0) + 1);
    });

    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "ko"));
  }

  function characterPreviewFilterData() {
    const genreUsage = characterPreviewUsageEntries(
      project.characters.flatMap((character) => character.genres || [])
    );

    const tagUsage = characterPreviewUsageEntries(
      project.characters.flatMap((character) => character.tags || [])
    );

    const platformUsage = characterPreviewUsageEntries(
      project.characters.flatMap((character) =>
        (character.platforms || []).map((link) => link.id)
      )
    );

    const worldUsage = characterPreviewUsageEntries(
      project.characters
        .map((character) => character.worldId)
        .filter(Boolean)
    );

    const usedWorlds = worldUsage
      .map(([id, count]) => {
        const world = project.worlds.find((item) => item.id === id);
        return world
          ? {
              id,
              label: world.name || "이름 없는 세계관",
              count
            }
          : null;
      })
      .filter(Boolean);

    const independentCount = project.characters.filter(
      (character) => !character.worldId
    ).length;

    return {
      genreUsage,
      tagUsage,
      platformUsage,
      usedWorlds,
      independentCount
    };
  }

  function characterPreviewFilterOptions(group) {
    const {
      genreUsage,
      tagUsage,
      platformUsage,
      usedWorlds,
      independentCount
    } = characterPreviewFilterData();

    if (group === "genre") {
      return [
        {
          label: "전체",
          value: "전체",
          count: project.characters.length
        },
        ...genreUsage.map(([id, count]) => ({
          label: genreLabel(id),
          value: id,
          count
        }))
      ];
    }

    if (group === "tag") {
      return [
        {
          label: "전체",
          value: "전체",
          count: project.characters.length
        },
        ...tagUsage.map(([tag, count]) => ({
          label: tag,
          value: tag,
          count
        }))
      ];
    }

    if (group === "platform") {
      return [
        {
          label: "전체",
          value: "전체",
          count: project.characters.length
        },
        ...platformUsage.map(([id, count]) => {
          const platform = platformCatalog.get(id);
          return {
            label: platform?.name || id,
            value: id,
            count
          };
        })
      ];
    }

    const worlds = usedWorlds.map((world) => ({
      label: world.label,
      value: world.id,
      count: world.count
    }));

    if (independentCount > 0) {
      worlds.push({
        label: "독립 캐릭터",
        value: "__independent__",
        count: independentCount
      });
    }

    return [
      {
        label: "전체",
        value: "전체",
        count: project.characters.length
      },
      ...worlds
    ];
  }

  function selectedCharacterPreviewFilters(group) {
    return characterPreviewFilterState[group];
  }

  function isCharacterPreviewFilterSelected(group, value) {
    const selected = selectedCharacterPreviewFilters(group);
    return value === "전체"
      ? selected.size === 0
      : selected.has(value);
  }

  function pruneCharacterPreviewFilters() {
    for (const group of ["genre", "tag", "platform", "world"]) {
      const valid = new Set(
        characterPreviewFilterOptions(group)
          .slice(1)
          .map((option) => option.value)
      );
      const selected = selectedCharacterPreviewFilters(group);

      for (const value of [...selected]) {
        if (!valid.has(value)) selected.delete(value);
      }
    }
  }

  function toggleCharacterPreviewFilter(group, value) {
    const selected = selectedCharacterPreviewFilters(group);
    if (!selected) return;

    if (value === "전체") {
      selected.clear();
      return;
    }

    if (selected.has(value)) selected.delete(value);
    else selected.add(value);
  }

  function characterPreviewFilterButton(
    label,
    group,
    active,
    value = label,
    count = null,
    picker = false
  ) {
    const countMarkup = picker && Number.isFinite(count)
      ? `<small>${count}</small>`
      : "";

    return `
      <button
        class="filter-chip ${picker ? "filter-chip--picker" : ""} ${active ? "active" : ""}"
        type="button"
        aria-pressed="${active}"
        data-character-filter-group="${group}"
        data-character-filter-value="${escapeHtml(value)}"
        data-character-filter-selected="${active}"
      >
        <span>${escapeHtml(label)}</span>
        ${countMarkup}
      </button>
    `;
  }

  function scheduleCharacterPreviewFilterFit() {
    window.cancelAnimationFrame(characterFilterFitFrame);
    characterFilterFitFrame = window.requestAnimationFrame(() => {
      [
        elements.previewGenreFilters,
        elements.previewTagFilters,
        elements.previewPlatformFilters,
        elements.previewWorldFilters
      ].forEach(fitCharacterPreviewFilterRow);
    });
  }

  function fitCharacterPreviewFilterRow(container) {
    if (!container || !container.isConnected) return;

    const optionButtons = [
      ...container.querySelectorAll(
        ".filter-chip[data-character-filter-group]"
      )
    ];
    const moreButton = container.querySelector(
      "[data-character-filter-more]"
    );

    if (optionButtons.length === 0 || !moreButton) return;

    optionButtons.forEach((button) => {
      button.hidden = false;
    });
    moreButton.hidden = true;

    const availableWidth = container.clientWidth;
    if (availableWidth <= 0) return;

    const style = getComputedStyle(container);
    const gap = Number.parseFloat(
      style.columnGap || style.gap || "0"
    ) || 0;

    const fullWidth = optionButtons.reduce(
      (total, button, index) =>
        total + button.offsetWidth + (index > 0 ? gap : 0),
      0
    );

    if (fullWidth <= availableWidth + 0.5) {
      return;
    }

    const allButton = optionButtons[0];
    const selectedButtons = optionButtons.slice(1).filter(
      (button) => button.dataset.characterFilterSelected === "true"
    );
    const ordinaryButtons = optionButtons.slice(1).filter(
      (button) => button.dataset.characterFilterSelected !== "true"
    );

    moreButton.hidden = false;

    let usedWidth = allButton.offsetWidth;

    selectedButtons.forEach((button) => {
      usedWidth += gap + button.offsetWidth;
    });

    let hiddenCount = 0;

    ordinaryButtons.forEach((button) => {
      const requiredWidth =
        usedWidth +
        gap +
        button.offsetWidth +
        gap +
        moreButton.offsetWidth;

      if (requiredWidth <= availableWidth + 0.5) {
        usedWidth += gap + button.offsetWidth;
        return;
      }

      button.hidden = true;
      hiddenCount += 1;
    });

    moreButton.hidden = hiddenCount === 0;
    const count = moreButton.querySelector("b");
    if (count) count.textContent = `+${hiddenCount}`;
  }

  function observeCharacterPreviewFilterRow(container) {
    if (
      !characterFilterResizeObserver ||
      observedCharacterFilterRows.has(container)
    ) {
      return;
    }

    observedCharacterFilterRows.add(container);
    characterFilterResizeObserver.observe(container);
  }

  function renderCharacterPreviewFilterRow(container, group) {
    const options = characterPreviewFilterOptions(group);
    const allOption = options[0];
    const remaining = options.slice(1);
    const selected = selectedCharacterPreviewFilters(group);

    const ordered = [
      ...remaining.filter((option) => selected.has(option.value)),
      ...remaining.filter((option) => !selected.has(option.value))
    ];

    container.dataset.characterFilterRow = group;
    container.innerHTML = [allOption, ...ordered]
      .map((option) =>
        characterPreviewFilterButton(
          option.label,
          group,
          isCharacterPreviewFilterSelected(group, option.value),
          option.value
        )
      )
      .join("");

    container.insertAdjacentHTML(
      "beforeend",
      `
        <button
          class="filter-more"
          type="button"
          data-character-filter-more="${group}"
          aria-haspopup="dialog"
          hidden
        >
          더보기 <b>+0</b>
        </button>
      `
    );

    observeCharacterPreviewFilterRow(container);
  }

  function renderCharacterPreviewFilters() {
    pruneCharacterPreviewFilters();
    renderCharacterPreviewFilterRow(
      elements.previewGenreFilters,
      "genre"
    );
    renderCharacterPreviewFilterRow(
      elements.previewTagFilters,
      "tag"
    );
    renderCharacterPreviewFilterRow(
      elements.previewPlatformFilters,
      "platform"
    );
    renderCharacterPreviewFilterRow(
      elements.previewWorldFilters,
      "world"
    );
    scheduleCharacterPreviewFilterFit();
  }

  function characterPreviewFilterPickerLabel(group) {
    if (group === "genre") return "장르 선택";
    if (group === "tag") return "태그 선택";
    if (group === "platform") return "플랫폼 선택";
    return "세계관 선택";
  }

  function renderCharacterPreviewFilterPicker() {
    if (!activeCharacterFilterPickerGroup) return;

    const normalized =
      characterFilterPickerQuery.trim().toLocaleLowerCase("ko");
    const options = characterPreviewFilterOptions(
      activeCharacterFilterPickerGroup
    ).filter((option) =>
      !normalized ||
      option.label.toLocaleLowerCase("ko").includes(normalized)
    );

    elements.previewCharacterFilterPickerOptions.innerHTML = options
      .map((option) =>
        characterPreviewFilterButton(
          option.label,
          activeCharacterFilterPickerGroup,
          isCharacterPreviewFilterSelected(
            activeCharacterFilterPickerGroup,
            option.value
          ),
          option.value,
          option.count,
          true
        )
      )
      .join("");

    elements.previewCharacterFilterPickerEmpty.hidden =
      options.length !== 0;
  }

  function openCharacterPreviewFilterPicker(group) {
    activeCharacterFilterPickerGroup = group;
    characterFilterPickerQuery = "";

    const label = characterPreviewFilterPickerLabel(group);
    elements.previewCharacterFilterPickerTitle.textContent = label;
    elements.previewCharacterFilterPickerSearch.value = "";
    elements.previewCharacterFilterPickerSearch.placeholder =
      `${label.replace(" 선택", "")} 검색`;

    renderCharacterPreviewFilterPicker();
    elements.previewCharacterFilterPicker.showModal();
    document.body.classList.add("character-filter-picker-open");

    requestAnimationFrame(() =>
      elements.previewCharacterFilterPickerSearch.focus()
    );
  }

  function closeCharacterPreviewFilterPicker() {
    if (elements.previewCharacterFilterPicker.open) {
      elements.previewCharacterFilterPicker.close();
    }

    activeCharacterFilterPickerGroup = null;
    characterFilterPickerQuery = "";
    document.body.classList.remove("character-filter-picker-open");
  }

  function hasActiveCharacterPreviewFilters() {
    return Boolean(
      characterPreviewFilterState.query.trim() ||
      characterPreviewFilterState.genre.size > 0 ||
      characterPreviewFilterState.tag.size > 0 ||
      characterPreviewFilterState.platform.size > 0 ||
      characterPreviewFilterState.world.size > 0
    );
  }

  function filteredCharacterPreviewCharacters() {
    const normalizedQuery =
      characterPreviewFilterState.query.trim().toLocaleLowerCase("ko");

    return project.characters.filter((character) => {
      const world = project.worlds.find(
        (item) => item.id === character.worldId
      );

      const searchable = [
        character.name,
        character.subtitle,
        ...(character.description || []),
        ...(character.genres || []).map(genreLabel),
        ...(character.tags || []),
        ...(character.platforms || []).map((link) => {
          const platform = platformCatalog.get(link.id);
          return platform?.name || link.id;
        }),
        world?.name || "",
        world?.subtitle || "",
        ...(world?.tags || [])
      ]
        .join(" ")
        .toLocaleLowerCase("ko");

      const queryMatch =
        !normalizedQuery || searchable.includes(normalizedQuery);

      const genreMatch =
        characterPreviewFilterState.genre.size === 0 ||
        (character.genres || []).some((genre) =>
          characterPreviewFilterState.genre.has(genre)
        );

      const tagMatch =
        characterPreviewFilterState.tag.size === 0 ||
        (character.tags || []).some((tag) =>
          characterPreviewFilterState.tag.has(tag)
        );

      const platformMatch =
        characterPreviewFilterState.platform.size === 0 ||
        (character.platforms || []).some((link) =>
          characterPreviewFilterState.platform.has(link.id)
        );

      const worldMatch =
        characterPreviewFilterState.world.size === 0 ||
        [...characterPreviewFilterState.world].some((worldId) =>
          worldId === "__independent__"
            ? !character.worldId
            : character.worldId === worldId
        );

      // 원본 규칙: 같은 분류 안에서는 OR, 서로 다른 분류 사이에서는 AND.
      return (
        queryMatch &&
        genreMatch &&
        tagMatch &&
        platformMatch &&
        worldMatch
      );
    });
  }

  function resetCharacterPreviewFilters() {
    characterPreviewFilterState.query = "";
    characterPreviewFilterState.genre.clear();
    characterPreviewFilterState.tag.clear();
    characterPreviewFilterState.platform.clear();
    characterPreviewFilterState.world.clear();
    elements.previewCharacterSearchInput.value = "";
    renderCharacterPreview();
  }

  function previewCharacterColumnCount() {
    const template = getComputedStyle(elements.previewCharacterGrid).gridTemplateColumns;
    if (!template || template === "none") return 1;
    return Math.max(1, template.split(/\s+/).filter(Boolean).length);
  }

  function updateCharacterPreviewLimit() {
    const cards = [...elements.previewCharacterGrid.children];
    const visibleLimit = previewCharacterColumnCount() * 2;
    const forceExpanded = hasActiveCharacterPreviewFilters();
    const canCollapse = !forceExpanded && cards.length > visibleLimit;
    const expanded =
      forceExpanded || characterPreviewExpanded || !canCollapse;

    cards.forEach((card, index) => {
      card.hidden = !expanded && index >= visibleLimit;
    });

    elements.previewCharacterToggleWrap.hidden = !canCollapse;
    elements.previewCharacterToggle.setAttribute(
      "aria-expanded",
      String(expanded)
    );
    elements.previewCharacterToggle.classList.toggle(
      "is-expanded",
      expanded
    );

    const hiddenCount = Math.max(0, cards.length - visibleLimit);
    const label =
      elements.previewCharacterToggle.querySelector("span");

    if (label) {
      label.textContent = expanded
        ? "캐릭터 접기"
        : `캐릭터 더보기 +${hiddenCount}`;
    }
  }

  function renderCharacterPreview() {
    renderArchiveCounts();
    const featured = [
      ...project.characters.filter((character) => character.featured),
      ...project.characters.filter((character) => !character.featured)
    ].filter((character, index, list) =>
      list.findIndex((item) => item.id === character.id) === index
    ).slice(0, 3);

    elements.previewFeaturedSection.hidden = featured.length === 0;
    elements.previewFeaturedGrid.innerHTML = featured
      .map((character) => characterCardMarkup(character, true))
      .join("");

    renderCharacterPreviewFilters();

    const characters = filteredCharacterPreviewCharacters();
    const hasCharacters = characters.length > 0;

    elements.previewCharacterGrid.innerHTML = hasCharacters
      ? characters
          .map((character) => characterCardMarkup(character))
          .join("")
      : "";

    elements.previewCharacterResultSummary.textContent =
      `총 ${project.characters.length}명 중 ${characters.length}명 표시`;
    elements.previewCharacterEmpty.hidden = hasCharacters;
    elements.previewCharacterGrid.hidden = !hasCharacters;

    if (project.characters.length === 0) {
      characterPreviewExpanded = false;
    }

    updateCharacterPreviewLimit();

    if (elements.previewCharacterFilterPicker.open) {
      renderCharacterPreviewFilterPicker();
    }
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
    if (item.collapsible) {
      return `
        <details class="character-preview-content-box is-public is-collapsible">
          <summary>
            <span class="character-preview-content-icon">✦</span>
            <span><small>${escapeHtml(type)}</small><strong>${escapeHtml(title)}</strong></span>
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

    const genreLabels = (character.genres || []).map(genreLabel);

elements.characterPreviewKicker.textContent =
  genreLabels.join(" · ") || "CHARACTER";

elements.characterPreviewModalTags.innerHTML = [
  ...genreLabels,
  ...(character.tags || [])
]
  .map((tag) => `<span>${escapeHtml(tag)}</span>`)
  .join("");
    elements.characterPreviewModalTags.hidden = !(character.genres || []).length && !(character.tags || []).length;
    renderSoundtrack(elements.characterPreviewSoundtrack, character);

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
    stopSoundtrack(elements.characterPreviewSoundtrack);
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
    const musicMetadata = (character.music || [])
      .map(getMusicFileMetadata)
      .filter(Boolean);
    for (const image of metadata) releaseCharacterImageObjectUrl(image.id);
    for (const audio of musicMetadata) releaseMusicObjectUrl(audio.id);
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
    for (const audio of musicMetadata) {
      try { await deleteImageRecord(audio.id); } catch (error) { console.error(error); }
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
    } else if (field === "collapsible") {
      item.collapsible = target.checked;
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

  async function addCharacterImageFiles(files) {
    const character = getSelectedCharacter();
    const candidates = [...(files || [])].filter(Boolean);
    if (!character || candidates.length === 0) return;

    const remaining = 5 - character.images.length;
    if (remaining <= 0) {
      window.alert("캐릭터 이미지는 최대 5장까지 등록할 수 있습니다.");
      return;
    }
    if (candidates.length > remaining) {
      window.alert(`현재 ${remaining}장만 더 추가할 수 있습니다.`);
      return;
    }

    elements.characterImageInput.disabled = true;
    setSaveStatus("캐릭터 PNG 저장 중…");
    const storedIds = [];
    try {
      const nextMetadata = [];
      for (const file of candidates) {
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

  async function handleCharacterImageSelection() {
    const files = [...(elements.characterImageInput.files || [])];
    elements.characterImageInput.value = "";
    await addCharacterImageFiles(files);
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

    renderMusicEditor("world");
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
            ${
              hasPlayableMusic(world)
                ? '<span class="archive-music-mark" title="음악 있음" aria-hidden="true">♫</span>'
                : ""
            }
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
    renderArchiveCounts();
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
    renderSoundtrack(elements.worldPreviewSoundtrack, world);

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
    stopSoundtrack(elements.worldPreviewSoundtrack);
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
    const musicMetadata = (world.music || [])
      .map(getMusicFileMetadata)
      .filter(Boolean);
    const index = project.worlds.findIndex((item) => item.id === world.id);

    for (const character of linkedCharacters) {
      character.worldId = "";
    }

    releaseWorldImageObjectUrl(world.id);
    for (const audio of musicMetadata) releaseMusicObjectUrl(audio.id);
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
    for (const audio of musicMetadata) {
      try { await deleteImageRecord(audio.id); } catch (error) { console.error(error); }
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

  async function storeWorldImageFile(file) {
    const world = getSelectedWorld();
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

  async function handleWorldImageSelection() {
    const file = elements.worldImageInput.files?.[0] || null;
    elements.worldImageInput.value = "";
    await storeWorldImageFile(file);
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

  function renderCreatorBackgroundPreview() {
    const url = creatorBackgroundUrl();
    elements.profileBackgroundEditorPreview.hidden = !url;
    elements.profileBackgroundEditorFallback.hidden = Boolean(url);
    elements.previewProfileBackgroundImage.hidden = !url;
    elements.removeProfileBackgroundButton.hidden = !(
      url || getCreatorBackgroundMetadata() || project.creator.background
    );
    if (url) {
      elements.profileBackgroundEditorPreview.src = url;
      elements.previewProfileBackgroundImage.src = url;
    } else {
      elements.profileBackgroundEditorPreview.removeAttribute("src");
      elements.previewProfileBackgroundImage.removeAttribute("src");
    }
    updateCreatorBackgroundStorageStatus();
  }

  function applyPreviewTheme() {
    const textColor = normalizeHexColor(
      project.site.textColor,
      DEFAULT_TEXT_COLOR
    );
    const themeColor = normalizeHexColor(
      project.site.themeColor,
      DEFAULT_THEME_COLOR
    );
    const themeInk = contrastTextColor(themeColor);
    const targets = [
      elements.previewCanvas,
      elements.worldPreviewModal,
      elements.characterPreviewModal,
      elements.previewCharacterFilterPicker
    ];

    targets.forEach((target) => {
      if (!target) return;

      target.style.setProperty("--text", textColor);
      target.style.setProperty(
        "--muted",
        `color-mix(in srgb, ${themeColor} 28%, #aaa8b4)`
      );

      target.style.setProperty("--theme", themeColor);
      target.style.setProperty("--violet", themeColor);
      target.style.setProperty("--accent", themeColor);
      target.style.setProperty("--accent-ink", themeInk);

      target.style.setProperty(
        "--bg",
        `color-mix(in srgb, ${themeColor} 14%, #08080d)`
      );
      target.style.setProperty(
        "--surface",
        `color-mix(in srgb, ${themeColor} 20%, #101018)`
      );
      target.style.setProperty(
        "--surface-2",
        `color-mix(in srgb, ${themeColor} 27%, #151520)`
      );
      target.style.setProperty(
        "--surface-3",
        `color-mix(in srgb, ${themeColor} 35%, #1b1b29)`
      );

      target.style.setProperty(
        "--line",
        `color-mix(in srgb, ${themeColor} 40%, rgba(255,255,255,.08))`
      );
      target.style.setProperty(
        "--line-strong",
        `color-mix(in srgb, ${themeColor} 64%, rgba(255,255,255,.14))`
      );

      target.style.setProperty(
        "--shadow",
        `0 24px 80px color-mix(in srgb, ${themeColor} 30%, rgba(0,0,0,.66))`
      );
    });
  }

  function renderArchiveCounts() {
    const genres = new Set(
      project.characters.flatMap((character) => character.genres || [])
    );
    elements.previewCharacterCount.textContent = project.characters.length;
    elements.previewWorldCount.textContent = project.worlds.length;
    elements.previewGenreCount.textContent = genres.size;
  }

  function applyPreviewWidth(value, persist = true) {
    const normalized = Math.min(
      PREVIEW_WIDTH_MAX,
      Math.max(PREVIEW_WIDTH_MIN, Number(value) || PREVIEW_WIDTH_DEFAULT)
    );
    document.documentElement.style.setProperty(
      "--preview-panel-width",
      `${normalized}px`
    );
    elements.previewWidthInput.value = String(normalized);
    elements.previewWidthOutput.value = `${normalized}px`;
    if (persist) {
      try {
        window.localStorage.setItem(
          PREVIEW_WIDTH_STORAGE_KEY,
          String(normalized)
        );
      } catch (error) {
        console.error(error);
      }
    }
    requestAnimationFrame(() => {
      updateWorldPreviewLimit();
      updateCharacterPreviewLimit();
      scheduleCharacterPreviewFilterFit();
    });
  }

  function restorePreviewWidth() {
    let stored = PREVIEW_WIDTH_DEFAULT;
    try {
      stored = Number(
        window.localStorage.getItem(PREVIEW_WIDTH_STORAGE_KEY)
      ) || PREVIEW_WIDTH_DEFAULT;
    } catch (error) {
      console.error(error);
    }
    applyPreviewWidth(stored, false);
  }

  function renderPreview() {
    applyPreviewTheme();
    renderArchiveCounts();
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
    renderCreatorBackgroundPreview();
    renderWorldPreview();
    renderCharacterPreview();

    document.title = `${siteTitle} | 포트폴리오 생성기`;
  }

  function populateFieldsFromProject() {
    elements.siteTitleInput.value = project.site.title || "";
    elements.siteDescriptionInput.value = project.site.description || "";
    elements.siteTextColorInput.value = normalizeHexColor(
      project.site.textColor,
      DEFAULT_TEXT_COLOR
    );
    elements.siteThemeColorInput.value = normalizeHexColor(
      project.site.themeColor,
      DEFAULT_THEME_COLOR
    );
    elements.siteTextColorValue.value = elements.siteTextColorInput.value;
    elements.siteThemeColorValue.value = elements.siteThemeColorInput.value;
    elements.creatorNameInput.value = project.creator.name || "";
    elements.creatorHandleInput.value = project.creator.handle || "";
    elements.creatorFallbackInput.value =
      project.creator.fallbackText || "";
    elements.creatorBioInput.value =
      bioArrayToText(project.creator.bio);
  }

  function releaseCreatorBackgroundObjectUrl() {
    if (creatorBackgroundPreviewUrl) {
      URL.revokeObjectURL(creatorBackgroundPreviewUrl);
    }
    creatorBackgroundBlob = null;
    creatorBackgroundPreviewUrl = "";
    elements.profileBackgroundInput.value = "";
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

  async function restoreCreatorBackgroundFromDatabase() {
    releaseCreatorBackgroundObjectUrl();
    creatorBackgroundRestoreMissing = false;
    const metadata = getCreatorBackgroundMetadata();

    if (!metadata?.id) {
      renderCreatorBackgroundPreview();
      return false;
    }

    try {
      const record = await getImageRecord(metadata.id);
      if (!record?.blob || record.blob.type !== "image/png") {
        creatorBackgroundRestoreMissing = true;
        renderCreatorBackgroundPreview();
        return false;
      }
      creatorBackgroundBlob = record.blob;
      creatorBackgroundPreviewUrl = URL.createObjectURL(record.blob);
      renderCreatorBackgroundPreview();
      return true;
    } catch (error) {
      console.error(error);
      creatorBackgroundRestoreMissing = true;
      renderCreatorBackgroundPreview();
      return false;
    }
  }

  async function storeCreatorBackgroundFile(file) {
    if (!file) return;
    elements.profileBackgroundInput.disabled = true;
    setSaveStatus("프로필 배경 PNG 저장 중…");

    try {
      const previousMetadata = getCreatorBackgroundMetadata();
      const sanitized = await sanitizePng(file, "프로필 배경 PNG");
      const id = createImageId();
      const updatedAt = new Date().toISOString();
      const record = {
        id,
        role: "creator-background",
        ownerId: "creator",
        name: file.name || "profile-background.png",
        type: "image/png",
        size: sanitized.blob.size,
        width: sanitized.width,
        height: sanitized.height,
        updatedAt,
        blob: sanitized.blob
      };
      await putImageRecord(record);
      project.creator.background = {
        id,
        name: record.name,
        type: record.type,
        size: record.size,
        width: record.width,
        height: record.height,
        updatedAt
      };

      releaseCreatorBackgroundObjectUrl();
      creatorBackgroundBlob = sanitized.blob;
      creatorBackgroundPreviewUrl = URL.createObjectURL(sanitized.blob);
      creatorBackgroundRestoreMissing = false;

      if (previousMetadata?.id && previousMetadata.id !== id) {
        try {
          await deleteImageRecord(previousMetadata.id);
        } catch (cleanupError) {
          console.error(cleanupError);
        }
      }

      renderPreview();
      saveProjectToStorage();
      setSaveStatus("프로필 배경 PNG가 브라우저에 저장됨");
    } catch (error) {
      elements.profileBackgroundInput.value = "";
      console.error(error);
      window.alert(error.message || "프로필 배경 이미지를 처리하지 못했습니다.");
      setSaveStatus("프로필 배경 PNG 저장 실패");
    } finally {
      elements.profileBackgroundInput.disabled = false;
    }
  }

  async function handleCreatorBackgroundSelection() {
    const file = elements.profileBackgroundInput.files?.[0] || null;
    elements.profileBackgroundInput.value = "";
    await storeCreatorBackgroundFile(file);
  }

  async function removeCreatorBackground() {
    const metadata = getCreatorBackgroundMetadata();
    releaseCreatorBackgroundObjectUrl();
    creatorBackgroundRestoreMissing = false;
    project.creator.background = "";
    renderPreview();
    saveProjectToStorage();

    if (metadata?.id) {
      try {
        await deleteImageRecord(metadata.id);
      } catch (error) {
        console.error(error);
        setSaveStatus("배경 연결은 제거됐지만 저장 파일 정리에 실패함");
        return;
      }
    }
    setSaveStatus("프로필 배경 PNG가 제거됨");
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

  async function storeAvatarFile(file) {
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

  async function handleAvatarSelection() {
    const file = elements.avatarInput.files?.[0] || null;
    elements.avatarInput.value = "";
    await storeAvatarFile(file);
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

  function setActiveImageDropTarget(zone) {
    elements.imageDropZones.forEach((item) => {
      item.classList.toggle("is-image-target-active", item === zone);
    });
    activeImageDropTarget = zone?.dataset.imageDropTarget || null;
  }

  function clipboardImageFiles(event) {
    return [...(event.clipboardData?.items || [])]
      .filter((item) => item.kind === "file" && item.type === "image/png")
      .map((item) => item.getAsFile())
      .filter(Boolean);
  }

  function droppedPngFiles(dataTransfer) {
    return [...(dataTransfer?.files || [])].filter((file) =>
      file.type === "image/png" || file.name.toLowerCase().endsWith(".png")
    );
  }

  async function routeImageFiles(target, files) {
    const candidates = [...(files || [])].filter(Boolean);
    if (candidates.length === 0) {
      window.alert("PNG 이미지 파일을 찾지 못했습니다.");
      return;
    }

    if (target === "avatar") {
      await storeAvatarFile(candidates[0]);
      return;
    }
    if (target === "profile-background") {
      await storeCreatorBackgroundFile(candidates[0]);
      return;
    }
    if (target === "world") {
      if (!getSelectedWorld()) {
        window.alert("먼저 세계관을 선택해 주세요.");
        return;
      }
      await storeWorldImageFile(candidates[0]);
      return;
    }
    if (target === "character") {
      if (!getSelectedCharacter()) {
        window.alert("먼저 캐릭터를 선택해 주세요.");
        return;
      }
      await addCharacterImageFiles(candidates);
    }
  }

  function initializeImageDropZones() {
    elements.imageDropZones.forEach((zone) => {
      zone.addEventListener("focus", () => setActiveImageDropTarget(zone));
      zone.addEventListener("click", () => setActiveImageDropTarget(zone));
      zone.addEventListener("dragenter", (event) => {
        event.preventDefault();
        setActiveImageDropTarget(zone);
        zone.classList.add("is-drag-over");
      });
      zone.addEventListener("dragover", (event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = "copy";
        zone.classList.add("is-drag-over");
      });
      zone.addEventListener("dragleave", (event) => {
        if (!zone.contains(event.relatedTarget)) {
          zone.classList.remove("is-drag-over");
        }
      });
      zone.addEventListener("drop", async (event) => {
        event.preventDefault();
        zone.classList.remove("is-drag-over");
        setActiveImageDropTarget(zone);
        await routeImageFiles(
          zone.dataset.imageDropTarget,
          droppedPngFiles(event.dataTransfer)
        );
      });
    });

    document.addEventListener("paste", async (event) => {
      if (!activeImageDropTarget) return;
      const target = event.target;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target?.isContentEditable
      ) return;

      const files = clipboardImageFiles(event);
      if (files.length === 0) return;
      event.preventDefault();
      await routeImageFiles(activeImageDropTarget, files);
    });
  }

  async function replaceCurrentProject(nextProject, restoreImages = true) {
    project = normalizeProject(nextProject);
    releaseAvatarObjectUrl();
    releaseCreatorBackgroundObjectUrl();
    releaseAllWorldImageObjectUrls();
    releaseAllCharacterImageObjectUrls();
    releaseAllMusicObjectUrls();
    avatarRestoreMissing = false;
    creatorBackgroundRestoreMissing = false;
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
    await restoreCreatorBackgroundFromDatabase();
    await restoreWorldImagesFromDatabase();
    await restoreCharacterImagesFromDatabase();
    await restoreMusicFromDatabase();
    return avatarRestored;
  }

  function buildBackupBaseName() {
    return (project.site.title || "portfolio-project")
      .trim()
      .replace(/[\\/:*?"<>|]+/g, "-")
      .replace(/\s+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "portfolio-project";
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  function createCrc32Table() {
    const table = new Uint32Array(256);
    for (let index = 0; index < 256; index += 1) {
      let value = index;
      for (let bit = 0; bit < 8; bit += 1) {
        value = value & 1
          ? 0xedb88320 ^ (value >>> 1)
          : value >>> 1;
      }
      table[index] = value >>> 0;
    }
    return table;
  }

  const ZIP_CRC32_TABLE = createCrc32Table();

  function crc32(bytes) {
    let crc = 0xffffffff;
    for (const byte of bytes) {
      crc = ZIP_CRC32_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
    }
    return (crc ^ 0xffffffff) >>> 0;
  }

  function zipDateTime(date = new Date()) {
    const year = Math.max(1980, date.getFullYear());
    const time =
      (date.getHours() << 11) |
      (date.getMinutes() << 5) |
      Math.floor(date.getSeconds() / 2);
    const day =
      ((year - 1980) << 9) |
      ((date.getMonth() + 1) << 5) |
      date.getDate();
    return { time, day };
  }

  function concatUint8Arrays(parts) {
    const length = parts.reduce((sum, part) => sum + part.length, 0);
    const output = new Uint8Array(length);
    let offset = 0;
    for (const part of parts) {
      output.set(part, offset);
      offset += part.length;
    }
    return output;
  }

  async function createStoredZip(entries) {
    const encoder = new TextEncoder();
    const localParts = [];
    const centralParts = [];
    let localOffset = 0;
    const { time, day } = zipDateTime();

    for (const entry of entries) {
      const nameBytes = encoder.encode(entry.name);
      const dataBytes = entry.data instanceof Uint8Array
        ? entry.data
        : new Uint8Array(await entry.data.arrayBuffer());
      const checksum = crc32(dataBytes);

      const localHeader = new Uint8Array(30 + nameBytes.length);
      const localView = new DataView(localHeader.buffer);
      localView.setUint32(0, 0x04034b50, true);
      localView.setUint16(4, 20, true);
      localView.setUint16(6, 0x0800, true);
      localView.setUint16(8, 0, true);
      localView.setUint16(10, time, true);
      localView.setUint16(12, day, true);
      localView.setUint32(14, checksum, true);
      localView.setUint32(18, dataBytes.length, true);
      localView.setUint32(22, dataBytes.length, true);
      localView.setUint16(26, nameBytes.length, true);
      localView.setUint16(28, 0, true);
      localHeader.set(nameBytes, 30);
      localParts.push(localHeader, dataBytes);

      const centralHeader = new Uint8Array(46 + nameBytes.length);
      const centralView = new DataView(centralHeader.buffer);
      centralView.setUint32(0, 0x02014b50, true);
      centralView.setUint16(4, 20, true);
      centralView.setUint16(6, 20, true);
      centralView.setUint16(8, 0x0800, true);
      centralView.setUint16(10, 0, true);
      centralView.setUint16(12, time, true);
      centralView.setUint16(14, day, true);
      centralView.setUint32(16, checksum, true);
      centralView.setUint32(20, dataBytes.length, true);
      centralView.setUint32(24, dataBytes.length, true);
      centralView.setUint16(28, nameBytes.length, true);
      centralView.setUint16(30, 0, true);
      centralView.setUint16(32, 0, true);
      centralView.setUint16(34, 0, true);
      centralView.setUint16(36, 0, true);
      centralView.setUint32(38, 0, true);
      centralView.setUint32(42, localOffset, true);
      centralHeader.set(nameBytes, 46);
      centralParts.push(centralHeader);

      localOffset += localHeader.length + dataBytes.length;
    }

    const centralDirectory = concatUint8Arrays(centralParts);
    const end = new Uint8Array(22);
    const endView = new DataView(end.buffer);
    endView.setUint32(0, 0x06054b50, true);
    endView.setUint16(4, 0, true);
    endView.setUint16(6, 0, true);
    endView.setUint16(8, entries.length, true);
    endView.setUint16(10, entries.length, true);
    endView.setUint32(12, centralDirectory.length, true);
    endView.setUint32(16, localOffset, true);
    endView.setUint16(20, 0, true);

    return new Blob(
      [...localParts, centralDirectory, end],
      { type: "application/zip" }
    );
  }

  function findZipEnd(bytes) {
    const minimum = Math.max(0, bytes.length - 65557);
    for (let offset = bytes.length - 22; offset >= minimum; offset -= 1) {
      if (
        bytes[offset] === 0x50 &&
        bytes[offset + 1] === 0x4b &&
        bytes[offset + 2] === 0x05 &&
        bytes[offset + 3] === 0x06
      ) return offset;
    }
    return -1;
  }

  async function inflateRaw(bytes) {
    if (typeof DecompressionStream !== "function") {
      throw new Error("이 브라우저에서는 압축된 ZIP을 읽을 수 없습니다.");
    }
    const stream = new Blob([bytes])
      .stream()
      .pipeThrough(new DecompressionStream("deflate-raw"));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }

  async function readZipEntries(file) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const endOffset = findZipEnd(bytes);
    if (endOffset < 0) throw new Error("올바른 ZIP 백업 파일이 아닙니다.");

    const entryCount = view.getUint16(endOffset + 10, true);
    let offset = view.getUint32(endOffset + 16, true);
    const decoder = new TextDecoder("utf-8");
    const entries = new Map();

    for (let index = 0; index < entryCount; index += 1) {
      if (view.getUint32(offset, true) !== 0x02014b50) {
        throw new Error("ZIP 중앙 목록이 손상되었습니다.");
      }
      const method = view.getUint16(offset + 10, true);
      const compressedSize = view.getUint32(offset + 20, true);
      const uncompressedSize = view.getUint32(offset + 24, true);
      const nameLength = view.getUint16(offset + 28, true);
      const extraLength = view.getUint16(offset + 30, true);
      const commentLength = view.getUint16(offset + 32, true);
      const localHeaderOffset = view.getUint32(offset + 42, true);
      const name = decoder.decode(bytes.slice(offset + 46, offset + 46 + nameLength));

      if (view.getUint32(localHeaderOffset, true) !== 0x04034b50) {
        throw new Error(`ZIP의 ${name} 항목이 손상되었습니다.`);
      }
      const localNameLength = view.getUint16(localHeaderOffset + 26, true);
      const localExtraLength = view.getUint16(localHeaderOffset + 28, true);
      const dataStart = localHeaderOffset + 30 + localNameLength + localExtraLength;
      const compressed = bytes.slice(dataStart, dataStart + compressedSize);
      let data;

      if (method === 0) data = compressed;
      else if (method === 8) data = await inflateRaw(compressed);
      else throw new Error(`지원하지 않는 ZIP 압축 방식입니다: ${method}`);

      if (data.length !== uncompressedSize) {
        throw new Error(`ZIP의 ${name} 파일 크기가 올바르지 않습니다.`);
      }
      entries.set(name, data);
      offset += 46 + nameLength + extraLength + commentLength;
    }

    return entries;
  }

  function safeDeployAssetSegment(value, fallback = "asset") {
    const normalized = String(value || "")
      .trim()
      .replace(/[^a-zA-Z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 96);
    return normalized || fallback;
  }

  async function fetchDeployBlob(url, label) {
    const source = String(url || "").trim();
    if (!source) return null;

    try {
      const response = await fetch(source, { cache: "no-store" });
      if (!response.ok) {
        throw new Error(`${response.status} ${response.statusText}`);
      }
      return await response.blob();
    } catch (error) {
      console.error(error);
      throw new Error(`${label} 파일을 읽지 못했습니다.`);
    }
  }

  async function resolveDeployBlob({
    preferredBlob = null,
    storedBlob = null,
    previewUrl = "",
    legacyUrl = "",
    label = "파일"
  }) {
    if (preferredBlob instanceof Blob) return preferredBlob;
    if (storedBlob instanceof Blob) return storedBlob;

    const previewSource = String(previewUrl || "").trim();
    if (previewSource) {
      try {
        return await fetchDeployBlob(previewSource, label);
      } catch (error) {
        console.warn(error);
      }
    }

    const legacySource = String(legacyUrl || "").trim();
    if (legacySource) {
      return await fetchDeployBlob(legacySource, label);
    }

    return null;
  }

  async function readGeneratorStylesheetText() {
    const stylesheetUrl = new URL("./generator.css", window.location.href).href;

    try {
      const response = await fetch(stylesheetUrl, { cache: "no-store" });
      if (response.ok) return await response.text();
    } catch (error) {
      console.warn(error);
    }

    const stylesheet = [...document.styleSheets].find((sheet) =>
      sheet.href && new URL(sheet.href, window.location.href).href === stylesheetUrl
    );

    if (!stylesheet) {
      throw new Error("배포 사이트용 CSS를 읽지 못했습니다.");
    }

    try {
      return [...stylesheet.cssRules].map((rule) => rule.cssText).join("\n");
    } catch (error) {
      console.error(error);
      throw new Error("배포 사이트용 CSS를 복사하지 못했습니다.");
    }
  }

  function deployThemeStyleText() {
    const textColor = normalizeHexColor(
      project.site.textColor,
      DEFAULT_TEXT_COLOR
    );
    const themeColor = normalizeHexColor(
      project.site.themeColor,
      DEFAULT_THEME_COLOR
    );
    const themeInk = contrastTextColor(themeColor);

    return [
      `--text:${textColor}`,
      `--muted:color-mix(in srgb, ${themeColor} 28%, #aaa8b4)`,
      `--theme:${themeColor}`,
      `--violet:${themeColor}`,
      `--accent:${themeColor}`,
      `--accent-ink:${themeInk}`,
      `--bg:color-mix(in srgb, ${themeColor} 14%, #08080d)`,
      `--surface:color-mix(in srgb, ${themeColor} 20%, #101018)`,
      `--surface-2:color-mix(in srgb, ${themeColor} 27%, #151520)`,
      `--surface-3:color-mix(in srgb, ${themeColor} 35%, #1b1b29)`,
      `--line:color-mix(in srgb, ${themeColor} 40%, rgba(255,255,255,.08))`,
      `--line-strong:color-mix(in srgb, ${themeColor} 64%, rgba(255,255,255,.14))`,
      `--shadow:0 24px 80px color-mix(in srgb, ${themeColor} 30%, rgba(0,0,0,.66))`
    ].join(";");
  }

  function cloneDeployNode(node) {
    const clone = node.cloneNode(true);
    clone.removeAttribute("open");

    clone.querySelectorAll("dialog").forEach((dialog) =>
      dialog.removeAttribute("open")
    );
    clone.querySelectorAll('input[type="search"]').forEach((input) => {
      input.value = "";
      input.removeAttribute("value");
    });
    clone.querySelectorAll("audio, iframe").forEach((media) =>
      media.removeAttribute("src")
    );
    clone.querySelectorAll('img[src^="blob:"]').forEach((image) =>
      image.removeAttribute("src")
    );

    return clone;
  }

  function buildNetlifyDeployHtml() {
    const preview = cloneDeployNode(elements.previewCanvas);
    const filterPicker = cloneDeployNode(
      elements.previewCharacterFilterPicker
    );
    const characterModal = cloneDeployNode(elements.characterPreviewModal);
    const worldModal = cloneDeployNode(elements.worldPreviewModal);

    preview.classList.add("exported-preview-canvas");
    preview.style.cssText = deployThemeStyleText();
    filterPicker.style.cssText = deployThemeStyleText();
    characterModal.style.cssText = deployThemeStyleText();
    worldModal.style.cssText = deployThemeStyleText();

    const title = escapeHtml(
      project.site.title || project.creator.name || "Character Portfolio"
    );
    const description = escapeHtml(project.site.description || "");
    const bodyStyle = escapeHtml(deployThemeStyleText());

    return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="${description}">
  <title>${title}</title>
  <link rel="stylesheet" href="./assets/site.css">
</head>
<body class="exported-portfolio-site" style="${bodyStyle}">
  <main class="exported-site-shell">
    ${preview.outerHTML}
  </main>

  ${filterPicker.outerHTML}
  ${characterModal.outerHTML}
  ${worldModal.outerHTML}

  <script src="./assets/site-data.js"></script>
  <script src="./assets/site.js" defer></script>
</body>
</html>
`;
  }

  function netlifyPortfolioRuntime() {
    "use strict";

    const project = window.PORTFOLIO_PROJECT || {
      site: {},
      creator: { bio: [], links: [] },
      worlds: [],
      characters: []
    };
    const catalog = window.PORTFOLIO_CATALOG || {
      profileLinkServices: [],
      platforms: [],
      genres: []
    };

    const serviceCatalog = new Map(
      (catalog.profileLinkServices || []).map((item) => [item.id, item])
    );
    const platformCatalog = new Map(
      (catalog.platforms || []).map((item) => [item.id, item])
    );
    const genreCatalog = new Map(
      (catalog.genres || []).map((item) => [item.id, item])
    );

    const filterState = {
      query: "",
      genre: new Set(),
      tag: new Set(),
      platform: new Set(),
      world: new Set()
    };
    let activeFilterPickerGroup = null;
    let filterPickerQuery = "";
    let worldExpanded = false;
    let characterExpanded = false;
    let filterFitFrame = 0;

    const elements = {
      previewCanvas: document.querySelector("#previewCanvas"),
      previewSiteTitle: document.querySelector("#previewSiteTitle"),
      previewSiteDescription: document.querySelector("#previewSiteDescription"),
      previewCreatorName: document.querySelector("#previewCreatorName"),
      previewCreatorHandle: document.querySelector("#previewCreatorHandle"),
      previewCreatorBio: document.querySelector("#previewCreatorBio"),
      previewCreatorLinks: document.querySelector("#previewCreatorLinks"),
      previewAvatarImage: document.querySelector("#previewAvatarImage"),
      previewAvatarFallback: document.querySelector("#previewAvatarFallback"),
      previewProfileBackgroundImage: document.querySelector("#previewProfileBackgroundImage"),
      previewCharacterCount: document.querySelector("#previewCharacterCount"),
      previewWorldCount: document.querySelector("#previewWorldCount"),
      previewGenreCount: document.querySelector("#previewGenreCount"),
      previewFeaturedSection: document.querySelector("#previewFeaturedSection"),
      previewFeaturedGrid: document.querySelector("#previewFeaturedGrid"),
      previewWorldGrid: document.querySelector("#previewWorldGrid"),
      previewWorldEmpty: document.querySelector("#previewWorldEmpty"),
      previewWorldToggleWrap: document.querySelector("#previewWorldToggleWrap"),
      previewWorldToggle: document.querySelector("#previewWorldToggle"),
      previewCharacterGrid: document.querySelector("#previewCharacterGrid"),
      previewCharacterEmpty: document.querySelector("#previewCharacterEmpty"),
      previewCharacterResultSummary: document.querySelector("#previewCharacterResultSummary"),
      previewCharacterToggleWrap: document.querySelector("#previewCharacterToggleWrap"),
      previewCharacterToggle: document.querySelector("#previewCharacterToggle"),
      previewCharacterSearchInput: document.querySelector("#previewCharacterSearchInput"),
      previewGenreFilters: document.querySelector("#previewGenreFilters"),
      previewTagFilters: document.querySelector("#previewTagFilters"),
      previewPlatformFilters: document.querySelector("#previewPlatformFilters"),
      previewWorldFilters: document.querySelector("#previewWorldFilters"),
      previewCharacterResetFilters: document.querySelector("#previewCharacterResetFilters"),
      filterPicker: document.querySelector("#previewCharacterFilterPicker"),
      filterPickerTitle: document.querySelector("#previewCharacterFilterPickerTitle"),
      filterPickerClose: document.querySelector("#previewCharacterFilterPickerClose"),
      filterPickerSearch: document.querySelector("#previewCharacterFilterPickerSearch"),
      filterPickerOptions: document.querySelector("#previewCharacterFilterPickerOptions"),
      filterPickerEmpty: document.querySelector("#previewCharacterFilterPickerEmpty"),
      characterModal: document.querySelector("#characterPreviewModal"),
      characterModalClose: document.querySelector("#characterPreviewModalClose"),
      characterModalTitle: document.querySelector("#characterPreviewModalTitle"),
      characterModalSummary: document.querySelector("#characterPreviewModalSummary"),
      characterMainImage: document.querySelector("#characterPreviewMainImage"),
      characterMainImageFallback: document.querySelector("#characterPreviewMainImageFallback"),
      characterThumbnails: document.querySelector("#characterPreviewThumbnails"),
      characterPlatforms: document.querySelector("#characterPreviewPlatforms"),
      characterKicker: document.querySelector("#characterPreviewKicker"),
      characterTags: document.querySelector("#characterPreviewModalTags"),
      characterSoundtrack: document.querySelector("#characterPreviewSoundtrack"),
      characterDescription: document.querySelector("#characterPreviewModalDescription"),
      characterWorldPanel: document.querySelector("#characterPreviewWorldPanel"),
      characterWorldButton: document.querySelector("#characterPreviewWorldButton"),
      characterWorldName: document.querySelector("#characterPreviewWorldName"),
      characterWorldSummary: document.querySelector("#characterPreviewWorldSummary"),
      characterContentSection: document.querySelector("#characterPreviewContentSection"),
      characterContents: document.querySelector("#characterPreviewContents"),
      worldModal: document.querySelector("#worldPreviewModal"),
      worldModalClose: document.querySelector("#worldPreviewModalClose"),
      worldModalImage: document.querySelector("#worldPreviewModalImage"),
      worldModalImageFallback: document.querySelector("#worldPreviewModalImageFallback"),
      worldModalTitle: document.querySelector("#worldPreviewModalTitle"),
      worldModalSummary: document.querySelector("#worldPreviewModalSummary"),
      worldModalTags: document.querySelector("#worldPreviewModalTags"),
      worldSoundtrack: document.querySelector("#worldPreviewSoundtrack"),
      worldModalDescription: document.querySelector("#worldPreviewModalDescription"),
      worldModalSections: document.querySelector("#worldPreviewModalSections"),
      worldCharacterSection: document.querySelector("#worldPreviewCharacterSection"),
      worldCharacterList: document.querySelector("#worldPreviewCharacterList")
    };

    function escapeHtml(value) {
      return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
    }

    function normalizeUrl(value) {
      const source = String(value || "").trim();
      if (!source) return "";
      try {
        const url = new URL(source, window.location.href);
        return ["http:", "https:"].includes(url.protocol) ? url.href : "";
      } catch {
        return "";
      }
    }

    function genreLabel(id) {
      return genreCatalog.get(id)?.name || id;
    }

    function charactersInWorld(worldId) {
      return (project.characters || []).filter(
        (character) => character.worldId === worldId
      );
    }

    function characterImageUrl(character, index = 0) {
      return Array.isArray(character?.images)
        ? String(character.images[index] || "")
        : "";
    }

    function worldImageUrl(world) {
      return String(world?.image || "");
    }

    function youtubeVideoId(value) {
      const source = String(value || "").trim();
      if (!source) return "";
      try {
        const url = new URL(source);
        const host = url.hostname.replace(/^www\./, "").toLowerCase();
        if (host === "youtu.be") {
          return url.pathname.split("/").filter(Boolean)[0] || "";
        }
        if (["youtube.com", "m.youtube.com", "music.youtube.com", "youtube-nocookie.com"].includes(host)) {
          if (url.pathname === "/watch") return url.searchParams.get("v") || "";
          const parts = url.pathname.split("/").filter(Boolean);
          if (["embed", "shorts", "live"].includes(parts[0])) {
            return parts[1] || "";
          }
        }
      } catch {
        return "";
      }
      return "";
    }

    function youtubeEmbedUrl(value) {
      const id = youtubeVideoId(value);
      return id
        ? `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?rel=0&modestbranding=1`
        : "";
    }

    function playableMusicTracks(owner) {
      return (owner?.music || []).filter((track) =>
        track.type === "mp3"
          ? Boolean(String(track.file || ""))
          : Boolean(youtubeVideoId(track.url))
      );
    }

    function hasPlayableMusic(owner) {
      return playableMusicTracks(owner).length > 0;
    }

    function musicTitle(track, index) {
      return String(track?.title || "").trim() ||
        `Track ${String(index + 1).padStart(2, "0")}`;
    }

    function soundtrackPlayerMarkup(track, index) {
      const title = musicTitle(track, index);
      if (track.type === "mp3") {
        return `
          <div class="soundtrack-now-playing">
            <span class="soundtrack-disc" aria-hidden="true">♫</span>
            <span><small>NOW PLAYING</small><strong>${escapeHtml(title)}</strong></span>
          </div>
          <audio
            class="soundtrack-audio"
            controls
            controlslist="nodownload noplaybackrate"
            disablepictureinpicture
            preload="metadata"
            src="${escapeHtml(track.file)}"
          ></audio>
        `;
      }
      return `
        <div class="soundtrack-now-playing">
          <span class="soundtrack-disc" aria-hidden="true">♫</span>
          <span><small>NOW PLAYING · YOUTUBE</small><strong>${escapeHtml(title)}</strong></span>
        </div>
        <div class="soundtrack-youtube">
          <iframe
            src="${escapeHtml(youtubeEmbedUrl(track.url))}"
            title="${escapeHtml(title)}"
            loading="lazy"
            allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
            referrerpolicy="strict-origin-when-cross-origin"
            allowfullscreen
          ></iframe>
        </div>
      `;
    }

    function renderSoundtrack(section, owner, activeIndex = 0) {
      const tracks = playableMusicTracks(owner);
      section.hidden = tracks.length === 0;
      if (tracks.length === 0) {
        section.innerHTML = "";
        return;
      }
      const safeIndex = Math.min(
        Math.max(Number(activeIndex) || 0, 0),
        tracks.length - 1
      );
      section.dataset.soundtrackOwner = owner.id;
      section.dataset.soundtrackActive = String(safeIndex);
      const options = tracks.map((track, index) => `
        <option value="${index}" ${index === safeIndex ? "selected" : ""}>
          ${String(index + 1).padStart(2, "0")} · ${escapeHtml(musicTitle(track, index))} · ${track.type === "mp3" ? "MP3" : "YouTube"}
        </option>
      `).join("");
      section.innerHTML = `
        <header class="soundtrack-heading">
          <span><small>SOUNDTRACK</small><strong>이 이야기의 음악</strong></span>
          <b aria-hidden="true">♫</b>
        </header>
        <div class="soundtrack-player">
          ${soundtrackPlayerMarkup(tracks[safeIndex], safeIndex)}
        </div>
        ${tracks.length > 1 ? `
          <label class="soundtrack-track-selector">
            <span>TRACK LIST</span>
            <select data-soundtrack-select>${options}</select>
          </label>
        ` : ""}
      `;
    }

    function stopSoundtrack(section) {
      const audio = section.querySelector("audio");
      if (audio) {
        audio.pause();
        audio.currentTime = 0;
      }
      const frame = section.querySelector("iframe");
      if (frame) frame.src = "about:blank";
    }

    function applyTheme() {
      const theme = String(project.site?.themeColor || "#a897ff");
      const text = String(project.site?.textColor || "#f4f1ea");
      const hex = theme.replace("#", "");
      const red = Number.parseInt(hex.slice(0, 2), 16) || 0;
      const green = Number.parseInt(hex.slice(2, 4), 16) || 0;
      const blue = Number.parseInt(hex.slice(4, 6), 16) || 0;
      const ink = (0.299 * red + 0.587 * green + 0.114 * blue) / 255 > 0.58
        ? "#15190a"
        : "#ffffff";
      const targets = [
        document.body,
        elements.previewCanvas,
        elements.filterPicker,
        elements.characterModal,
        elements.worldModal
      ];
      targets.forEach((target) => {
        if (!target) return;
        target.style.setProperty("--text", text);
        target.style.setProperty("--muted", `color-mix(in srgb, ${theme} 28%, #aaa8b4)`);
        target.style.setProperty("--theme", theme);
        target.style.setProperty("--violet", theme);
        target.style.setProperty("--accent", theme);
        target.style.setProperty("--accent-ink", ink);
        target.style.setProperty("--bg", `color-mix(in srgb, ${theme} 14%, #08080d)`);
        target.style.setProperty("--surface", `color-mix(in srgb, ${theme} 20%, #101018)`);
        target.style.setProperty("--surface-2", `color-mix(in srgb, ${theme} 27%, #151520)`);
        target.style.setProperty("--surface-3", `color-mix(in srgb, ${theme} 35%, #1b1b29)`);
        target.style.setProperty("--line", `color-mix(in srgb, ${theme} 40%, rgba(255,255,255,.08))`);
        target.style.setProperty("--line-strong", `color-mix(in srgb, ${theme} 64%, rgba(255,255,255,.14))`);
        target.style.setProperty("--shadow", `0 24px 80px color-mix(in srgb, ${theme} 30%, rgba(0,0,0,.66))`);
      });
    }

    function renderProfile() {
      const creator = project.creator || {};
      elements.previewSiteTitle.textContent = project.site?.title || "사이트 제목";
      elements.previewSiteDescription.textContent = project.site?.description || "";
      elements.previewCreatorName.textContent = creator.name || "제작자 이름";
      elements.previewCreatorHandle.textContent = creator.handle || "";
      elements.previewCreatorBio.innerHTML = (creator.bio || [])
        .map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`)
        .join("");

      const avatar = String(creator.avatar || "");
      elements.previewAvatarImage.hidden = !avatar;
      elements.previewAvatarFallback.hidden = Boolean(avatar);
      if (avatar) {
        elements.previewAvatarImage.src = avatar;
        elements.previewAvatarImage.alt = "";
      } else {
        elements.previewAvatarImage.removeAttribute("src");
        elements.previewAvatarFallback.textContent = creator.fallbackText || "✦";
      }

      const background = String(creator.background || "");
      elements.previewProfileBackgroundImage.hidden = !background;
      if (background) elements.previewProfileBackgroundImage.src = background;
      else elements.previewProfileBackgroundImage.removeAttribute("src");

      elements.previewCreatorLinks.innerHTML = (creator.links || []).map((link) => {
        const service = serviceCatalog.get(link.id) || {
          id: link.id,
          name: link.id,
          icon: ""
        };
        const href = normalizeUrl(link.url);
        if (!href) return "";
        const content = service.icon
          ? `<img src="${escapeHtml(service.icon)}" alt="${escapeHtml(service.name || link.id)}">`
          : `<span>${escapeHtml(String(service.name || link.id).slice(0, 1))}</span>`;
        return `<a class="preview-social-link" href="${escapeHtml(href)}" target="_blank" rel="noreferrer" title="${escapeHtml(service.name || link.id)}">${content}</a>`;
      }).join("");

      const genres = new Set(
        (project.characters || []).flatMap((character) => character.genres || [])
      );
      elements.previewCharacterCount.textContent = (project.characters || []).length;
      elements.previewWorldCount.textContent = (project.worlds || []).length;
      elements.previewGenreCount.textContent = genres.size;
    }

    function platformDots(character) {
      return (character.platforms || []).map((link) => {
        const platform = platformCatalog.get(link.id) || {
          id: link.id,
          name: link.id,
          icon: ""
        };
        return platform.icon
          ? `<span class="character-preview-platform-dot" title="${escapeHtml(platform.name || link.id)}"><img src="${escapeHtml(platform.icon)}" alt=""></span>`
          : `<span class="character-preview-platform-dot" title="${escapeHtml(platform.name || link.id)}">${escapeHtml(String(platform.name || link.id).slice(0, 1))}</span>`;
      }).join("");
    }

    function characterCardMarkup(character, featured = false) {
      const imageUrl = characterImageUrl(character);
      const image = imageUrl
        ? `<img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(character.name || "캐릭터")} 대표 이미지" loading="lazy">`
        : '<span class="character-preview-card-image-fallback">CHARACTER</span>';
      const genres = (character.genres || []).slice(0, 2)
        .map((id) => `<span>${escapeHtml(genreLabel(id))}</span>`)
        .join("");
      return `
        <article class="character-preview-card ${featured ? "is-featured" : ""}">
          <button type="button" class="character-preview-card-button" data-preview-character="${escapeHtml(character.id)}">
            <div class="character-preview-card-image-wrap">
              ${image}
              <div class="character-preview-card-platforms">${platformDots(character)}</div>
              ${hasPlayableMusic(character) ? '<span class="archive-music-mark" title="음악 있음" aria-hidden="true">♫</span>' : ""}
            </div>
            <div class="character-preview-card-body">
              <div class="character-preview-card-genres">${genres}</div>
              <h3>${escapeHtml(character.name || "이름 없는 캐릭터")}</h3>
              <p>${escapeHtml(character.subtitle || "")}</p>
              <span class="character-preview-card-more">상세 보기 <b aria-hidden="true">↗</b></span>
            </div>
          </button>
        </article>
      `;
    }

    function worldCardMarkup(world) {
      const related = charactersInWorld(world.id);
      const tags = (world.tags || []).slice(0, 3)
        .map((tag) => `<span>${escapeHtml(tag)}</span>`)
        .join("");
      const faces = related.slice(0, 4).map((character) => {
        const image = characterImageUrl(character);
        const face = image
          ? `<img src="${escapeHtml(image)}" alt="" loading="lazy">`
          : escapeHtml(String(character.name || "?").slice(0, 1));
        return `<span class="world-face" title="${escapeHtml(character.name || "캐릭터")}">${face}</span>`;
      }).join("");
      const cover = worldImageUrl(world)
        ? `<img src="${escapeHtml(worldImageUrl(world))}" alt="" loading="lazy">`
        : '<span class="world-card-image-fallback">WORLD ARCHIVE</span>';
      return `
        <article class="world-card">
          <button class="world-card-button" type="button" data-preview-world="${escapeHtml(world.id)}">
            <div class="world-card-image">
              ${cover}
              <div class="world-face-stack" aria-label="연결된 캐릭터">${faces}</div>
              ${hasPlayableMusic(world) ? '<span class="archive-music-mark" title="음악 있음" aria-hidden="true">♫</span>' : ""}
            </div>
            <div class="world-card-body">
              <div class="world-card-meta"><span>${related.length} Characters</span><b aria-hidden="true">↗</b></div>
              <h3>${escapeHtml(world.name || "이름 없는 세계관")}</h3>
              <p>${escapeHtml(world.subtitle || "")}</p>
              <div class="world-card-tags">${tags}</div>
            </div>
          </button>
        </article>
      `;
    }

    function renderFeatured() {
      const featured = [
        ...(project.characters || []).filter((character) => character.featured),
        ...(project.characters || []).filter((character) => !character.featured)
      ].filter((character, index, list) =>
        list.findIndex((item) => item.id === character.id) === index
      ).slice(0, 3);
      elements.previewFeaturedSection.hidden = featured.length === 0;
      elements.previewFeaturedGrid.innerHTML = featured
        .map((character) => characterCardMarkup(character, true))
        .join("");
    }

    function worldColumnCount() {
      const template = getComputedStyle(elements.previewWorldGrid).gridTemplateColumns;
      return !template || template === "none"
        ? 1
        : Math.max(1, template.split(/\s+/).filter(Boolean).length);
    }

    function updateWorldLimit() {
      const cards = [...elements.previewWorldGrid.children];
      const visibleLimit = worldColumnCount();
      const canCollapse = cards.length > visibleLimit;
      const expanded = worldExpanded || !canCollapse;
      cards.forEach((card, index) => {
        card.hidden = !expanded && index >= visibleLimit;
      });
      elements.previewWorldToggleWrap.hidden = !canCollapse;
      elements.previewWorldToggle.classList.toggle("is-expanded", expanded);
      elements.previewWorldToggle.setAttribute("aria-expanded", String(expanded));
      const label = elements.previewWorldToggle.querySelector("span");
      if (label) {
        label.textContent = expanded
          ? "세계관 접기"
          : `세계관 더보기 +${Math.max(0, cards.length - visibleLimit)}`;
      }
    }

    function renderWorlds() {
      const worlds = project.worlds || [];
      elements.previewWorldGrid.hidden = worlds.length === 0;
      elements.previewWorldEmpty.hidden = worlds.length > 0;
      elements.previewWorldGrid.innerHTML = worlds.map(worldCardMarkup).join("");
      if (worlds.length === 0) worldExpanded = false;
      updateWorldLimit();
    }

    function usageEntries(values) {
      const counts = new Map();
      values.forEach((value) => {
        const normalized = String(value || "").trim();
        if (!normalized) return;
        counts.set(normalized, (counts.get(normalized) || 0) + 1);
      });
      return [...counts.entries()].sort(
        (a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "ko")
      );
    }

    function filterOptions(group) {
      const all = {
        label: "전체",
        value: "전체",
        count: (project.characters || []).length
      };
      if (group === "genre") {
        return [all, ...usageEntries(
          (project.characters || []).flatMap((character) => character.genres || [])
        ).map(([id, count]) => ({ label: genreLabel(id), value: id, count }))];
      }
      if (group === "tag") {
        return [all, ...usageEntries(
          (project.characters || []).flatMap((character) => character.tags || [])
        ).map(([tag, count]) => ({ label: tag, value: tag, count }))];
      }
      if (group === "platform") {
        return [all, ...usageEntries(
          (project.characters || []).flatMap((character) =>
            (character.platforms || []).map((link) => link.id)
          )
        ).map(([id, count]) => ({
          label: platformCatalog.get(id)?.name || id,
          value: id,
          count
        }))];
      }
      const worldUsage = usageEntries(
        (project.characters || []).map((character) => character.worldId).filter(Boolean)
      );
      const worlds = worldUsage.map(([id, count]) => {
        const world = (project.worlds || []).find((item) => item.id === id);
        return world ? { label: world.name || "이름 없는 세계관", value: id, count } : null;
      }).filter(Boolean);
      const independentCount = (project.characters || []).filter(
        (character) => !character.worldId
      ).length;
      if (independentCount > 0) {
        worlds.push({
          label: "독립 캐릭터",
          value: "__independent__",
          count: independentCount
        });
      }
      return [all, ...worlds];
    }

    function selectedFilters(group) {
      return filterState[group];
    }

    function isSelected(group, value) {
      return value === "전체"
        ? selectedFilters(group).size === 0
        : selectedFilters(group).has(value);
    }

    function filterButton(option, group, picker = false) {
      const active = isSelected(group, option.value);
      return `
        <button
          class="filter-chip ${picker ? "filter-chip--picker" : ""} ${active ? "active" : ""}"
          type="button"
          aria-pressed="${active}"
          data-character-filter-group="${group}"
          data-character-filter-value="${escapeHtml(option.value)}"
          data-character-filter-selected="${active}"
        >
          <span>${escapeHtml(option.label)}</span>
          ${picker ? `<small>${option.count}</small>` : ""}
        </button>
      `;
    }

    function scheduleFilterFit() {
      cancelAnimationFrame(filterFitFrame);
      filterFitFrame = requestAnimationFrame(() => {
        [
          elements.previewGenreFilters,
          elements.previewTagFilters,
          elements.previewPlatformFilters,
          elements.previewWorldFilters
        ].forEach(fitFilterRow);
      });
    }

    function fitFilterRow(container) {
      if (!container) return;
      const buttons = [...container.querySelectorAll(".filter-chip")];
      const more = container.querySelector("[data-character-filter-more]");
      if (!buttons.length || !more) return;
      buttons.forEach((button) => button.hidden = false);
      more.hidden = true;
      const available = container.clientWidth;
      if (available <= 0) return;
      const style = getComputedStyle(container);
      const gap = Number.parseFloat(style.columnGap || style.gap || "0") || 0;
      const fullWidth = buttons.reduce(
        (total, button, index) => total + button.offsetWidth + (index ? gap : 0),
        0
      );
      if (fullWidth <= available + 0.5) return;
      const allButton = buttons[0];
      const selected = buttons.slice(1).filter(
        (button) => button.dataset.characterFilterSelected === "true"
      );
      const ordinary = buttons.slice(1).filter(
        (button) => button.dataset.characterFilterSelected !== "true"
      );
      more.hidden = false;
      let used = allButton.offsetWidth;
      selected.forEach((button) => used += gap + button.offsetWidth);
      let hiddenCount = 0;
      ordinary.forEach((button) => {
        const required = used + gap + button.offsetWidth + gap + more.offsetWidth;
        if (required <= available + 0.5) used += gap + button.offsetWidth;
        else {
          button.hidden = true;
          hiddenCount += 1;
        }
      });
      more.hidden = hiddenCount === 0;
      const count = more.querySelector("b");
      if (count) count.textContent = `+${hiddenCount}`;
    }

    function renderFilterRow(container, group) {
      const options = filterOptions(group);
      const all = options[0];
      const remaining = options.slice(1);
      const selected = selectedFilters(group);
      const ordered = [
        ...remaining.filter((option) => selected.has(option.value)),
        ...remaining.filter((option) => !selected.has(option.value))
      ];
      container.innerHTML = [all, ...ordered].map(
        (option) => filterButton(option, group)
      ).join("") + `
        <button class="filter-more" type="button" data-character-filter-more="${group}" aria-haspopup="dialog" hidden>
          더보기 <b>+0</b>
        </button>
      `;
    }

    function renderFilters() {
      renderFilterRow(elements.previewGenreFilters, "genre");
      renderFilterRow(elements.previewTagFilters, "tag");
      renderFilterRow(elements.previewPlatformFilters, "platform");
      renderFilterRow(elements.previewWorldFilters, "world");
      scheduleFilterFit();
    }

    function toggleFilter(group, value) {
      const selected = selectedFilters(group);
      if (!selected) return;
      if (value === "전체") selected.clear();
      else if (selected.has(value)) selected.delete(value);
      else selected.add(value);
      renderFilters();
      renderCharacters();
      if (elements.filterPicker.open) renderFilterPicker();
    }

    function hasActiveFilters() {
      return Boolean(
        filterState.query.trim() ||
        filterState.genre.size ||
        filterState.tag.size ||
        filterState.platform.size ||
        filterState.world.size
      );
    }

    function filteredCharacters() {
      const query = filterState.query.trim().toLocaleLowerCase("ko");
      return (project.characters || []).filter((character) => {
        const world = (project.worlds || []).find(
          (item) => item.id === character.worldId
        );
        const searchable = [
          character.name,
          character.subtitle,
          ...(character.description || []),
          ...(character.genres || []).map(genreLabel),
          ...(character.tags || []),
          ...(character.platforms || []).map((link) =>
            platformCatalog.get(link.id)?.name || link.id
          ),
          world?.name || "",
          world?.subtitle || "",
          ...(world?.tags || [])
        ].join(" ").toLocaleLowerCase("ko");
        const queryMatch = !query || searchable.includes(query);
        const genreMatch = !filterState.genre.size ||
          (character.genres || []).some((value) => filterState.genre.has(value));
        const tagMatch = !filterState.tag.size ||
          (character.tags || []).some((value) => filterState.tag.has(value));
        const platformMatch = !filterState.platform.size ||
          (character.platforms || []).some((link) => filterState.platform.has(link.id));
        const worldMatch = !filterState.world.size ||
          [...filterState.world].some((worldId) =>
            worldId === "__independent__" ? !character.worldId : character.worldId === worldId
          );
        return queryMatch && genreMatch && tagMatch && platformMatch && worldMatch;
      });
    }

    function characterColumnCount() {
      const template = getComputedStyle(elements.previewCharacterGrid).gridTemplateColumns;
      return !template || template === "none"
        ? 1
        : Math.max(1, template.split(/\s+/).filter(Boolean).length);
    }

    function updateCharacterLimit() {
      const cards = [...elements.previewCharacterGrid.children];
      const visibleLimit = characterColumnCount() * 2;
      const forceExpanded = hasActiveFilters();
      const canCollapse = !forceExpanded && cards.length > visibleLimit;
      const expanded = forceExpanded || characterExpanded || !canCollapse;
      cards.forEach((card, index) => {
        card.hidden = !expanded && index >= visibleLimit;
      });
      elements.previewCharacterToggleWrap.hidden = !canCollapse;
      elements.previewCharacterToggle.classList.toggle("is-expanded", expanded);
      elements.previewCharacterToggle.setAttribute("aria-expanded", String(expanded));
      const label = elements.previewCharacterToggle.querySelector("span");
      if (label) {
        label.textContent = expanded
          ? "캐릭터 접기"
          : `캐릭터 더보기 +${Math.max(0, cards.length - visibleLimit)}`;
      }
    }

    function renderCharacters() {
      const characters = filteredCharacters();
      const hasCharacters = characters.length > 0;
      elements.previewCharacterGrid.innerHTML = characters
        .map((character) => characterCardMarkup(character))
        .join("");
      elements.previewCharacterGrid.hidden = !hasCharacters;
      elements.previewCharacterEmpty.hidden = hasCharacters;
      elements.previewCharacterResultSummary.textContent =
        `총 ${(project.characters || []).length}명 중 ${characters.length}명 표시`;
      updateCharacterLimit();
    }

    function filterPickerLabel(group) {
      if (group === "genre") return "장르 선택";
      if (group === "tag") return "태그 선택";
      if (group === "platform") return "플랫폼 선택";
      return "세계관 선택";
    }

    function renderFilterPicker() {
      if (!activeFilterPickerGroup) return;
      const query = filterPickerQuery.trim().toLocaleLowerCase("ko");
      const options = filterOptions(activeFilterPickerGroup).filter(
        (option) => !query || option.label.toLocaleLowerCase("ko").includes(query)
      );
      elements.filterPickerOptions.innerHTML = options
        .map((option) => filterButton(option, activeFilterPickerGroup, true))
        .join("");
      elements.filterPickerEmpty.hidden = options.length > 0;
    }

    function openFilterPicker(group) {
      activeFilterPickerGroup = group;
      filterPickerQuery = "";
      const label = filterPickerLabel(group);
      elements.filterPickerTitle.textContent = label;
      elements.filterPickerSearch.value = "";
      elements.filterPickerSearch.placeholder = `${label.replace(" 선택", "")} 검색`;
      renderFilterPicker();
      elements.filterPicker.showModal();
      document.body.classList.add("character-filter-picker-open");
    }

    function closeFilterPicker() {
      if (elements.filterPicker.open) elements.filterPicker.close();
      activeFilterPickerGroup = null;
      filterPickerQuery = "";
      document.body.classList.remove("character-filter-picker-open");
    }

    function characterContentMarkup(item) {
      const type = item.type || (item.spoiler ? "스포일러" : "추가 정보");
      const title = item.title || "제목 없는 콘텐츠";
      const body = (item.content || []).map(
        (paragraph) => `<p>${escapeHtml(paragraph)}</p>`
      ).join("");
      if (item.spoiler) {
        return `
          <details class="character-preview-content-box is-spoiler">
            <summary>
              <span class="character-preview-content-icon">⚠</span>
              <span><small>${escapeHtml(type)}</small><strong>${escapeHtml(title)}</strong><em>${escapeHtml(item.warning || "스포일러가 포함되어 있습니다.")}</em></span>
              <b aria-hidden="true">⌄</b>
            </summary>
            <div class="character-preview-content-body">${body}</div>
          </details>
        `;
      }
      if (item.collapsible) {
        return `
          <details class="character-preview-content-box is-public is-collapsible">
            <summary><span class="character-preview-content-icon">✦</span><span><small>${escapeHtml(type)}</small><strong>${escapeHtml(title)}</strong></span><b aria-hidden="true">⌄</b></summary>
            <div class="character-preview-content-body">${body}</div>
          </details>
        `;
      }
      return `
        <article class="character-preview-content-box is-public">
          <header><span class="character-preview-content-icon">✦</span><span><small>${escapeHtml(type)}</small><strong>${escapeHtml(title)}</strong></span></header>
          <div class="character-preview-content-body">${body}</div>
        </article>
      `;
    }

    function closeCharacterModal() {
      stopSoundtrack(elements.characterSoundtrack);
      if (elements.characterModal.open) elements.characterModal.close();
      document.body.classList.remove("character-preview-modal-open");
    }

    function openCharacter(character) {
      if (!character) return;
      if (elements.worldModal.open) closeWorldModal();
      const images = (character.images || []).slice(0, 5).filter(Boolean);
      const main = images[0] || "";
      elements.characterModalTitle.textContent = character.name || "이름 없는 캐릭터";
      elements.characterModalSummary.textContent = character.subtitle || "";
      elements.characterModalSummary.hidden = !character.subtitle;
      elements.characterMainImage.hidden = !main;
      elements.characterMainImageFallback.hidden = Boolean(main);
      if (main) {
        elements.characterMainImage.src = main;
        elements.characterMainImage.alt = `${character.name || "캐릭터"} 이미지 1`;
      } else {
        elements.characterMainImage.removeAttribute("src");
      }
      elements.characterThumbnails.hidden = images.length <= 1;
      elements.characterThumbnails.innerHTML = images.length > 1
        ? images.map((url, index) => `
            <button type="button" class="character-preview-thumbnail ${index === 0 ? "is-active" : ""}" data-character-preview-image="${escapeHtml(url)}" data-character-preview-alt="${escapeHtml(`${character.name || "캐릭터"} 이미지 ${index + 1}`)}">
              <img src="${escapeHtml(url)}" alt="">
            </button>
          `).join("")
        : "";
      const genres = (character.genres || []).map(genreLabel);
      elements.characterKicker.textContent = genres.join(" · ") || "CHARACTER";
      elements.characterTags.innerHTML = [...genres, ...(character.tags || [])]
        .map((tag) => `<span>${escapeHtml(tag)}</span>`)
        .join("");
      elements.characterTags.hidden = !genres.length && !(character.tags || []).length;
      renderSoundtrack(elements.characterSoundtrack, character);
      elements.characterDescription.innerHTML = (character.description || [])
        .map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`)
        .join("");
      elements.characterDescription.hidden = !(character.description || []).length;
      elements.characterPlatforms.innerHTML = (character.platforms || []).map((link) => {
        const platform = platformCatalog.get(link.id) || {
          id: link.id,
          name: link.id,
          icon: ""
        };
        const content = platform.icon
          ? `<img src="${escapeHtml(platform.icon)}" alt=""><span class="sr-only">${escapeHtml(platform.name || link.id)}</span>`
          : `<span>${escapeHtml(String(platform.name || link.id).slice(0, 1))}</span>`;
        const href = normalizeUrl(link.url);
        return href
          ? `<a href="${escapeHtml(href)}" target="_blank" rel="noreferrer" title="${escapeHtml(platform.name || link.id)}">${content}</a>`
          : `<span class="is-disabled" title="${escapeHtml(platform.name || link.id)}">${content}</span>`;
      }).join("");
      elements.characterPlatforms.hidden = !(character.platforms || []).length;
      const world = (project.worlds || []).find((item) => item.id === character.worldId);
      elements.characterWorldPanel.hidden = !world;
      if (world) {
        elements.characterWorldButton.dataset.previewWorld = world.id;
        elements.characterWorldName.textContent = world.name || "이름 없는 세계관";
        elements.characterWorldSummary.textContent = world.subtitle || "";
      } else {
        delete elements.characterWorldButton.dataset.previewWorld;
      }
      elements.characterContentSection.hidden = !(character.contents || []).length;
      elements.characterContents.innerHTML = (character.contents || [])
        .map(characterContentMarkup)
        .join("");
      elements.characterModal.showModal();
      document.body.classList.add("character-preview-modal-open");
    }

    function worldInfoMarkup(section) {
      const title = escapeHtml(section.title || "세계관 정보");
      const content = (section.content || []).map(
        (paragraph) => `<p>${escapeHtml(paragraph)}</p>`
      ).join("");
      return section.collapsible
        ? `<details class="world-info-block world-info-block-collapsible"><summary>${title}</summary><div class="world-info-block-content">${content}</div></details>`
        : `<article class="world-info-block"><h3>${title}</h3><div>${content}</div></article>`;
    }

    function closeWorldModal() {
      stopSoundtrack(elements.worldSoundtrack);
      if (elements.worldModal.open) elements.worldModal.close();
      document.body.classList.remove("world-preview-modal-open");
    }

    function openWorld(world) {
      if (!world) return;
      if (elements.characterModal.open) closeCharacterModal();
      const image = worldImageUrl(world);
      elements.worldModalImage.hidden = !image;
      elements.worldModalImageFallback.hidden = Boolean(image);
      if (image) {
        elements.worldModalImage.src = image;
        elements.worldModalImage.alt = `${world.name || "세계관"} 대표 이미지`;
      } else {
        elements.worldModalImage.removeAttribute("src");
      }
      elements.worldModalTitle.textContent = world.name || "이름 없는 세계관";
      elements.worldModalSummary.textContent = world.subtitle || "";
      elements.worldModalSummary.hidden = !world.subtitle;
      elements.worldModalTags.innerHTML = (world.tags || [])
        .map((tag) => `<span>${escapeHtml(tag)}</span>`)
        .join("");
      elements.worldModalTags.hidden = !(world.tags || []).length;
      renderSoundtrack(elements.worldSoundtrack, world);
      elements.worldModalDescription.innerHTML = (world.description || [])
        .map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`)
        .join("");
      elements.worldModalDescription.hidden = !(world.description || []).length;
      elements.worldModalSections.innerHTML = (world.sections || [])
        .map(worldInfoMarkup)
        .join("");
      elements.worldModalSections.hidden = !(world.sections || []).length;
      const related = charactersInWorld(world.id);
      elements.worldCharacterSection.hidden = related.length === 0;
      elements.worldCharacterList.innerHTML = related.map((character) => {
        const image = characterImageUrl(character);
        const face = image
          ? `<img src="${escapeHtml(image)}" alt="">`
          : `<span class="world-character-face-fallback">${escapeHtml(String(character.name || "?").slice(0, 1))}</span>`;
        return `<button class="world-character-button" type="button" data-preview-character="${escapeHtml(character.id)}">${face}<span><strong>${escapeHtml(character.name || "이름 없는 캐릭터")}</strong><small>${escapeHtml(character.subtitle || "")}</small></span></button>`;
      }).join("");
      elements.worldModal.showModal();
      document.body.classList.add("world-preview-modal-open");
    }

    function resetFilters() {
      filterState.query = "";
      filterState.genre.clear();
      filterState.tag.clear();
      filterState.platform.clear();
      filterState.world.clear();
      elements.previewCharacterSearchInput.value = "";
      renderFilters();
      renderCharacters();
    }

    function bindEvents() {
      document.addEventListener("click", (event) => {
        const characterButton = event.target.closest("[data-preview-character]");
        if (characterButton) {
          const character = (project.characters || []).find(
            (item) => item.id === characterButton.dataset.previewCharacter
          );
          openCharacter(character);
          return;
        }
        const worldButton = event.target.closest("[data-preview-world]");
        if (worldButton) {
          const world = (project.worlds || []).find(
            (item) => item.id === worldButton.dataset.previewWorld
          );
          openWorld(world);
          return;
        }
        const thumbnail = event.target.closest("[data-character-preview-image]");
        if (thumbnail) {
          elements.characterMainImage.src = thumbnail.dataset.characterPreviewImage;
          elements.characterMainImage.alt = thumbnail.dataset.characterPreviewAlt || "";
          elements.characterThumbnails.querySelectorAll(".character-preview-thumbnail")
            .forEach((button) => button.classList.toggle("is-active", button === thumbnail));
          return;
        }
        const filterButton = event.target.closest("[data-character-filter-group]");
        if (filterButton) {
          toggleFilter(
            filterButton.dataset.characterFilterGroup,
            filterButton.dataset.characterFilterValue
          );
          return;
        }
        const more = event.target.closest("[data-character-filter-more]");
        if (more) openFilterPicker(more.dataset.characterFilterMore);
      });

      elements.previewCharacterSearchInput.addEventListener("input", (event) => {
        filterState.query = event.target.value;
        renderCharacters();
      });
      elements.previewCharacterResetFilters.addEventListener("click", resetFilters);
      elements.previewWorldToggle.addEventListener("click", () => {
        worldExpanded = !worldExpanded;
        updateWorldLimit();
      });
      elements.previewCharacterToggle.addEventListener("click", () => {
        characterExpanded = !characterExpanded;
        updateCharacterLimit();
      });
      elements.filterPickerClose.addEventListener("click", closeFilterPicker);
      elements.filterPickerSearch.addEventListener("input", (event) => {
        filterPickerQuery = event.target.value;
        renderFilterPicker();
      });
      elements.characterModalClose.addEventListener("click", closeCharacterModal);
      elements.worldModalClose.addEventListener("click", closeWorldModal);
      elements.characterSoundtrack.addEventListener("change", (event) => {
        const select = event.target.closest("[data-soundtrack-select]");
        if (!select) return;
        const character = (project.characters || []).find(
          (item) => item.id === elements.characterSoundtrack.dataset.soundtrackOwner
        );
        if (!character) return;
        stopSoundtrack(elements.characterSoundtrack);
        renderSoundtrack(elements.characterSoundtrack, character, Number(select.value));
      });
      elements.worldSoundtrack.addEventListener("change", (event) => {
        const select = event.target.closest("[data-soundtrack-select]");
        if (!select) return;
        const world = (project.worlds || []).find(
          (item) => item.id === elements.worldSoundtrack.dataset.soundtrackOwner
        );
        if (!world) return;
        stopSoundtrack(elements.worldSoundtrack);
        renderSoundtrack(elements.worldSoundtrack, world, Number(select.value));
      });
      [elements.characterSoundtrack, elements.worldSoundtrack].forEach((section) => {
        section.addEventListener("contextmenu", (event) => {
          if (event.target.closest("audio")) event.preventDefault();
        });
      });
      elements.filterPicker.addEventListener("close", () => {
        document.body.classList.remove("character-filter-picker-open");
      });
      elements.characterModal.addEventListener("close", () => {
        stopSoundtrack(elements.characterSoundtrack);
        document.body.classList.remove("character-preview-modal-open");
      });
      elements.worldModal.addEventListener("close", () => {
        stopSoundtrack(elements.worldSoundtrack);
        document.body.classList.remove("world-preview-modal-open");
      });
      window.addEventListener("resize", () => {
        updateWorldLimit();
        updateCharacterLimit();
        scheduleFilterFit();
      });
      if (typeof ResizeObserver === "function") {
        const observer = new ResizeObserver(() => scheduleFilterFit());
        [
          elements.previewGenreFilters,
          elements.previewTagFilters,
          elements.previewPlatformFilters,
          elements.previewWorldFilters
        ].forEach((item) => observer.observe(item));
      }
    }

    function init() {
      applyTheme();
      renderProfile();
      renderFeatured();
      renderWorlds();
      renderFilters();
      renderCharacters();
      bindEvents();
      requestAnimationFrame(() => {
        updateWorldLimit();
        updateCharacterLimit();
        scheduleFilterFit();
      });
    }

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", init, { once: true });
    } else {
      init();
    }
  }

  async function buildNetlifyDeployEntries(normalizedProject) {
    const deployProject = cloneJson(normalizedProject);
    const entries = [];
    const missing = [];
    let imageCount = 0;
    let audioCount = 0;

    let records = new Map();
    try {
      records = new Map(
        (await getAllImageRecords()).map((record) => [record.id, record])
      );
    } catch (error) {
      console.warn(error);
    }

    async function addPng(path, blob, label) {
      if (!blob) {
        missing.push(label);
        return "";
      }
      await validatePngFile(blob, label);
      entries.push({ name: path, data: blob });
      imageCount += 1;
      return `./${path}`;
    }

    async function addMp3(path, blob, label) {
      if (!blob) {
        missing.push(label);
        return "";
      }
      await validateMp3File(blob, label);
      entries.push({ name: path, data: blob });
      audioCount += 1;
      return `./${path}`;
    }

    const originalAvatar = normalizedProject.creator.avatar;
    if (originalAvatar) {
      const metadata = isPlainObject(originalAvatar) ? originalAvatar : null;
      const blob = await resolveDeployBlob({
        preferredBlob: creatorAvatarBlob,
        storedBlob: metadata?.id ? records.get(metadata.id)?.blob : null,
        previewUrl: creatorAvatarPreviewUrl,
        legacyUrl: typeof originalAvatar === "string"
          ? legacyImageUrl(originalAvatar)
          : "",
        label: "프로필 PNG"
      });
      deployProject.creator.avatar = await addPng(
        "assets/images/creator-avatar.png",
        blob,
        "프로필 PNG"
      );
    }

    const originalBackground = normalizedProject.creator.background;
    if (originalBackground) {
      const metadata = isPlainObject(originalBackground)
        ? originalBackground
        : null;
      const blob = await resolveDeployBlob({
        preferredBlob: creatorBackgroundBlob,
        storedBlob: metadata?.id ? records.get(metadata.id)?.blob : null,
        previewUrl: creatorBackgroundPreviewUrl,
        legacyUrl: typeof originalBackground === "string"
          ? legacyImageUrl(originalBackground)
          : "",
        label: "프로필 배경 PNG"
      });
      deployProject.creator.background = await addPng(
        "assets/images/creator-background.png",
        blob,
        "프로필 배경 PNG"
      );
    }

    for (let worldIndex = 0; worldIndex < normalizedProject.worlds.length; worldIndex += 1) {
      const originalWorld = normalizedProject.worlds[worldIndex];
      const deployWorld = deployProject.worlds[worldIndex];
      if (originalWorld.image) {
        const metadata = isPlainObject(originalWorld.image)
          ? originalWorld.image
          : null;
        const key = safeDeployAssetSegment(originalWorld.id, `world-${worldIndex + 1}`);
        const blob = await resolveDeployBlob({
          preferredBlob: worldImageBlobs.get(originalWorld.id),
          storedBlob: metadata?.id ? records.get(metadata.id)?.blob : null,
          previewUrl: worldImagePreviewUrls.get(originalWorld.id) || "",
          legacyUrl: typeof originalWorld.image === "string"
            ? legacyImageUrl(originalWorld.image)
            : "",
          label: `세계관 “${originalWorld.name || worldIndex + 1}” PNG`
        });
        deployWorld.image = await addPng(
          `assets/images/world-${key}.png`,
          blob,
          `세계관 “${originalWorld.name || worldIndex + 1}” PNG`
        );
      }
    }

    for (let characterIndex = 0; characterIndex < normalizedProject.characters.length; characterIndex += 1) {
      const originalCharacter = normalizedProject.characters[characterIndex];
      const deployCharacter = deployProject.characters[characterIndex];
      const characterKey = safeDeployAssetSegment(
        originalCharacter.id,
        `character-${characterIndex + 1}`
      );
      deployCharacter.images = [];

      for (let imageIndex = 0; imageIndex < (originalCharacter.images || []).length; imageIndex += 1) {
        const originalImage = originalCharacter.images[imageIndex];
        const metadata = isPlainObject(originalImage) ? originalImage : null;
        const blob = await resolveDeployBlob({
          preferredBlob: metadata?.id
            ? characterImageBlobs.get(metadata.id)
            : null,
          storedBlob: metadata?.id ? records.get(metadata.id)?.blob : null,
          previewUrl: metadata?.id
            ? characterImagePreviewUrls.get(metadata.id) || ""
            : "",
          legacyUrl: typeof originalImage === "string"
            ? legacyImageUrl(originalImage)
            : "",
          label: `캐릭터 “${originalCharacter.name || characterIndex + 1}” 이미지 ${imageIndex + 1}`
        });
        const path = await addPng(
          `assets/images/character-${characterKey}-${imageIndex + 1}.png`,
          blob,
          `캐릭터 “${originalCharacter.name || characterIndex + 1}” 이미지 ${imageIndex + 1}`
        );
        if (path) deployCharacter.images.push(path);
      }

      for (let trackIndex = 0; trackIndex < (originalCharacter.music || []).length; trackIndex += 1) {
        const originalTrack = originalCharacter.music[trackIndex];
        const deployTrack = deployCharacter.music[trackIndex];
        if (originalTrack.type !== "mp3" || !originalTrack.file) continue;
        const metadata = isPlainObject(originalTrack.file)
          ? originalTrack.file
          : null;
        const trackKey = safeDeployAssetSegment(
          originalTrack.id,
          `track-${trackIndex + 1}`
        );
        const blob = await resolveDeployBlob({
          preferredBlob: metadata?.id ? musicBlobs.get(metadata.id) : null,
          storedBlob: metadata?.id ? records.get(metadata.id)?.blob : null,
          previewUrl: metadata?.id ? musicPreviewUrls.get(metadata.id) || "" : "",
          legacyUrl: typeof originalTrack.file === "string"
            ? legacyImageUrl(originalTrack.file)
            : "",
          label: `캐릭터 “${originalCharacter.name || characterIndex + 1}” MP3 ${trackIndex + 1}`
        });
        deployTrack.file = await addMp3(
          `assets/audio/character-${characterKey}-${trackKey}.mp3`,
          blob,
          `캐릭터 “${originalCharacter.name || characterIndex + 1}” MP3 ${trackIndex + 1}`
        );
      }
    }

    for (let worldIndex = 0; worldIndex < normalizedProject.worlds.length; worldIndex += 1) {
      const originalWorld = normalizedProject.worlds[worldIndex];
      const deployWorld = deployProject.worlds[worldIndex];
      const worldKey = safeDeployAssetSegment(originalWorld.id, `world-${worldIndex + 1}`);

      for (let trackIndex = 0; trackIndex < (originalWorld.music || []).length; trackIndex += 1) {
        const originalTrack = originalWorld.music[trackIndex];
        const deployTrack = deployWorld.music[trackIndex];
        if (originalTrack.type !== "mp3" || !originalTrack.file) continue;
        const metadata = isPlainObject(originalTrack.file)
          ? originalTrack.file
          : null;
        const trackKey = safeDeployAssetSegment(
          originalTrack.id,
          `track-${trackIndex + 1}`
        );
        const blob = await resolveDeployBlob({
          preferredBlob: metadata?.id ? musicBlobs.get(metadata.id) : null,
          storedBlob: metadata?.id ? records.get(metadata.id)?.blob : null,
          previewUrl: metadata?.id ? musicPreviewUrls.get(metadata.id) || "" : "",
          legacyUrl: typeof originalTrack.file === "string"
            ? legacyImageUrl(originalTrack.file)
            : "",
          label: `세계관 “${originalWorld.name || worldIndex + 1}” MP3 ${trackIndex + 1}`
        });
        deployTrack.file = await addMp3(
          `assets/audio/world-${worldKey}-${trackKey}.mp3`,
          blob,
          `세계관 “${originalWorld.name || worldIndex + 1}” MP3 ${trackIndex + 1}`
        );
      }
    }

    if (missing.length > 0) {
      throw new Error(
        `배포 ZIP에 넣을 실제 파일 ${missing.length}개를 읽지 못했습니다. 편집 화면에서 해당 파일을 다시 선택해 주세요.\n\n${missing.join("\n")}`
      );
    }

    const usedServiceIds = new Set(
      (deployProject.creator.links || []).map((link) => link.id)
    );
    const usedPlatformIds = new Set(
      deployProject.characters.flatMap((character) =>
        (character.platforms || []).map((link) => link.id)
      )
    );
    const deployCatalog = {
      profileLinkServices: cloneJson(services).filter((item) =>
        usedServiceIds.has(item.id)
      ),
      platforms: cloneJson(platformOptions).filter((item) =>
        usedPlatformIds.has(item.id)
      ),
      genres: cloneJson(genreOptions)
    };
    const catalogAssetPaths = new Set();

    async function packageCatalogIcons(items, sourceBuilder) {
      for (const item of items) {
        if (!item.icon) continue;
        const destination = `assets/catalog/${item.icon}`;
        if (!catalogAssetPaths.has(destination)) {
          try {
            const blob = await fetchDeployBlob(
              new URL(sourceBuilder(item), window.location.href).href,
              `${item.name || item.id} 아이콘`
            );
            entries.push({ name: destination, data: blob });
            catalogAssetPaths.add(destination);
          } catch (error) {
            console.warn(error);
            item.icon = "";
            continue;
          }
        }
        item.icon = `./${destination}`;
      }
    }

    await packageCatalogIcons(
      deployCatalog.profileLinkServices,
      serviceIconUrl
    );
    await packageCatalogIcons(
      deployCatalog.platforms,
      platformIconUrl
    );

    const css = await readGeneratorStylesheetText();
    const exportCss = `${css}\n\n/* Netlify exported portfolio shell */\n:root{--preview-panel-width:1200px;}\nbody.exported-portfolio-site{min-width:320px;}\n.exported-site-shell{width:min(calc(100% - 24px),1200px);margin:0 auto;padding:24px 0 64px;}\n.exported-site-shell .preview-canvas{width:100%;max-width:none;margin:0;}\n@media(max-width:620px){.exported-site-shell{width:min(calc(100% - 16px),1200px);padding-top:8px;}}\n`;
    const dataSource = [
      `window.PORTFOLIO_PROJECT = ${JSON.stringify(deployProject, null, 2)};`,
      `window.PORTFOLIO_CATALOG = ${JSON.stringify(deployCatalog, null, 2)};`
    ].join("\n\n");
    const runtimeSource = `(${netlifyPortfolioRuntime.toString()})();\n`;
    const html = buildNetlifyDeployHtml();

    entries.unshift(
      {
        name: "index.html",
        data: new TextEncoder().encode(html)
      },
      {
        name: "assets/site.css",
        data: new TextEncoder().encode(exportCss)
      },
      {
        name: "assets/site-data.js",
        data: new TextEncoder().encode(dataSource)
      },
      {
        name: "assets/site.js",
        data: new TextEncoder().encode(runtimeSource)
      }
    );

    return { entries, imageCount, audioCount };
  }


  function projectImageMetadata() {
    const items = [];
    const avatar = getAvatarMetadata();
    if (avatar) items.push({ ...avatar, role: "creator-avatar", ownerId: "creator" });
    const creatorBackground = getCreatorBackgroundMetadata();
    if (creatorBackground) {
      items.push({
        ...creatorBackground,
        role: "creator-background",
        ownerId: "creator"
      });
    }

    project.worlds.forEach((world) => {
      const image = getWorldImageMetadata(world);
      if (image) items.push({ ...image, role: "world-cover", ownerId: world.id });
    });

    project.characters.forEach((character) => {
      (character.images || []).forEach((image) => {
        const metadata = getCharacterImageMetadata(image);
        if (metadata) items.push({ ...metadata, role: "character-image", ownerId: character.id });
      });
    });
    return items;
  }

  function projectAudioMetadata() {
    const items = [];

    project.worlds.forEach((world) => {
      (world.music || []).forEach((track) => {
        const file = getMusicFileMetadata(track);
        if (file) {
          items.push({
            ...file,
            role: "world-music",
            ownerId: world.id,
            trackId: track.id
          });
        }
      });
    });

    project.characters.forEach((character) => {
      (character.music || []).forEach((track) => {
        const file = getMusicFileMetadata(track);
        if (file) {
          items.push({
            ...file,
            role: "character-music",
            ownerId: character.id,
            trackId: track.id
          });
        }
      });
    });

    return items;
  }

  function downloadTextBackup() {
    window.clearTimeout(autosaveTimer);
    autosaveTimer = 0;
    try {
      const normalizedProject = normalizeProject(project);
      const blob = new Blob(
        [JSON.stringify(normalizedProject, null, 2)],
        { type: "application/json;charset=utf-8" }
      );
      downloadBlob(blob, `${buildBackupBaseName()}.json`);
      saveProjectToStorage();
      setSaveStatus("텍스트 백업 JSON 저장됨");
      elements.backupMenu.open = false;
    } catch (error) {
      console.error(error);
      window.alert(error.message || "텍스트 백업을 저장하지 못했습니다.");
      setSaveStatus("텍스트 백업 실패");
    }
  }


  async function resolveEditorBackupImageBlob(image, records) {
    const storedBlob = records.get(image.id)?.blob || null;
    let preferredBlob = null;
    let previewUrl = "";
    let legacyUrl = "";

    if (image.role === "creator-avatar") {
      preferredBlob = creatorAvatarBlob;
      previewUrl = creatorAvatarPreviewUrl;
      if (typeof project.creator.avatar === "string") {
        legacyUrl = legacyImageUrl(project.creator.avatar);
      }
    } else if (image.role === "creator-background") {
      preferredBlob = creatorBackgroundBlob;
      previewUrl = creatorBackgroundPreviewUrl;
      if (typeof project.creator.background === "string") {
        legacyUrl = legacyImageUrl(project.creator.background);
      }
    } else if (image.role === "world-cover") {
      const world = project.worlds.find(
        (item) => item.id === image.ownerId
      );
      preferredBlob = worldImageBlobs.get(image.ownerId) || null;
      previewUrl = worldImagePreviewUrls.get(image.ownerId) || "";
      if (world && typeof world.image === "string") {
        legacyUrl = legacyImageUrl(world.image);
      }
    } else if (image.role === "character-image") {
      preferredBlob = characterImageBlobs.get(image.id) || null;
      previewUrl = characterImagePreviewUrls.get(image.id) || "";
    }

    const blob = await resolveDeployBlob({
      preferredBlob,
      storedBlob,
      previewUrl,
      legacyUrl,
      label: image.name || "PNG"
    });

    if (!blob) return null;
    await validatePngFile(blob, image.name || "백업 PNG");
    return blob.type === "image/png"
      ? blob
      : new Blob([await blob.arrayBuffer()], { type: "image/png" });
  }

  async function resolveEditorBackupAudioBlob(audio, records) {
    const blob = await resolveDeployBlob({
      preferredBlob: musicBlobs.get(audio.id) || null,
      storedBlob: records.get(audio.id)?.blob || null,
      previewUrl: musicPreviewUrls.get(audio.id) || "",
      label: audio.name || "MP3"
    });

    if (!blob) return null;
    await validateMp3File(blob, audio.name || "백업 MP3");
    return ["audio/mpeg", "audio/mp3"].includes(blob.type)
      ? blob
      : new Blob([await blob.arrayBuffer()], { type: MP3_MIME_TYPE });
  }

  async function downloadEditorBackup() {
    window.clearTimeout(autosaveTimer);
    autosaveTimer = 0;
    elements.downloadEditorBackupButton.disabled = true;
    setSaveStatus("편집용 전체 백업 ZIP 생성 중…");

    try {
      const normalizedProject = normalizeProject(project);
      const imageMetadata = projectImageMetadata();
      const audioMetadata = projectAudioMetadata();
      let storedRecords = [];

      try {
        storedRecords = await getAllImageRecords();
      } catch (error) {
        console.warn(
          "브라우저 저장소 전체 목록을 읽지 못해 현재 편집 파일을 우선 사용합니다.",
          error
        );
      }

      const records = new Map(
        storedRecords.map((record) => [record.id, record])
      );
      const entries = [
        {
          name: "project.json",
          data: new Blob(
            [JSON.stringify(normalizedProject, null, 2)],
            { type: "application/json;charset=utf-8" }
          )
        }
      ];
      const manifestImages = [];
      const manifestAudio = [];
      const missing = [];

      for (const image of imageMetadata) {
        const blob = await resolveEditorBackupImageBlob(image, records);
        if (!blob) {
          missing.push(image.name || image.id);
          continue;
        }
        const path = `images/${image.id}.png`;
        entries.push({ name: path, data: blob });
        manifestImages.push({
          id: image.id,
          path,
          role: image.role,
          ownerId: image.ownerId,
          name: image.name,
          type: "image/png",
          size: blob.size,
          width: Number(image.width) || 0,
          height: Number(image.height) || 0,
          updatedAt: image.updatedAt || ""
        });
      }

      for (const audio of audioMetadata) {
        const blob = await resolveEditorBackupAudioBlob(audio, records);
        if (!blob) {
          missing.push(audio.name || audio.id);
          continue;
        }
        const path = `audio/${audio.id}.mp3`;
        entries.push({ name: path, data: blob });
        manifestAudio.push({
          id: audio.id,
          path,
          role: audio.role,
          ownerId: audio.ownerId,
          trackId: audio.trackId,
          name: audio.name,
          type: MP3_MIME_TYPE,
          size: blob.size,
          duration: Number(audio.duration) || 0,
          updatedAt: audio.updatedAt || ""
        });
      }

      if (missing.length > 0) {
        throw new Error(
          `편집용 백업에 넣을 수 없는 파일이 있습니다: ${missing.join(", ")}`
        );
      }

      const manifest = {
        format: FULL_BACKUP_FORMAT,
        version: FULL_BACKUP_VERSION,
        projectVersion: normalizedProject.version,
        createdAt: new Date().toISOString(),
        images: manifestImages,
        audio: manifestAudio
      };

      entries.push({
        name: "backup-manifest.json",
        data: new Blob(
          [JSON.stringify(manifest, null, 2)],
          { type: "application/json;charset=utf-8" }
        )
      });

      const zip = await createStoredZip(entries);
      downloadBlob(zip, `${buildBackupBaseName()}-editor-backup.zip`);
      saveProjectToStorage();
      setSaveStatus(
        `편집용 전체 백업 저장됨 · PNG ${manifestImages.length}개 · MP3 ${manifestAudio.length}개`
      );
      elements.backupMenu.open = false;
    } catch (error) {
      console.error(error);
      window.alert(
        error.message || "편집용 전체 백업 ZIP을 저장하지 못했습니다."
      );
      setSaveStatus("편집용 전체 백업 ZIP 생성 실패");
    } finally {
      elements.downloadEditorBackupButton.disabled = false;
    }
  }

  async function downloadFullBackup() {
    window.clearTimeout(autosaveTimer);
    autosaveTimer = 0;
    elements.downloadFullBackupButton.disabled = true;
    setSaveStatus("Netlify 배포 ZIP 생성 중…");

    try {
      const normalizedProject = normalizeProject(project);
      const { entries, imageCount, audioCount } =
        await buildNetlifyDeployEntries(normalizedProject);
      const zip = await createStoredZip(entries);
      downloadBlob(zip, `${buildBackupBaseName()}-netlify.zip`);
      saveProjectToStorage();
      setSaveStatus(
        `Netlify 배포 ZIP 저장됨 · PNG ${imageCount}개 · MP3 ${audioCount}개`
      );
      elements.backupMenu.open = false;
    } catch (error) {
      console.error(error);
      window.alert(
        error.message || "Netlify 배포 ZIP을 저장하지 못했습니다."
      );
      setSaveStatus("Netlify 배포 ZIP 생성 실패");
    } finally {
      elements.downloadFullBackupButton.disabled = false;
    }
  }

  async function importJsonBackup(file) {
    const text = await file.text();
    const nextProject = normalizeProject(JSON.parse(text));
    const confirmed = window.confirm(
      "현재 입력 내용을 불러온 텍스트 프로젝트로 교체할까요? PNG·MP3는 현재 브라우저 저장소에 같은 ID가 있을 때만 연결됩니다."
    );
    if (!confirmed) return;

    const restoredAvatar = await replaceCurrentProject(nextProject);
    saveProjectToStorage();
    const missingWorldCount = missingWorldImageIds.size;
    const missingCharacterCount = missingCharacterImageIds.size;
    const missingMusicCount = missingMusicIds.size;

    if (
      (getAvatarMetadata() && !restoredAvatar) ||
      creatorBackgroundRestoreMissing ||
      missingWorldCount > 0 ||
      missingCharacterCount > 0 ||
      missingMusicCount > 0
    ) {
      const missingImages = [];
      if (getAvatarMetadata() && !restoredAvatar) missingImages.push("프로필 PNG");
      if (creatorBackgroundRestoreMissing) missingImages.push("프로필 배경 PNG");
      if (missingWorldCount > 0) missingImages.push(`세계관 PNG ${missingWorldCount}개`);
      if (missingCharacterCount > 0) missingImages.push(`캐릭터 PNG ${missingCharacterCount}개`);
      if (missingMusicCount > 0) missingImages.push(`MP3 ${missingMusicCount}개`);
      setSaveStatus(`텍스트 프로젝트 불러옴 · ${missingImages.join(" · ")}를 다시 선택해 주세요`);
    } else {
      setSaveStatus("텍스트 프로젝트 불러오기 완료");
    }
  }

  async function importFullBackup(file) {
    const entries = await readZipEntries(file);
    const projectBytes = entries.get("project.json");
    const manifestBytes = entries.get("backup-manifest.json");
    if (!projectBytes || !manifestBytes) {
      throw new Error("생성기에서 만든 전체 백업 ZIP이 아닙니다.");
    }

    const decoder = new TextDecoder("utf-8");
    const nextProject = normalizeProject(
      JSON.parse(decoder.decode(projectBytes))
    );
    const manifest = JSON.parse(decoder.decode(manifestBytes));
    if (
      manifest.format !== FULL_BACKUP_FORMAT ||
      Number(manifest.version) !== FULL_BACKUP_VERSION ||
      !Array.isArray(manifest.images) ||
      (manifest.audio !== undefined && !Array.isArray(manifest.audio))
    ) {
      throw new Error("지원하지 않는 전체 백업 형식입니다.");
    }

    if (Number(manifest.projectVersion) !== CURRENT_PROJECT_VERSION) {
      throw new Error("현재 생성기에서 지원하지 않는 프로젝트 버전입니다.");
    }

    const restoredRecords = [];
    for (const image of manifest.images) {
      const data = entries.get(image.path);
      if (!data) throw new Error(`백업 이미지가 없습니다: ${image.path}`);
      const blob = new Blob([data], { type: "image/png" });
      await validatePngFile(blob, image.name || "백업 PNG");
      restoredRecords.push({
        id: image.id,
        role: image.role,
        ownerId: image.ownerId,
        name: image.name || `${image.id}.png`,
        type: "image/png",
        size: blob.size,
        width: Number(image.width) || 0,
        height: Number(image.height) || 0,
        updatedAt: image.updatedAt || new Date().toISOString(),
        blob
      });
    }

    const manifestAudio = Array.isArray(manifest.audio)
      ? manifest.audio
      : [];

    for (const audio of manifestAudio) {
      const data = entries.get(audio.path);
      if (!data) throw new Error(`백업 MP3가 없습니다: ${audio.path}`);
      const blob = new Blob([data], { type: MP3_MIME_TYPE });
      await validateMp3File(blob, audio.name || "백업 MP3");
      restoredRecords.push({
        id: audio.id,
        role: audio.role,
        ownerId: audio.ownerId,
        trackId: audio.trackId,
        name: audio.name || `${audio.id}.mp3`,
        type: MP3_MIME_TYPE,
        size: blob.size,
        duration: Number(audio.duration) || 0,
        updatedAt: audio.updatedAt || new Date().toISOString(),
        blob
      });
    }

    const confirmed = window.confirm(
      `현재 프로젝트를 전체 백업으로 교체할까요? PNG ${manifest.images.length}개와 MP3 ${manifestAudio.length}개가 함께 복구됩니다.`
    );
    if (!confirmed) return;

    await replaceAllImageRecords(restoredRecords);
    clearStoredProject();
    releaseAvatarObjectUrl();
    releaseCreatorBackgroundObjectUrl();
    releaseAllWorldImageObjectUrls();
    releaseAllCharacterImageObjectUrls();
    releaseAllMusicObjectUrls();
    await replaceCurrentProject(nextProject, true);
    saveProjectToStorage();
    setSaveStatus(
      `전체 백업 불러오기 완료 · PNG ${manifest.images.length}개 · MP3 ${manifestAudio.length}개`
    );
  }

  async function importProjectFile() {
    const file = elements.importProjectInput.files?.[0] || null;
    elements.importProjectInput.value = "";
    if (!file) return;

    try {
      const lowerName = file.name.toLowerCase();
      if (lowerName.endsWith(".zip") || file.type === "application/zip") {
        await importFullBackup(file);
      } else {
        await importJsonBackup(file);
      }
    } catch (error) {
      console.error(error);
      window.alert(error.message || "프로젝트를 불러오지 못했습니다.");
      setSaveStatus("프로젝트 불러오기 실패");
    }
  }

  async function resetProject() {
    const confirmed = window.confirm(
      "현재 입력한 제작자 프로필과 세계관, 캐릭터, 자동 저장 데이터와 저장된 PNG·MP3를 모두 초기화할까요?"
    );

    if (!confirmed) return;

    clearStoredProject();
    releaseAvatarObjectUrl();
    releaseCreatorBackgroundObjectUrl();
    releaseAllWorldImageObjectUrls();
    releaseAllCharacterImageObjectUrls();
    releaseAllMusicObjectUrls();
    avatarRestoreMissing = false;
    creatorBackgroundRestoreMissing = false;

    try {
      await clearImageRecords();
    } catch (error) {
      console.error(error);
      window.alert(
        "입력은 초기화하지만 브라우저의 저장 PNG·MP3 일부를 정리하지 못했습니다."
      );
    }

    await replaceCurrentProject(createEmptyProject(), false);
    setSaveStatus("입력, 자동 저장 데이터와 PNG·MP3가 초기화됨");
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
    if (target.matches("[data-music-field]")) {
      updateMusicFromInput("character", target);
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
  elements.addCharacterMusicButton.addEventListener(
    "click",
    () => addMusicTrack("character")
  );

  elements.characterMusicList.addEventListener("change", (event) => {
    const input = event.target.closest("[data-music-file]");
    if (!input) return;
    handleMusicFileSelection("character", input);
  });

  elements.characterMusicList.addEventListener("click", (event) => {
    const button = event.target.closest(
      "[data-delete-music], [data-move-music], [data-remove-music-file]"
    );
    if (!button) return;
    handleMusicAction("character", button);
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

  elements.previewCharacterSection.addEventListener(
    "click",
    (event) => {
      const moreButton = event.target.closest(
        "[data-character-filter-more]"
      );

      if (moreButton) {
        openCharacterPreviewFilterPicker(
          moreButton.dataset.characterFilterMore
        );
        return;
      }

      const filterButton = event.target.closest(
        "[data-character-filter-group]"
      );

      if (!filterButton) return;

      toggleCharacterPreviewFilter(
        filterButton.dataset.characterFilterGroup,
        filterButton.dataset.characterFilterValue
      );
      renderCharacterPreview();
    }
  );

  elements.previewCharacterFilterPickerOptions.addEventListener(
    "click",
    (event) => {
      const filterButton = event.target.closest(
        "[data-character-filter-group]"
      );

      if (!filterButton) return;

      toggleCharacterPreviewFilter(
        filterButton.dataset.characterFilterGroup,
        filterButton.dataset.characterFilterValue
      );
      renderCharacterPreview();
      renderCharacterPreviewFilterPicker();
    }
  );

  elements.previewCharacterSearchInput.addEventListener(
    "input",
    (event) => {
      characterPreviewFilterState.query = event.target.value;
      renderCharacterPreview();
    }
  );

  elements.previewCharacterResetFilters.addEventListener(
    "click",
    resetCharacterPreviewFilters
  );

  elements.previewCharacterFilterPickerSearch.addEventListener(
    "input",
    (event) => {
      characterFilterPickerQuery = event.target.value;
      renderCharacterPreviewFilterPicker();
    }
  );

  elements.previewCharacterFilterPickerClose.addEventListener(
    "click",
    closeCharacterPreviewFilterPicker
  );

  elements.previewCharacterFilterPicker.addEventListener(
    "click",
    (event) => {
      if (event.target === elements.previewCharacterFilterPicker) {
        closeCharacterPreviewFilterPicker();
      }
    }
  );

  elements.previewCharacterFilterPicker.addEventListener(
    "close",
    () => {
      activeCharacterFilterPickerGroup = null;
      characterFilterPickerQuery = "";
      document.body.classList.remove(
        "character-filter-picker-open"
      );
    }
  );

  elements.previewCharacterToggle.addEventListener("click", () => {
    characterPreviewExpanded = !characterPreviewExpanded;
    updateCharacterPreviewLimit();
  });

elements.characterPreviewSoundtrack.addEventListener(
  "change",
  (event) => {
    const select = event.target.closest("[data-soundtrack-select]");
    if (!select) return;

    const character = project.characters.find(
      (item) =>
        item.id ===
        elements.characterPreviewSoundtrack.dataset.soundtrackOwner
    );

    if (!character) return;

    activateSoundtrackTrack(
      elements.characterPreviewSoundtrack,
      character,
      Number(select.value)
    );
  }
);
elements.worldPreviewSoundtrack.addEventListener(
  "change",
  (event) => {
    const select = event.target.closest("[data-soundtrack-select]");
    if (!select) return;

    const world = project.worlds.find(
      (item) =>
        item.id ===
        elements.worldPreviewSoundtrack.dataset.soundtrackOwner
    );

    if (!world) return;

    activateSoundtrackTrack(
      elements.worldPreviewSoundtrack,
      world,
      Number(select.value)
    );
  }
);
  for (const soundtrack of [
    elements.characterPreviewSoundtrack,
    elements.worldPreviewSoundtrack
  ]) {
    soundtrack.addEventListener("contextmenu", (event) => {
      if (event.target.closest("audio")) event.preventDefault();
    });
  }

  elements.characterPreviewModalClose.addEventListener("click", closeCharacterPreview);
  elements.characterPreviewModal.addEventListener("click", (event) => {
    if (event.target === elements.characterPreviewModal) closeCharacterPreview();
  });
  elements.characterPreviewModal.addEventListener("close", () => {
    stopSoundtrack(elements.characterPreviewSoundtrack);
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
    if (event.target.matches("[data-music-field]")) {
      updateMusicFromInput("world", event.target);
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

  elements.addWorldMusicButton.addEventListener(
    "click",
    () => addMusicTrack("world")
  );

  elements.worldMusicList.addEventListener("change", (event) => {
    const input = event.target.closest("[data-music-file]");
    if (!input) return;
    handleMusicFileSelection("world", input);
  });

  elements.worldMusicList.addEventListener("click", (event) => {
    const button = event.target.closest(
      "[data-delete-music], [data-move-music], [data-remove-music-file]"
    );
    if (!button) return;
    handleMusicAction("world", button);
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
    stopSoundtrack(elements.worldPreviewSoundtrack);
    document.body.classList.remove("world-preview-modal-open");
  });

  elements.profileForm.addEventListener("input", (event) => {
    if (
      event.target === elements.avatarInput ||
      event.target === elements.profileBackgroundInput
    ) return;
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

  elements.profileBackgroundInput.addEventListener(
    "change",
    handleCreatorBackgroundSelection
  );

  elements.removeProfileBackgroundButton.addEventListener(
    "click",
    removeCreatorBackground
  );
function openNetlifyGuide() {
  if (!elements.netlifyGuideDialog.open) {
    elements.netlifyGuideDialog.showModal();
  }
}

function closeNetlifyGuide() {
  if (elements.netlifyGuideDialog.open) {
    elements.netlifyGuideDialog.close();
  }
}

elements.netlifyGuideButton.addEventListener(
  "click",
  openNetlifyGuide
);

elements.netlifyGuideClose.addEventListener(
  "click",
  closeNetlifyGuide
);

elements.netlifyGuideDialog.addEventListener(
  "click",
  (event) => {
    if (event.target === elements.netlifyGuideDialog) {
      closeNetlifyGuide();
    }
  }
);
  elements.downloadTextBackupButton.addEventListener(
    "click",
    downloadTextBackup
  );

  elements.downloadEditorBackupButton.addEventListener(
    "click",
    downloadEditorBackup
  );

  elements.downloadFullBackupButton.addEventListener(
    "click",
    downloadFullBackup
  );

  elements.importProjectInput.addEventListener(
    "change",
    importProjectFile
  );

  elements.previewWidthInput.addEventListener("input", (event) => {
    applyPreviewWidth(event.target.value);
  });

  window.addEventListener(
    "resize",
    scheduleCharacterPreviewFilterFit
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
    releaseCreatorBackgroundObjectUrl();
    releaseAllWorldImageObjectUrls();
    releaseAllCharacterImageObjectUrls();
    releaseAllMusicObjectUrls();
  });

  async function initialize() {
    restorePreviewWidth();
    initializeImageDropZones();
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
    const creatorBackgroundMetadata = getCreatorBackgroundMetadata();
    const restoredCreatorBackground = creatorBackgroundMetadata
      ? await restoreCreatorBackgroundFromDatabase()
      : false;
    const missingWorldCount = await restoreWorldImagesFromDatabase();
    const missingCharacterCount = await restoreCharacterImagesFromDatabase();
    const missingMusicCount = await restoreMusicFromDatabase();

    if (autosaveRestoreError) {
      setSaveStatus("자동 저장 복구 실패");
      window.setTimeout(() => {
        window.alert(autosaveRestoreError);
      }, 0);
      return;
    }

    if (
      (avatarMetadata && !restoredAvatar) ||
      (creatorBackgroundMetadata && !restoredCreatorBackground) ||
      missingWorldCount > 0 ||
      missingCharacterCount > 0 ||
      missingMusicCount > 0
    ) {
      const messages = [];
      if (avatarMetadata && !restoredAvatar) messages.push("프로필 PNG");
      if (creatorBackgroundMetadata && !restoredCreatorBackground) {
        messages.push("프로필 배경 PNG");
      }
      if (missingWorldCount > 0) messages.push(`세계관 PNG ${missingWorldCount}개`);
      if (missingCharacterCount > 0) messages.push(`캐릭터 PNG ${missingCharacterCount}개`);
      if (missingMusicCount > 0) messages.push(`MP3 ${missingMusicCount}개`);
      setSaveStatus(
        `${restoredAutosave ? "이전 자동 저장 복구됨 · " : ""}${messages.join(" · ")}를 다시 선택해 주세요`
      );
      return;
    }

    if (restoredAutosave && project.worlds.length > 0) {
      setSaveStatus("자동저장된 세계관 데이터를 복구함");
    } else if (
      restoredAutosave &&
      (restoredAvatar || restoredCreatorBackground)
    ) {
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
