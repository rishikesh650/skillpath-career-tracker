/* SkillPath Global App State (Firebase Edition) */

// Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyDZ0jSrSou7TsoC0Bjjp1Q2GfPq6v5sHss",
  authDomain: "skillpath-b8475.firebaseapp.com",
  projectId: "skillpath-b8475",
  storageBucket: "skillpath-b8475.firebasestorage.app",
  messagingSenderId: "99139552958",
  appId: "1:99139552958:web:9e51d60a1d34942a9e80ef",
  measurementId: "G-JFQ2LBWFK2"
};

// Initialize Firebase
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}
const auth = firebase.auth();
const db = firebase.firestore();

// Default Local State
let localState = {
  user: null,
  skills: [],
  milestones: [],
  analytics: { monthlyProgress: [], skillCompletion: [] }
};

const App = {
  // --- Data Access Layer ---
  init() {
    // 1. Setup UI Listeners Immediately (Fixes broken buttons)
    const page = document.body.dataset.page;
    if (page && App.hooks[page]) {
      console.log(`Initializing page: ${page}`);
      App.hooks[page](false); // false = Setup Mode (Listeners)
    }

    // 2. Listen for Auth Changes
    auth.onAuthStateChanged(async (user) => {
      if (user) {
        console.log("User logged in:", user.email);
        localState.user = {
          uid: user.uid,
          email: user.email,
          username: user.displayName || user.email.split('@')[0],
          avatar: user.photoURL || `https://ui-avatars.com/api/?background=e0e7ff&color=4f46e5&name=${user.displayName || 'User'}`,
          role: "user"
        };

        const path = location.pathname.split("/").pop();
        if (path === "auth.html" || path === "index.html" || path === "") {
          location.href = "dashboard.html";
        }
        await App.fetchData(user.uid);
      } else {
        console.log("User logged out");
        localState.user = null;
        localState.skills = [];
        localState.milestones = [];
        const path = location.pathname.split("/").pop();
        if (path !== "auth.html" && path !== "index.html" && path !== "") {
          location.href = "auth.html";
        }
      }
    });
  },

  async fetchData(uid) {
    try {
      const skillsSnapshot = await db.collection("users").doc(uid).collection("skills").get();
      localState.skills = skillsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      const milestonesSnapshot = await db.collection("users").doc(uid).collection("milestones").get();
      localState.milestones = milestonesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      const profileDoc = await db.collection("users").doc(uid).get();
      if (profileDoc.exists) {
        const data = profileDoc.data();
        if (data.role) localState.user.role = data.role;
        if (data.username) localState.user.username = data.username;
        if (data.avatar) localState.user.avatar = data.avatar;
      }
      App.refreshUI();
    } catch (e) {
      console.error("Error loading data:", e);
    }
  },

  getState() { return localState; },

  refreshUI() {
    const page = document.body.dataset.page;
    if (page && App.hooks[page]) {
      App.hooks[page](true); // true = Render Mode (Data)
    }

    // Global Updates (Sidebar/Header)
    const user = localState.user;
    if (user) {
      document.querySelectorAll(".user-name-display").forEach(el => el.textContent = user.username);
      // Fallback for avatar
      document.querySelectorAll(".user-avatar-display").forEach(el => {
        if (el.tagName === 'IMG') el.src = user.avatar;
      });
    }
  },

  // --- Actions ---
  async addSkill(skill) {
    if (!localState.user) return;
    try {
      const newSkill = { ...skill, createdAt: Date.now() };
      const docRef = await db.collection("users").doc(localState.user.uid).collection("skills").add(newSkill);
      localState.skills.push({ id: docRef.id, ...newSkill });
      App.refreshUI();
    } catch (e) { console.error("Error adding skill:", e); }
  },

  async deleteSkill(id) {
    if (!confirm("Delete this skill?")) return;
    if (!localState.user) return;
    try {
      await db.collection("users").doc(localState.user.uid).collection("skills").doc(id).delete();
      localState.skills = localState.skills.filter(s => s.id !== id);
      App.refreshUI();
    } catch (e) { console.error(e); }
  },

  async updateSkill(id, updates) {
    if (!localState.user) return;
    try {
      await db.collection("users").doc(localState.user.uid).collection("skills").doc(id).update(updates);
      localState.skills = localState.skills.map(s => s.id === id ? { ...s, ...updates } : s);
      App.refreshUI();
    } catch (e) { console.error("Error updating skill", e); }
  },

  async addMilestone(ms) {
    if (!localState.user) return;
    try {
      const newMs = { ...ms, createdAt: Date.now(), completed: false };
      const docRef = await db.collection("users").doc(localState.user.uid).collection("milestones").add(newMs);
      localState.milestones.push({ id: docRef.id, ...newMs });
      App.refreshUI();
    } catch (e) { console.error(e); }
  },

  async deleteMilestone(id) {
    if (!localState.user) return;
    try {
      await db.collection("users").doc(localState.user.uid).collection("milestones").doc(id).delete();
      localState.milestones = localState.milestones.filter(m => m.id !== id);
      App.refreshUI();
    } catch (e) { console.error(e); }
  },

  async markMilestoneComplete(id) {
    if (!localState.user) return;
    try {
      await db.collection("users").doc(localState.user.uid).collection("milestones").doc(id).update({
        progress: 100, completed: true
      });
      localState.milestones = localState.milestones.map(m => m.id === id ? { ...m, progress: 100, completed: true } : m);
      App.refreshUI();
    } catch (e) { console.error(e); }
  },

  async logout() {
    await auth.signOut();
    location.href = "auth.html";
  },

  async updateUser(updates) {
    if (!localState.user) return;
    const user = auth.currentUser;
    if (user) {
      try {
        if (updates.username) await user.updateProfile({ displayName: updates.username });
        if (updates.avatar) await user.updateProfile({ photoURL: updates.avatar });

        await db.collection("users").doc(user.uid).set({
          ...updates
        }, { merge: true });

        localState.user = { ...localState.user, ...updates };
        App.refreshUI();
        alert("Profile updated successfully!");
      } catch (e) {
        console.error("Profile update failed", e);
        alert("Failed to update profile.");
      }
    }
  },

  exportData() {
    const s = App.getState();
    const skillsCSV = "Name,Category,Progress,Description\n" + s.skills.map(sk => `${sk.name},${sk.category},${sk.progress},${sk.description || ''}`).join("\n");
    const blob = new Blob([skillsCSV], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'skillpath_skills.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  },

  // --- Page Hooks ---
  hooks: {
    landing(rerender) {
      if (!rerender) {
        const loginBtn = document.getElementById("loginBtn");
        const signupBtn = document.getElementById("signupBtn");
        if (loginBtn) loginBtn.onclick = () => location.href = "auth.html";
        if (signupBtn) signupBtn.onclick = () => location.href = "auth.html#signup";
      }
    },

    auth(rerender) { /* Managed inline */ },

    dashboard(rerender) {
      if (!rerender) {
        // Setup Listeners ONCE
        const logoutBtn = document.getElementById("logoutBtn");
        if (logoutBtn) logoutBtn.onclick = App.logout;

        const viewRecsBtn = document.getElementById("viewRecsBtn");
        if (viewRecsBtn) {
          viewRecsBtn.onclick = () => {
            const s = App.getState();
            // 1. Sort skills by progress (ascending)
            const sorted = [...s.skills].sort((a, b) => Number(a.progress) - Number(b.progress));
            // 2. Take top 3
            const focusSkills = sorted.slice(0, 3);

            if (focusSkills.length === 0) {
              alert("Start adding some skills first!");
              return;
            }

            // 3. Create Dynamic Modal Overlay
            const overlay = document.createElement("div");
            overlay.className = "fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4 animate-fade-in-up";
            overlay.onclick = (e) => { if (e.target === overlay) document.body.removeChild(overlay); };

            const modal = document.createElement("div");
            modal.className = "glass-card p-6 w-full max-w-md relative";
            // Reuse glass-card styles but ensure opacity for readability
            modal.style.background = "rgba(30, 41, 59, 0.95)";

            let content = `
                <div class="flex justify-between items-center mb-6">
                    <h3 class="text-xl font-bold text-white">Focus Recommendations</h3>
                    <button class="text-slate-400 hover:text-white" onclick="this.closest('.fixed').remove()">✕</button>
                </div>
                <p class="text-slate-300 text-sm mb-6">Based on your proficiency levels, prioritizing these skills will yield the highest growth this week.</p>
                <div class="space-y-4">
             `;

            focusSkills.forEach((sk, i) => {
              content += `
                    <div class="p-4 rounded-xl border border-white/5 bg-slate-800/50 flex items-center justify-between">
                        <div class="flex items-center gap-4">
                            <span class="w-8 h-8 rounded-full bg-indigo-500/20 text-indigo-300 flex items-center justify-center font-bold text-sm">${i + 1}</span>
                            <div>
                                <h4 class="font-bold text-white">${sk.name}</h4>
                                <span class="text-xs text-slate-400 uppercase tracking-wider">${sk.category || 'General'}</span>
                            </div>
                        </div>
                        <div class="text-right">
                             <div class="text-xl font-bold text-indigo-400">${sk.progress}%</div>
                        </div>
                    </div>
                 `;
            });

            content += `</div>
                <div class="mt-8">
                     <button class="btn-primary w-full justify-center" onclick="this.closest('.fixed').remove(); window.location.href='skills.html'">Go to Skills</button>
                </div>
             `;

            modal.innerHTML = content;
            overlay.appendChild(modal);
            document.body.appendChild(overlay);
          };
        }

        // Note: Add Skill button on Dashboard just redirects, inline onclick in HTML handles it or:
        const addSkillDash = document.querySelector(".btn-primary[onclick*='skills.html']");
        // It's already inline in HTML: onclick="window.location.href='skills.html'"
      } else {
        // Render Data
        const s = App.getState();
        const total = s.skills.length;
        const completed = s.skills.filter(sk => Number(sk.progress) === 100).length;
        const pendingMs = s.milestones.filter(m => !m.completed).length;
        const avg = total ? Math.round(s.skills.reduce((a, b) => a + Number(b.progress), 0) / total) : 0;

        if (document.getElementById("totalSkills")) document.getElementById("totalSkills").textContent = total;
        if (document.getElementById("completedSkills")) document.getElementById("completedSkills").textContent = completed;
        if (document.getElementById("pendingMilestones")) document.getElementById("pendingMilestones").textContent = pendingMs;
        if (document.getElementById("avgProficiency")) document.getElementById("avgProficiency").textContent = avg + "%";
        if (document.getElementById("profBar")) document.getElementById("profBar").style.width = avg + "%";

        // Charts
        if (window.Chart) {
          const canvas = document.getElementById("progressChart");
          if (canvas) {
            if (window.dashChart) window.dashChart.destroy();
            window.dashChart = new Chart(canvas.getContext("2d"), App.buildProgressLineChart());
          }
        }
      }
    },

    skills(rerender) {
      if (!rerender) {
        // SETUP LISTENERS
        console.log("Setting up Skills Page Listeners");
        const addBtn = document.getElementById("addSkillBtn");
        const modal = document.getElementById("addSkillModal");
        const form = document.getElementById("addSkillForm");
        const cancel = document.getElementById("closeModalBtn");

        let isEditing = false;
        let editId = null;

        if (addBtn) {
          addBtn.addEventListener("click", () => {
            isEditing = false;
            document.querySelector("#addSkillModal h3").textContent = "Add New Skill";
            const submitBtn = document.querySelector("#addSkillModal button[type='submit']");
            if (submitBtn) submitBtn.textContent = "Add Skill";
            if (form) form.reset();
            modal.classList.remove("hidden");
          });
        }

        if (cancel) {
          cancel.addEventListener("click", () => {
            modal.classList.add("hidden");
            if (form) form.reset();
          });
        }

        // Global Edit Handler
        App.openEditSkill = (id) => {
          const sk = localState.skills.find(s => s.id === id);
          if (!sk) return;
          isEditing = true;
          editId = id;
          if (document.getElementById("skillName")) document.getElementById("skillName").value = sk.name;
          if (document.getElementById("skillDesc")) document.getElementById("skillDesc").value = sk.description || "";
          if (document.getElementById("skillCategory")) document.getElementById("skillCategory").value = sk.category || "Other";
          if (document.getElementById("skillProgress")) document.getElementById("skillProgress").value = sk.progress || 0;

          document.querySelector("#addSkillModal h3").textContent = "Edit Skill";
          document.querySelector("#addSkillModal button[type='submit']").textContent = "Update";
          modal.classList.remove("hidden");
        };

        if (form) {
          form.addEventListener("submit", (e) => {
            e.preventDefault();
            const name = document.getElementById("skillName").value;
            const desc = document.getElementById("skillDesc").value;
            const cat = document.getElementById("skillCategory").value;
            const progress = document.getElementById("skillProgress").value;

            if (isEditing && editId) {
              App.updateSkill(editId, { name, description: desc, category: cat, progress });
            } else {
              App.addSkill({ name, description: desc, category: cat, progress });
            }
            modal.classList.add("hidden");
            form.reset();
          });
        }
      } else {
        // RENDER DATA
        const s = App.getState();
        const list = document.getElementById("skillsList");
        const categoryColors = {
          'Frontend': 'bg-blue-50 text-blue-700 border-blue-100',
          'Backend': 'bg-emerald-50 text-emerald-700 border-emerald-100',
          'Design': 'bg-purple-50 text-purple-700 border-purple-100',
          'Mobile': 'bg-pink-50 text-pink-700 border-pink-100',
          'AI/ML': 'bg-indigo-50 text-indigo-700 border-indigo-100',
          'Other': 'bg-gray-50 text-gray-700 border-gray-100'
        };

        if (list) {
          list.innerHTML = "";
          const categoryColors = {
            'Frontend': 'bg-blue-500/10 text-blue-200 border-blue-500/20',
            'Backend': 'bg-emerald-500/10 text-emerald-200 border-emerald-500/20',
            'Design': 'bg-purple-500/10 text-purple-200 border-purple-500/20',
            'Mobile': 'bg-pink-500/10 text-pink-200 border-pink-500/20',
            'AI/ML': 'bg-indigo-500/10 text-indigo-200 border-indigo-500/20',
            'Other': 'bg-slate-500/10 text-slate-200 border-slate-500/20'
          };

          s.skills.forEach(sk => {
            const badgeColor = categoryColors[sk.category] || categoryColors['Other'];
            const card = document.createElement("div");
            card.className = "card p-6 rounded-xl border border-white/10 shadow-lg hover:shadow-xl transition-all group relative";
            card.innerHTML = `
                    <div class="flex justify-between items-start mb-3">
                    <div class="flex flex-col">
                        <span class="inline-block px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wide font-bold border w-fit mb-2 ${badgeColor} backdrop-blur-md">
                        ${sk.category || 'General'}
                        </span>
                        <h2 class="text-lg font-bold text-white leading-tight">${sk.name}</h2>
                    </div>
                    <div class="flex space-x-1">
                        <button class="text-slate-400 hover:text-indigo-400 transition-colors p-1" onclick="App.openEditSkill('${sk.id}')" title="Edit">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                            </svg>
                        </button>
                        <button class="text-slate-400 hover:text-red-400 transition-colors p-1" onclick="App.deleteSkill('${sk.id}')" title="Delete">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                        </button>
                    </div>
                    </div>
                    <p class="text-sm text-slate-300 mb-5 line-clamp-2 min-h-[2.5rem]">${sk.description || 'No description provided.'}</p>
                    <div class="space-y-2">
                    <div class="flex justify-between text-xs font-medium text-slate-400">
                        <span>Proficiency</span>
                        <span class="text-indigo-400 font-bold">${sk.progress}%</span>
                    </div>
                    <div class="w-full bg-slate-700/50 rounded-full h-1.5 overflow-hidden">
                        <div class="bg-indigo-500 h-full rounded-full transition-all duration-1000 ease-out" style="width: ${sk.progress}%"></div>
                    </div>
                    </div>
                `;
            list.appendChild(card);
          });
        }
      }
    },

    milestones(rerender) {
      if (!rerender) {
        // SETUP LISTENERS
        console.log("Setting up Milestones Page Listeners");
        const addBtn = document.getElementById("addMilestoneBtn");
        const modal = document.getElementById("addMilestoneModal");
        const form = document.getElementById("addMilestoneForm");
        const cancel = document.getElementById("closeModalBtn");

        if (addBtn) addBtn.addEventListener("click", () => modal.classList.remove("hidden"));
        if (cancel) cancel.addEventListener("click", () => modal.classList.add("hidden"));

        if (form) {
          form.addEventListener("submit", (e) => {
            e.preventDefault();
            const title = document.getElementById("msTitle").value;
            const date = document.getElementById("msDate").value;
            App.addMilestone({ title, dueDate: date });
            modal.classList.add("hidden");
            form.reset();
          });
        }
      } else {
        // RENDER DATA
        const s = App.getState();
        const list = document.getElementById("milestonesList");
        if (list) {
          list.innerHTML = "";
          if (s.milestones.length === 0) {
            list.innerHTML = `<div class="text-center text-slate-400 py-12 text-sm border-2 border-dashed border-slate-100 rounded-xl">No milestones found. Create a new target to get started.</div>`;
          }
          s.milestones.forEach(m => {
            const card = document.createElement("div");
            card.className = "card p-5 rounded-xl border border-white/10 shadow-sm hover:shadow-md transition-all flex flex-col md:flex-row items-center justify-between gap-4";
            if (m.completed) card.classList.add("bg-slate-800/50", "opacity-60");

            card.innerHTML = `
                    <div class="flex items-center space-x-4 w-full md:w-auto">
                        <div class="w-10 h-10 rounded-full flex items-center justify-center ${m.completed ? 'bg-emerald-500/10 text-emerald-400' : 'bg-indigo-500/10 text-indigo-400'}">
                            ${m.completed ? '✓' : '⚑'}
                        </div>
                        <div>
                            <h2 class="text-base font-bold text-slate-100 ${m.completed ? 'line-through text-slate-500' : ''}">${m.title}</h2>
                            <p class="text-xs text-slate-400 font-medium tracking-wide">DUE: ${m.dueDate || 'No Date'}</p>
                        </div>
                    </div>
                    <div class="flex items-center space-x-2 w-full md:w-auto justify-end">
                        ${!m.completed ? `<button class="px-3 py-1.5 bg-white/5 hover:bg-emerald-500/10 text-slate-300 hover:text-emerald-400 rounded-lg text-xs font-semibold transition border border-white/10 shadow-sm" onclick="App.markMilestoneComplete('${m.id}')">Mark Done</button>` : ''}
                        <button class="px-3 py-1.5 text-red-400 hover:text-red-500 rounded-lg text-xs font-semibold transition" onclick="App.deleteMilestone('${m.id}')">Remove</button>
                    </div>
                `;
            list.appendChild(card);
          });
        }
      }
    },

    reports(rerender) {
      if (!rerender) {
        const exportBtn = document.getElementById("viewAllReportsBtn");
        if (exportBtn) exportBtn.onclick = App.exportData;
      } else {
        // Render Charts
        if (typeof Chart === 'undefined') {
          console.error("Chart.js is not loaded!");
        } else {
          console.log("Rendering Charts...");
          // Skills Chart
          const skillsC = document.getElementById("skillsChart");
          if (skillsC) {
            if (window.rSkillsChart) window.rSkillsChart.destroy();
            window.rSkillsChart = new Chart(skillsC.getContext("2d"), App.buildSkillsBarChart());
          }
          // Milestones Chart
          const msC = document.getElementById("milestonesChart");
          if (msC) {
            if (window.rMilestonesChart) window.rMilestonesChart.destroy();
            window.rMilestonesChart = new Chart(msC.getContext("2d"), App.buildMilestonesDoughnutChart());
          }
        }
      }
    },

    profile(rerender) {
      if (!rerender) {
        const form = document.getElementById("profileForm");
        if (form) {
          form.addEventListener("submit", (e) => {
            e.preventDefault();
            const name = document.getElementById("profileName").value;
            const role = document.getElementById("profileRole").value;
            const avatar = document.getElementById("profileAvatar").value;
            App.updateUser({
              username: name,
              role: role,
              avatar: avatar
            });
          });
        }
      } else {
        const user = localState.user;
        if (user) {
          if (document.getElementById("profileName")) document.getElementById("profileName").value = user.username;
          if (document.getElementById("profileEmail")) document.getElementById("profileEmail").value = user.email;
          if (document.getElementById("profileRole")) document.getElementById("profileRole").value = user.role || "Member";
          if (document.getElementById("profileAvatar")) document.getElementById("profileAvatar").value = user.avatar;
          if (document.getElementById("profileImageDisplay")) document.getElementById("profileImageDisplay").src = user.avatar;
        }
      }
    }
  },

  // Chart Builders (Re-used)
  buildProgressLineChart() {
    return {
      type: "line",
      data: {
        labels: ["Jan", "Feb", "Mar", "Apr", "May", "Jun"],
        datasets: [{
          label: "Velocity",
          data: [20, 35, 50, 65, 75, 90],
          borderColor: "#4f46e5",
          backgroundColor: "rgba(79, 70, 229, 0.05)",
          borderWidth: 2,
          tension: 0.4,
          fill: true
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false }
        },
        scales: {
          y: {
            grid: { color: 'rgba(255, 255, 255, 0.05)' },
            ticks: { color: '#94a3b8' }
          },
          x: {
            grid: { display: false },
            ticks: { color: '#94a3b8' }
          }
        }
      }
    };
  },

  buildSkillsBarChart() {
    const s = App.getState();
    return {
      type: "bar",
      data: {
        labels: s.skills.map(sk => sk.name),
        datasets: [{
          label: "Proficiency",
          data: s.skills.map(sk => Number(sk.progress)),
          backgroundColor: "#6366f1",
          borderRadius: 4,
          hoverBackgroundColor: "#818cf8"
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false }
        },
        scales: {
          y: {
            grid: { color: 'rgba(255, 255, 255, 0.05)' },
            ticks: { color: '#94a3b8' },
            beginAtZero: true,
            max: 100
          },
          x: {
            grid: { display: false },
            ticks: { color: '#94a3b8' }
          }
        }
      }
    };
  },

  buildMilestonesDoughnutChart() {
    const s = App.getState();
    const completed = s.milestones.filter(m => m.completed).length;
    const pending = s.milestones.length - completed;

    // Handle empty state gracefully
    if (s.milestones.length === 0) {
      return {
        type: "doughnut",
        data: {
          labels: ["No Data"],
          datasets: [{
            data: [1],
            backgroundColor: ["rgba(148, 163, 184, 0.1)"],
            borderWidth: 0
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false }, tooltip: { enabled: false } },
          cutout: '75%'
        }
      };
    }

    return {
      type: "doughnut",
      data: {
        labels: ["Completed", "Pending"],
        datasets: [{
          data: [completed, pending],
          backgroundColor: ["#10b981", "rgba(99, 102, 241, 0.2)"],
          borderColor: ["#0f172a", "#0f172a"],
          borderWidth: 2,
          hoverOffset: 4
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: { color: '#94a3b8', usePointStyle: true, padding: 20 }
          }
        },
        cutout: '70%'
      }
    };
  }
};

// Start App
App.init();