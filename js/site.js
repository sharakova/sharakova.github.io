// アイコンスプライトは各 HTML の <body> 先頭に直接埋め込んでいる。
// （以前は assets/icons.svg を fetch していたが、キャッシュが残ると
//   アイコンが消える・追加したアイコンが反映されない問題があったため）
// スプライトを変更するときは assets/icons.svg を編集し、
// tools/sync-sprite.py で全 HTML に反映する。
(() => {
  const root = document.documentElement;

  const applyTheme = (theme) => {
    if (theme === "light" || theme === "dark") {
      root.dataset.theme = theme;
    } else {
      delete root.dataset.theme;
    }
  };

  try {
    const savedTheme = localStorage.getItem("theme");
    applyTheme(savedTheme);
  } catch {
    // ignore
  }

  const setTheme = (theme) => {
    applyTheme(theme);
    try {
      if (theme) localStorage.setItem("theme", theme);
      else localStorage.removeItem("theme");
    } catch {
      // ignore
    }
  };

  const themeToggle = document.querySelector(".theme-toggle");
  if (themeToggle) {
    themeToggle.addEventListener("click", () => {
      const current = root.dataset.theme;
      if (current === "dark") setTheme("light");
      else if (current === "light") setTheme("dark");
      else {
        const prefersDark =
          typeof window !== "undefined" &&
          window.matchMedia &&
          window.matchMedia("(prefers-color-scheme: dark)").matches;
        setTheme(prefersDark ? "light" : "dark");
      }
    });
  }

  const navToggle = document.querySelector(".nav-toggle");
  const navMenu = document.getElementById("nav-menu");
  if (navToggle && navMenu) {
    const closeNav = () => {
      document.body.classList.remove("nav-open");
      navToggle.setAttribute("aria-expanded", "false");
    };

    navToggle.addEventListener("click", () => {
      const isOpen = document.body.classList.toggle("nav-open");
      navToggle.setAttribute("aria-expanded", String(isOpen));
    });

    navMenu.addEventListener("click", (event) => {
      const target = event.target;
      if (target instanceof HTMLElement && target.closest("a")) closeNav();
    });

    window.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeNav();
    });
  }
})();
