"use client";

import { useState } from "react";
import {
  Users, MessageSquare, ThumbsUp, ThumbsDown,
  RefreshCw, LogOut, ChevronRight, X,
  Activity, Clock, Search
} from "lucide-react";
import axios from "axios";

const API_URL = "https://tax-data-assistant-backend-production.up.railway.app";

// ─── Helpers ──────────────────────────────────────────────────────────────────
const formatDate = (dateStr: string) => {
  if (!dateStr) return "—";
  const date = new Date(dateStr.replace(" ", "T"));
  return isNaN(date.getTime()) ? "—" : date.toLocaleDateString("en-AE", {
    day: "2-digit", month: "short", year: "numeric"
  });
};

const formatTime = (dateStr: string) => {
  if (!dateStr) return "";
  const date = new Date(dateStr.replace(" ", "T"));
  return isNaN(date.getTime()) ? "" : date.toLocaleTimeString("en-AE", {
    hour: "2-digit", minute: "2-digit"
  });
};

const timeAgo = (dateStr: string) => {
  if (!dateStr) return "—";
  const diff = Date.now() - new Date(dateStr.replace(" ", "T")).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (mins > 0) return `${mins}m ago`;
  return "Just now";
};

// ─── Types ────────────────────────────────────────────────────────────────────
interface Stats { total: number; thumbs_up: number; thumbs_down: number; }
interface FeedbackItem {
  id: number; user_id: number;
  user_message: string; bot_response: string;
  rating: "thumbs_up" | "thumbs_down"; created_at: string;
}
interface User { id: number; name: string; email: string; created_at: string; }
interface Message { id: number; role: "user" | "assistant"; message: string; created_at: string; }

// ─── Login ────────────────────────────────────────────────────────────────────
function LoginScreen({ onLogin }: { onLogin: (secret: string) => void }) {
  const [secret, setSecret] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async () => {
    if (!secret) return;
    setLoading(true);
    setError("");
    try {
      await axios.get(`${API_URL}/admin/feedback/stats?secret=${secret}`);
      onLogin(secret);
    } catch (err: any) {
      setError(err.response?.status === 403
        ? "Invalid admin key. Access denied."
        : "Cannot reach backend. Is it running?"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: "100vh", background: "#0a0a0f",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "'Inter', -apple-system, sans-serif", padding: "16px"
    }}>
      <div style={{
        width: "100%", maxWidth: "400px",
        background: "linear-gradient(135deg, #111118 0%, #0d0d14 100%)",
        border: "1px solid #1e1e2e", borderRadius: "20px",
        padding: "40px", boxShadow: "0 25px 50px rgba(0,0,0,0.5)"
      }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: "32px" }}>
          <div style={{
            width: "56px", height: "56px", margin: "0 auto 16px",
            background: "linear-gradient(135deg, #3b82f6, #6366f1)",
            borderRadius: "16px", display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 8px 24px rgba(99,102,241,0.3)"
          }}>
            <span style={{ color: "white", fontSize: "22px", fontWeight: "800" }}>N</span>
          </div>
          <h1 style={{ color: "#f8fafc", fontSize: "22px", fontWeight: "700", margin: "0 0 6px" }}>
            E-Numerak Admin
          </h1>
          <p style={{ color: "#64748b", fontSize: "13px", margin: 0 }}>
            Bot Analytics Dashboard
          </p>
        </div>

        {/* Input */}
        <div style={{ marginBottom: "12px" }}>
          <input
            type="password"
            placeholder="Enter admin key"
            value={secret}
            onChange={e => setSecret(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleLogin()}
            style={{
              width: "100%", background: "#0f0f1a", border: "1px solid #1e1e2e",
              color: "#f1f5f9", borderRadius: "12px", padding: "14px 16px",
              fontSize: "14px", outline: "none", boxSizing: "border-box",
              transition: "border-color 0.2s"
            }}
            onFocus={e => e.target.style.borderColor = "#3b82f6"}
            onBlur={e => e.target.style.borderColor = "#1e1e2e"}
          />
        </div>

        {error && (
          <p style={{ color: "#f87171", fontSize: "13px", marginBottom: "12px", padding: "10px 12px", background: "#1f0f0f", borderRadius: "8px", border: "1px solid #3f1f1f" }}>
            {error}
          </p>
        )}

        <button
          onClick={handleLogin}
          disabled={loading || !secret}
          style={{
            width: "100%", background: loading || !secret
              ? "#1e1e2e"
              : "linear-gradient(135deg, #3b82f6, #6366f1)",
            color: loading || !secret ? "#475569" : "white",
            border: "none", borderRadius: "12px", padding: "14px",
            fontSize: "14px", fontWeight: "600", cursor: loading || !secret ? "not-allowed" : "pointer",
            transition: "all 0.2s", boxShadow: loading || !secret ? "none" : "0 4px 15px rgba(99,102,241,0.3)"
          }}
        >
          {loading ? "Verifying…" : "Access Dashboard →"}
        </button>
      </div>
    </div>
  );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────
function StatCard({ label, value, icon: Icon, color }: {
  label: string; value: number; icon: any; color: string;
}) {
  const colors: Record<string, { bg: string; text: string; glow: string }> = {
    blue:   { bg: "rgba(59,130,246,0.1)",  text: "#60a5fa", glow: "rgba(59,130,246,0.2)"  },
    purple: { bg: "rgba(139,92,246,0.1)",  text: "#a78bfa", glow: "rgba(139,92,246,0.2)"  },
    green:  { bg: "rgba(34,197,94,0.1)",   text: "#4ade80", glow: "rgba(34,197,94,0.2)"   },
    red:    { bg: "rgba(239,68,68,0.1)",   text: "#f87171", glow: "rgba(239,68,68,0.2)"   },
  };
  const c = colors[color];
  return (
    <div style={{
      background: "#111118", border: "1px solid #1e1e2e", borderRadius: "16px",
      padding: "20px", position: "relative", overflow: "hidden"
    }}>
      <div style={{
        position: "absolute", top: "16px", right: "16px",
        width: "36px", height: "36px", background: c.bg,
        borderRadius: "10px", display: "flex", alignItems: "center", justifyContent: "center",
        boxShadow: `0 0 16px ${c.glow}`
      }}>
        <Icon size={16} color={c.text} />
      </div>
      <p style={{ color: "#64748b", fontSize: "12px", margin: "0 0 8px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
        {label}
      </p>
      <p style={{ color: "#f8fafc", fontSize: "28px", fontWeight: "700", margin: 0 }}>
        {value.toLocaleString()}
      </p>
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────
export default function AdminDashboard() {
  const [secret, setSecret] = useState("");
  const [isAuth, setIsAuth] = useState(false);
  const [stats, setStats] = useState<Stats | null>(null);
  const [feedback, setFeedback] = useState<FeedbackItem[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [activeTab, setActiveTab] = useState<"overview" | "feedback" | "users">("overview");
  const [refreshing, setRefreshing] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [conversations, setConversations] = useState<Message[]>([]);
  const [loadingChat, setLoadingChat] = useState(false);
  const [searchFeedback, setSearchFeedback] = useState("");
  const [searchUsers, setSearchUsers] = useState("");
  const [feedbackFilter, setFeedbackFilter] = useState<"all" | "thumbs_up" | "thumbs_down">("all");

  // ⬇️ UPDATED: Promise.allSettled — agar koi ek endpoint kabhi fail ho to baqi dashboard
  // still load ho jaye, total crash na ho.
  const loadData = async (s: string) => {
    const [statsRes, feedbackRes, usersRes] = await Promise.allSettled([
      axios.get(`${API_URL}/admin/feedback/stats?secret=${s}`),
      axios.get(`${API_URL}/admin/feedback?secret=${s}`),
      axios.get(`${API_URL}/admin/users?secret=${s}`),
    ]);

    if (statsRes.status === "fulfilled") setStats(statsRes.value.data);
    if (feedbackRes.status === "fulfilled") setFeedback(feedbackRes.value.data.feedback || []);
    if (usersRes.status === "fulfilled") setUsers(usersRes.value.data.users || []);
  };

  const handleLogin = async (s: string) => {
    setSecret(s);
    await loadData(s);
    setIsAuth(true);
  };

  const triggerRefresh = async () => {
    setRefreshing(true);
    try {
      await axios.post(`${API_URL}/admin/refresh-data?secret=${secret}`);
      alert("✅ Pipeline triggered! Check Railway logs.");
    } catch {
      alert("❌ Failed to trigger refresh.");
    } finally {
      setRefreshing(false);
    }
  };

  const openUserChat = async (user: User) => {
    setSelectedUser(user);
    setLoadingChat(true);
    try {
      const res = await axios.get(`${API_URL}/admin/conversations/${user.id}?secret=${secret}`);
      setConversations(res.data.messages || []);
    } catch {
      setConversations([]);
    } finally {
      setLoadingChat(false);
    }
  };

  if (!isAuth) return <LoginScreen onLogin={handleLogin} />;

  const satisfactionRate = stats && stats.total > 0
    ? Math.round((stats.thumbs_up / stats.total) * 100) : 0;

  const filteredFeedback = feedback
    .filter(f => feedbackFilter === "all" || f.rating === feedbackFilter)
    .filter(f => !searchFeedback || f.user_message.toLowerCase().includes(searchFeedback.toLowerCase()));

  const filteredUsers = users.filter(u =>
    !searchUsers || u.name.toLowerCase().includes(searchUsers.toLowerCase()) ||
    u.email.toLowerCase().includes(searchUsers.toLowerCase())
  );

  const S: Record<string, any> = {
    root: {
      minHeight: "100vh", background: "#0a0a0f",
      fontFamily: "'Inter', -apple-system, sans-serif", color: "#f1f5f9"
    },
    header: {
      borderBottom: "1px solid #1e1e2e", background: "#0d0d14",
      padding: "0 24px", height: "60px",
      display: "flex", alignItems: "center", justifyContent: "space-between",
      position: "sticky" as const, top: 0, zIndex: 100,
      backdropFilter: "blur(12px)"
    },
    main: { maxWidth: "1280px", margin: "0 auto", padding: "28px 24px" },
    tabBar: { display: "flex", gap: "4px", marginBottom: "24px", background: "#111118", borderRadius: "12px", padding: "4px", width: "fit-content" },
    card: { background: "#111118", border: "1px solid #1e1e2e", borderRadius: "16px" },
    input: {
      background: "#0a0a0f", border: "1px solid #1e1e2e", color: "#f1f5f9",
      borderRadius: "10px", padding: "8px 12px 8px 36px", fontSize: "13px", outline: "none",
      width: "200px"
    },
  };

  const tabs = ["overview", "feedback", "users"] as const;

  return (
    <div style={S.root}>
      {/* Header */}
      <header style={S.header}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{
            width: "32px", height: "32px",
            background: "linear-gradient(135deg, #3b82f6, #6366f1)",
            borderRadius: "9px", display: "flex", alignItems: "center", justifyContent: "center"
          }}>
            <span style={{ color: "white", fontSize: "13px", fontWeight: "800" }}>N</span>
          </div>
          <div>
            <p style={{ margin: 0, fontWeight: "700", fontSize: "14px", color: "#f8fafc" }}>E-Numerak</p>
            <p style={{ margin: 0, fontSize: "11px", color: "#475569" }}>Admin Dashboard</p>
          </div>
        </div>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <button onClick={triggerRefresh} disabled={refreshing} style={{
            display: "flex", alignItems: "center", gap: "6px",
            background: refreshing ? "#111118" : "rgba(34,197,94,0.1)",
            color: refreshing ? "#475569" : "#4ade80",
            border: "1px solid", borderColor: refreshing ? "#1e1e2e" : "rgba(34,197,94,0.2)",
            borderRadius: "9px", padding: "7px 14px", fontSize: "12px",
            fontWeight: "600", cursor: refreshing ? "not-allowed" : "pointer"
          }}>
            <RefreshCw size={13} style={{ animation: refreshing ? "spin 1s linear infinite" : "none" }} />
            {refreshing ? "Running…" : "Refresh Data"}
          </button>
          <button onClick={() => setIsAuth(false)} style={{
            display: "flex", alignItems: "center", gap: "6px",
            background: "none", color: "#64748b", border: "1px solid #1e1e2e",
            borderRadius: "9px", padding: "7px 12px", fontSize: "12px", cursor: "pointer"
          }}>
            <LogOut size={13} /> Logout
          </button>
        </div>
      </header>

      <main style={S.main}>
        {/* Stat Cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px", marginBottom: "20px" }}>
          <StatCard label="Total Users"    value={users.length}         icon={Users}        color="blue"   />
          <StatCard label="Total Feedback" value={stats?.total ?? 0}    icon={MessageSquare} color="purple" />
          <StatCard label="Thumbs Up"      value={stats?.thumbs_up ?? 0}   icon={ThumbsUp}  color="green"  />
          <StatCard label="Thumbs Down"    value={stats?.thumbs_down ?? 0} icon={ThumbsDown} color="red"   />
        </div>

        {/* Satisfaction Bar */}
        <div style={{ ...S.card, padding: "18px 20px", marginBottom: "24px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <Activity size={14} color="#4ade80" />
              <span style={{ fontSize: "13px", color: "#94a3b8", fontWeight: "500" }}>Satisfaction Rate</span>
            </div>
            <span style={{
              fontSize: "20px", fontWeight: "700",
              color: satisfactionRate >= 70 ? "#4ade80" : satisfactionRate >= 40 ? "#fbbf24" : "#f87171"
            }}>
              {satisfactionRate}%
            </span>
          </div>
          <div style={{ background: "#0a0a0f", borderRadius: "999px", height: "6px", overflow: "hidden" }}>
            <div style={{
              height: "100%", borderRadius: "999px", width: `${satisfactionRate}%`,
              background: satisfactionRate >= 70
                ? "linear-gradient(90deg, #22c55e, #4ade80)"
                : satisfactionRate >= 40
                ? "linear-gradient(90deg, #f59e0b, #fbbf24)"
                : "linear-gradient(90deg, #ef4444, #f87171)",
              transition: "width 0.6s ease"
            }} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: "8px" }}>
            <span style={{ fontSize: "11px", color: "#475569" }}>{stats?.thumbs_up ?? 0} positive</span>
            <span style={{ fontSize: "11px", color: "#475569" }}>{stats?.thumbs_down ?? 0} negative</span>
          </div>
        </div>

        {/* Tabs */}
        <div style={S.tabBar}>
          {tabs.map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} style={{
              padding: "7px 18px", borderRadius: "9px", border: "none",
              background: activeTab === tab ? "linear-gradient(135deg, #3b82f6, #6366f1)" : "none",
              color: activeTab === tab ? "white" : "#64748b",
              fontSize: "13px", fontWeight: "600", cursor: "pointer",
              textTransform: "capitalize", transition: "all 0.2s",
              boxShadow: activeTab === tab ? "0 4px 12px rgba(99,102,241,0.3)" : "none"
            }}>
              {tab}
            </button>
          ))}
        </div>

        {/* ── Overview Tab ── */}
        {activeTab === "overview" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
            {/* Recent Users */}
            <div style={{ ...S.card, padding: "20px" }}>
              <h3 style={{ margin: "0 0 16px", fontSize: "14px", fontWeight: "600", color: "#f8fafc" }}>
                Recent Users
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {users.slice(0, 6).map(user => (
                  <div key={user.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <div style={{
                        width: "32px", height: "32px", borderRadius: "50%",
                        background: `hsl(${(user.id * 47) % 360}, 60%, 30%)`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: "12px", fontWeight: "700", color: "white", flexShrink: 0
                      }}>
                        {user.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p style={{ margin: 0, fontSize: "13px", fontWeight: "600", color: "#f1f5f9" }}>{user.name}</p>
                        <p style={{ margin: 0, fontSize: "11px", color: "#475569" }}>{user.email}</p>
                      </div>
                    </div>
                    <span style={{ fontSize: "11px", color: "#334155" }}>{timeAgo(user.created_at)}</span>
                  </div>
                ))}
                {users.length === 0 && <p style={{ color: "#334155", fontSize: "13px" }}>No users yet.</p>}
              </div>
            </div>

            {/* Recent Feedback */}
            <div style={{ ...S.card, padding: "20px" }}>
              <h3 style={{ margin: "0 0 16px", fontSize: "14px", fontWeight: "600", color: "#f8fafc" }}>
                Recent Feedback
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {feedback.slice(0, 6).map((item, i) => (
                  <div key={i} style={{
                    display: "flex", gap: "10px", alignItems: "flex-start",
                    padding: "10px", background: "#0d0d14", borderRadius: "10px",
                    border: "1px solid #1e1e2e"
                  }}>
                    <span style={{
                      fontSize: "16px", flexShrink: 0,
                      filter: item.rating === "thumbs_up" ? "none" : "grayscale(0.3)"
                    }}>
                      {item.rating === "thumbs_up" ? "👍" : "👎"}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: "0 0 2px", fontSize: "12px", color: "#cbd5e1", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {item.user_message}
                      </p>
                      <span style={{ fontSize: "10px", color: "#334155" }}>{timeAgo(item.created_at)}</span>
                    </div>
                  </div>
                ))}
                {feedback.length === 0 && <p style={{ color: "#334155", fontSize: "13px" }}>No feedback yet.</p>}
              </div>
            </div>
          </div>
        )}

        {/* ── Feedback Tab ── */}
        {activeTab === "feedback" && (
          <div>
            {/* Filters */}
            <div style={{ display: "flex", gap: "10px", marginBottom: "16px", flexWrap: "wrap" }}>
              <div style={{ position: "relative" }}>
                <Search size={13} style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "#475569" }} />
                <input
                  placeholder="Search questions…"
                  value={searchFeedback}
                  onChange={e => setSearchFeedback(e.target.value)}
                  style={S.input}
                />
              </div>
              {(["all", "thumbs_up", "thumbs_down"] as const).map(f => (
                <button key={f} onClick={() => setFeedbackFilter(f)} style={{
                  padding: "8px 14px", borderRadius: "9px", border: "1px solid",
                  borderColor: feedbackFilter === f ? "#3b82f6" : "#1e1e2e",
                  background: feedbackFilter === f ? "rgba(59,130,246,0.1)" : "none",
                  color: feedbackFilter === f ? "#60a5fa" : "#475569",
                  fontSize: "12px", fontWeight: "600", cursor: "pointer"
                }}>
                  {f === "all" ? "All" : f === "thumbs_up" ? "👍 Positive" : "👎 Negative"}
                </button>
              ))}
            </div>

            <div style={{ ...S.card, overflow: "hidden" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid #1e1e2e" }}>
                    {["Rating", "User Question", "Bot Response", "Date"].map(h => (
                      <th key={h} style={{ textAlign: "left", padding: "12px 16px", color: "#475569", fontWeight: "600", fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredFeedback.map((item, i) => (
                    <tr key={i} style={{ borderBottom: "1px solid #0f0f1a" }}
                      onMouseEnter={e => (e.currentTarget.style.background = "#0d0d14")}
                      onMouseLeave={e => (e.currentTarget.style.background = "none")}
                    >
                      <td style={{ padding: "12px 16px" }}>
                        <span style={{
                          display: "inline-flex", alignItems: "center", gap: "4px",
                          padding: "3px 8px", borderRadius: "6px", fontSize: "11px", fontWeight: "600",
                          background: item.rating === "thumbs_up" ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)",
                          color: item.rating === "thumbs_up" ? "#4ade80" : "#f87171",
                          border: "1px solid", borderColor: item.rating === "thumbs_up" ? "rgba(34,197,94,0.2)" : "rgba(239,68,68,0.2)"
                        }}>
                          {item.rating === "thumbs_up" ? "👍 Good" : "👎 Bad"}
                        </span>
                      </td>
                      <td style={{ padding: "12px 16px", color: "#cbd5e1", maxWidth: "220px" }}>
                        <p style={{ margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.user_message}</p>
                      </td>
                      <td style={{ padding: "12px 16px", color: "#475569", maxWidth: "280px" }}>
                        <p style={{ margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.bot_response}</p>
                      </td>
                      <td style={{ padding: "12px 16px", color: "#334155", whiteSpace: "nowrap" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                          <Clock size={11} />
                          {formatDate(item.created_at)}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredFeedback.length === 0 && (
                    <tr><td colSpan={4} style={{ padding: "48px", textAlign: "center", color: "#334155" }}>No feedback found.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Users Tab ── */}
        {activeTab === "users" && (
          <div style={{ display: "grid", gridTemplateColumns: selectedUser ? "1fr 1fr" : "1fr", gap: "16px" }}>
            {/* Users List */}
            <div style={S.card}>
              {/* Search */}
              <div style={{ padding: "16px", borderBottom: "1px solid #1e1e2e" }}>
                <div style={{ position: "relative" }}>
                  <Search size={13} style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "#475569" }} />
                  <input
                    placeholder="Search users…"
                    value={searchUsers}
                    onChange={e => setSearchUsers(e.target.value)}
                    style={{ ...S.input, width: "100%", boxSizing: "border-box" as const }}
                  />
                </div>
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid #1e1e2e" }}>
                    {["User", "Email", "Joined", ""].map((h, i) => (
                      <th key={i} style={{ textAlign: "left", padding: "12px 16px", color: "#475569", fontWeight: "600", fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map(user => (
                    <tr key={user.id}
                      style={{ borderBottom: "1px solid #0f0f1a", background: selectedUser?.id === user.id ? "rgba(59,130,246,0.05)" : "none", cursor: "pointer" }}
                      onMouseEnter={e => { if (selectedUser?.id !== user.id) e.currentTarget.style.background = "#0d0d14"; }}
                      onMouseLeave={e => { if (selectedUser?.id !== user.id) e.currentTarget.style.background = "none"; }}
                    >
                      <td style={{ padding: "12px 16px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                          <div style={{
                            width: "30px", height: "30px", borderRadius: "50%", flexShrink: 0,
                            background: `hsl(${(user.id * 47) % 360}, 55%, 28%)`,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: "12px", fontWeight: "700", color: "white"
                          }}>
                            {user.name.charAt(0).toUpperCase()}
                          </div>
                          <span style={{ fontWeight: "600", color: "#f1f5f9" }}>{user.name}</span>
                        </div>
                      </td>
                      <td style={{ padding: "12px 16px", color: "#64748b" }}>{user.email}</td>
                      <td style={{ padding: "12px 16px", color: "#334155", whiteSpace: "nowrap" }}>{formatDate(user.created_at)}</td>
                      <td style={{ padding: "12px 16px" }}>
                        <button
                          onClick={() => openUserChat(user)}
                          style={{
                            display: "flex", alignItems: "center", gap: "4px",
                            background: selectedUser?.id === user.id ? "rgba(59,130,246,0.15)" : "rgba(59,130,246,0.08)",
                            color: "#60a5fa", border: "1px solid rgba(59,130,246,0.2)",
                            borderRadius: "7px", padding: "5px 10px", fontSize: "11px",
                            fontWeight: "600", cursor: "pointer"
                          }}
                        >
                          Chat <ChevronRight size={11} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filteredUsers.length === 0 && (
                    <tr><td colSpan={4} style={{ padding: "48px", textAlign: "center", color: "#334155" }}>No users found.</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Chat Panel */}
            {selectedUser && (
              <div style={{ ...S.card, display: "flex", flexDirection: "column", height: "600px" }}>
                {/* Chat Header */}
                <div style={{ padding: "16px 20px", borderBottom: "1px solid #1e1e2e", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <div style={{
                      width: "34px", height: "34px", borderRadius: "50%",
                      background: `hsl(${(selectedUser.id * 47) % 360}, 55%, 28%)`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: "13px", fontWeight: "700", color: "white"
                    }}>
                      {selectedUser.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p style={{ margin: 0, fontWeight: "700", fontSize: "13px", color: "#f1f5f9" }}>{selectedUser.name}</p>
                      <p style={{ margin: 0, fontSize: "11px", color: "#475569" }}>{selectedUser.email}</p>
                    </div>
                  </div>
                  <button onClick={() => { setSelectedUser(null); setConversations([]); }} style={{
                    background: "none", border: "1px solid #1e1e2e", color: "#475569",
                    borderRadius: "7px", padding: "5px", cursor: "pointer", display: "flex"
                  }}>
                    <X size={14} />
                  </button>
                </div>

                {/* Messages */}
                <div style={{ flex: 1, overflowY: "auto", padding: "16px", display: "flex", flexDirection: "column", gap: "10px" }}>
                  {loadingChat ? (
                    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100%" }}>
                      <p style={{ color: "#334155", fontSize: "13px" }}>Loading chat…</p>
                    </div>
                  ) : conversations.length === 0 ? (
                    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100%" }}>
                      <p style={{ color: "#334155", fontSize: "13px" }}>No messages found.</p>
                    </div>
                  ) : (
                    conversations.map((msg, i) => (
                      <div key={i} style={{ display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start" }}>
                        <div style={{
                          maxWidth: "75%", padding: "10px 14px", borderRadius: msg.role === "user" ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                          background: msg.role === "user"
                            ? "linear-gradient(135deg, #3b82f6, #6366f1)"
                            : "#1a1a24",
                          border: msg.role === "user" ? "none" : "1px solid #1e1e2e",
                          boxShadow: msg.role === "user" ? "0 4px 12px rgba(99,102,241,0.2)" : "none"
                        }}>
                          <p style={{ margin: "0 0 4px", fontSize: "13px", color: msg.role === "user" ? "white" : "#cbd5e1", lineHeight: "1.5" }}>
                            {msg.message}
                          </p>
                          <p style={{ margin: 0, fontSize: "10px", color: msg.role === "user" ? "rgba(255,255,255,0.5)" : "#334155" }}>
                            {formatTime(msg.created_at)}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Footer */}
                <div style={{ padding: "12px 16px", borderTop: "1px solid #1e1e2e", flexShrink: 0 }}>
                  <p style={{ margin: 0, fontSize: "11px", color: "#334155", textAlign: "center" }}>
                    {conversations.length} message{conversations.length !== 1 ? "s" : ""} · Joined {formatDate(selectedUser.created_at)}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: #0a0a0f; }
        ::-webkit-scrollbar-thumb { background: #1e1e2e; border-radius: 999px; }
      `}</style>
    </div>
  );
}