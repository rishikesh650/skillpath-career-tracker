/* SkillPath Components
   - Injects a consistent sidebar and top bar across app pages
   - Wires navigation links
   - Displays user avatar/name from global App state
*/

(function () {
  const PAGES_WITH_SIDEBAR = ["dashboard", "skills", "milestones", "reports", "profile"];

  function createSidebar(active) {
    const links = [
      { label: "Dashboard", href: "dashboard.html", key: "dashboard" },
      { label: "Skills", href: "skills.html", key: "skills" },
      { label: "Milestones", href: "milestones.html", key: "milestones" },
      { label: "Reports", href: "reports.html", key: "reports" },
      { label: "Profile", href: "profile.html", key: "profile" },
    ];

    const navItems = links
      .map(
        (l) => `
      <a href="${l.href}" class="block px-4 py-2 rounded hover:bg-indigo-600 ${
        active === l.key ? "bg-indigo-600" : ""
      }">${l.label}</a>`
      )
      .join("");

    return `
    <aside class="w-64 bg-indigo-700 text-white flex flex-col">
      <div class="p-6 text-2xl font-bold">SkillPath</div>
      <nav class="flex-1 px-4 space-y-2">${navItems}</nav>
      <div class="p-4 text-sm text-center border-t border-indigo-600">© 2025 SkillPath</div>
    </aside>
    `;
  }

  function createTopBar(title, user) {
    const name = user?.username || "User";
    const avatar = user?.avatar || "https://cdn-icons-png.flaticon.com/512/3135/3135715.png";
    return `
    <header class="flex justify-between items-center bg-white shadow px-6 py-4">
      <h1 class="text-2xl font-semibold text-gray-700">${title}</h1>
      <div class="flex items-center space-x-4">
        <span class="text-gray-600">Hello, ${name}</span>
        <img src="${avatar}" alt="User Profile" class="w-10 h-10 rounded-full border" />
        <button id="globalThemeToggle" class="bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600 transition">Theme</button>
        <button id="logoutBtn" class="bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700 transition">Logout</button>

      </div>
    </header>
    `;
  }

  function wrapWithLayout(contentHTML, activeKey, title) {
    const state = window.App?.getState?.() || null;
    const sidebar = createSidebar(activeKey);
    const topbar = createTopBar(title, state?.user);

    return `
    <div class="flex min-h-screen">
      ${sidebar}
      <main class="flex-1">
        ${topbar}
        ${contentHTML}
      </main>
    </div>
    `;
  }

  function injectLayout() {
    const body = document.body;
    const page = (body.dataset.page || "").toLowerCase();
    const pathname = (location.pathname.split("/").pop() || "").toLowerCase();
    const key =
      page ||
      (pathname.includes("dashboard")
        ? "dashboard"
        : pathname.includes("skills")
        ? "skills"
        : pathname.includes("milestones")
        ? "milestones"
        : pathname.includes("reports")
        ? "reports"
        : pathname.includes("profile")
        ? "profile"
        : pathname.includes("auth")
        ? "auth"
        : pathname.includes("index")
        ? "index"
        : "");

    // Only inject on pages that need the sidebar/topbar
    if (!PAGES_WITH_SIDEBAR.includes(key)) return;

    // Grab current main content (everything inside <body>) except scripts
    const nodes = Array.from(body.childNodes);
    const fragment = document.createElement("div");
    nodes.forEach((n) => {
      if (n.tagName !== "SCRIPT") fragment.appendChild(n.cloneNode(true));
    });

    const contentHTML = fragment.innerHTML;

    // Replace body content with unified layout
    body.innerHTML = wrapWithLayout(contentHTML, key, titleForKey(key));

    // Wire global theme toggle
    document.getElementById("globalThemeToggle")?.addEventListener("click", () => {
      window.App?.toggleTheme?.();
      document.getElementById("logoutBtn")?.addEventListener("click", () => {
  // Clear saved user data
  localStorage.clear();

  // Redirect to login page
  window.location.href = "auth.html";
});
    });
  }

  function titleForKey(key) {
    switch (key) {
      case "dashboard":
        return "Dashboard";
      case "skills":
        return "Skills Management";
      case "milestones":
        return "Milestones";
      case "reports":
        return "Reports & Analytics";
      case "profile":
        return "User Profile";
      default:
        return "SkillPath";
    }
  }

  document.addEventListener("DOMContentLoaded", injectLayout);
})();