(() => {
  "use strict";

  function deepFreeze(value) {
    if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
    Object.freeze(value);
    Object.values(value).forEach(deepFreeze);
    return value;
  }

  window.ADMIN_CATALOG = deepFreeze({
    profileLinkServices: [
      {
        id: "twitter",
        name: "X / Twitter",
        icon: "profile-links/twitter.png"
      },
      {
        id: "instagram",
        name: "Instagram",
        icon: "profile-links/instagram.png"
      },
      {
        id: "notice",
        name: "공지 채널",
        icon: "profile-links/notice.png"
      }
    ],

    platforms: [
      {
        id: "bloom",
        name: "블룸",
        icon: "platforms/bloom.png"
      },
      {
        id: "caveduck",
        name: "케이브덕",
        icon: "platforms/caveduck.png"
      },
      {
        id: "rofan",
        name: "로판",
        icon: "platforms/rofan.png"
      },
      {
        id: "tingle",
        name: "팅글",
        icon: "platforms/tingle.png"
      }
    ],

    genres: [
      "판타지",
      "현대",
      "로맨스",
      "미스터리",
      "SF",
      "드라마",
      "고딕",
      "코미디",
      "정치극"
    ]
  });
})();
