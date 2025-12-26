(() => {
  const injectSprite = async () => {
    if (document.getElementById("svg-sprite")) return;

    const currentScript =
      document.currentScript ||
      document.querySelector('script[src$="/js/site.js"], script[src$="../js/site.js"]');
    if (!currentScript) return;

    const scriptUrl = new URL(currentScript.src, window.location.href);
    const iconsUrl = new URL("../assets/icons.svg", scriptUrl);

    try {
      const response = await fetch(iconsUrl.href, { cache: "force-cache" });
      if (!response.ok) return;

      const text = await response.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(text, "image/svg+xml");
      const svg = doc.querySelector("svg");
      if (!svg) return;

      svg.id = "svg-sprite";
      svg.setAttribute("aria-hidden", "true");
      svg.setAttribute("focusable", "false");

      document.body.insertAdjacentElement("afterbegin", document.importNode(svg, true));
    } catch {
      // ignore
    }
  };

  void injectSprite();

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
