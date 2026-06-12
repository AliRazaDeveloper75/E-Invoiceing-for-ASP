"use client";

import { useEffect, useState } from "react";
import { Users, MessageSquare, ThumbsUp, ThumbsDown, RefreshCw, LogOut } from "lucide-react";
import axios from "axios";

const API_URL = process.env.NEXT_PUBLIC_AI_AGENT_URL;

// ─── Types ────────────────────────────────────────────────────────────────────
interface Stats {
  total: number;
  thumbs_up: number;
  thumbs_down: number;
}

interface FeedbackItem {
  session_id: string;
  user_message: string;
  bot_response: string;
  rating: "thumbs_up" | "thumbs_down";
  created_at: string;
}

interface User {
  session_id: string;
  name: string;
  email: string;
  created_at: string;
}

// ─── Dashboard Page ───────────────────────────────────────────────────────────
export default function AdminDashboard() {
  const [secret, setSecret] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [stats, setStats] = useState<Stats | null>(null);
  const [feedback, setFeedback] = useState<FeedbackItem[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<"overview" | "feedback" | "users">("overview");
  const [refreshing, setRefreshing] = useState(false);

  // ─── Fetch All Data ──────────────────────────────────────────────────────
  const fetchData = async (adminSecret: string) => {
    setLoading(true);
    setError("");
    try {
      const [statsRes, feedbackRes, usersRes] = await Promise.all([
        axios.get(`${API_URL}/admin/feedback/stats?secret=${adminSecret}`),
        axios.get(`${API_URL}/admin/feedback?secret=${adminSecret}`),
        axios.get(`${API_URL}/admin/users?secret=${adminSecret}`),
      ]);
      setStats(statsRes.data);
      setFeedback(feedbackRes.data.feedback || []);
      setUsers(usersRes.data.users || []);
      setIsAuthenticated(true);
    } catch (err: any) {
      if (err.response?.status === 403) {
        setError("❌ Invalid admin secret. Access denied.");
      } else {
        setError("❌ Failed to load data. Check if backend is running.");
      }
      setIsAuthenticated(false);
    } finally {
      setLoading(false);
    }
  };

  // ─── Trigger Pipeline ────────────────────────────────────────────────────
  const triggerRefresh = async () => {
    setRefreshing(true);
    try {
      await axios.post(`${API_URL}/admin/refresh-data?secret=${secret}`);
      alert("✅ Data refresh triggered! Check Railway logs for progress.");
    } catch {
      alert("❌ Failed to trigger refresh.");
    } finally {
      setRefreshing(false);
    }
  };

  // ─── Login Screen ─────────────────────────────────────────────────────────
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 w-full max-w-md">
          <div className="text-center mb-8">
            <div className="w-14 h-14 bg-blue-600 rounded-xl flex items-center justify-center mx-auto mb-4">
              <span className="text-white text-2xl font-bold">N</span>
            </div>
            <h1 className="text-white text-2xl font-bold">Admin Dashboard</h1>
            <p className="text-gray-400 text-sm mt-1">E-Numerak Bot Analytics</p>
          </div>
          <div className="space-y-4">
            <input
              type="password"
              placeholder="Enter admin secret"
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && fetchData(secret)}
              className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500"
            />
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <button
              onClick={() => fetchData(secret)}
              disabled={loading || !secret}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-colors"
            >
              {loading ? "Verifying..." : "Access Dashboard"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Stats Cards ──────────────────────────────────────────────────────────
  const satisfactionRate = stats && stats.total > 0
    ? Math.round((stats.thumbs_up / stats.total) * 100)
    : 0;

  return (
    <div className="min-h-screen bg-gray-950 text-white">

      {/* Header */}
      <div className="border-b border-gray-800 bg-gray-900 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <span className="text-white text-sm font-bold">N</span>
          </div>
          <div>
            <h1 className="text-white font-bold text-lg">E-Numerak Bot</h1>
            <p className="text-gray-400 text-xs">Admin Dashboard</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={triggerRefresh}
            disabled={refreshing}
            className="flex items-center gap-2 bg-green-700 hover:bg-green-600 disabled:opacity-50 text-white text-sm px-4 py-2 rounded-lg transition-colors"
          >
            <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
            {refreshing ? "Triggering..." : "Refresh Bot Data"}
          </button>
          <button
            onClick={() => setIsAuthenticated(false)}
            className="flex items-center gap-2 text-gray-400 hover:text-white text-sm px-3 py-2 rounded-lg transition-colors"
          >
            <LogOut size={14} />
            Logout
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">

        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[
            { label: "Total Users", value: users.length, icon: Users, color: "blue" },
            { label: "Total Feedback", value: stats?.total ?? 0, icon: MessageSquare, color: "purple" },
            { label: "Thumbs Up", value: stats?.thumbs_up ?? 0, icon: ThumbsUp, color: "green" },
            { label: "Thumbs Down", value: stats?.thumbs_down ?? 0, icon: ThumbsDown, color: "red" },
          ].map((card) => (
            <div key={card.label} className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-gray-400 text-sm">{card.label}</span>
                <card.icon size={16} className={`text-${card.color}-400`} />
              </div>
              <p className="text-3xl font-bold text-white">{card.value}</p>
            </div>
          ))}
        </div>

        {/* Satisfaction Rate */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-8">
          <div className="flex items-center justify-between mb-3">
            <span className="text-gray-400 text-sm font-medium">Satisfaction Rate</span>
            <span className="text-white font-bold text-lg">{satisfactionRate}%</span>
          </div>
          <div className="w-full bg-gray-800 rounded-full h-2">
            <div
              className="bg-green-500 h-2 rounded-full transition-all duration-500"
              style={{ width: `${satisfactionRate}%` }}
            />
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border-gray-800">
          {(["overview", "feedback", "users"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm font-medium capitalize transition-colors border-b-2 -mb-px ${
                activeTab === tab
                  ? "border-blue-500 text-blue-400"
                  : "border-transparent text-gray-400 hover:text-white"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Overview Tab */}
        {activeTab === "overview" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Recent Users */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <h3 className="text-white font-semibold mb-4">Recent Users</h3>
              <div className="space-y-3">
                {users.slice(0, 5).map((user) => (
                  <div key={user.session_id} className="flex items-center justify-between">
                    <div>
                      <p className="text-white text-sm font-medium">{user.name}</p>
                      <p className="text-gray-400 text-xs">{user.email}</p>
                    </div>
                    <span className="text-gray-500 text-xs">
                      {new Date(user.created_at).toLocaleDateString()}
                    </span>
                  </div>
                ))}
                {users.length === 0 && <p className="text-gray-500 text-sm">No users yet.</p>}
              </div>
            </div>

            {/* Recent Feedback */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <h3 className="text-white font-semibold mb-4">Recent Feedback</h3>
              <div className="space-y-3">
                {feedback.slice(0, 5).map((item, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <span className="text-lg">{item.rating === "thumbs_up" ? "👍" : "👎"}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm truncate">{item.user_message}</p>
                      <p className="text-gray-500 text-xs">
                        {new Date(item.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                ))}
                {feedback.length === 0 && <p className="text-gray-500 text-sm">No feedback yet.</p>}
              </div>
            </div>
          </div>
        )}

        {/* Feedback Tab */}
        {activeTab === "feedback" && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-left text-gray-400 px-4 py-3 font-medium">Rating</th>
                  <th className="text-left text-gray-400 px-4 py-3 font-medium">User Question</th>
                  <th className="text-left text-gray-400 px-4 py-3 font-medium hidden lg:table-cell">Bot Response</th>
                  <th className="text-left text-gray-400 px-4 py-3 font-medium">Date</th>
                </tr>
              </thead>
              <tbody>
                {feedback.map((item, i) => (
                  <tr key={i} className="border-b border-gray-800 hover:bg-gray-800 transition-colors">
                    <td className="px-4 py-3">
                      <span className="text-lg">{item.rating === "thumbs_up" ? "👍" : "👎"}</span>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-white max-w-xs truncate">{item.user_message}</p>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <p className="text-gray-400 max-w-sm truncate">{item.bot_response}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                      {new Date(item.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
                {feedback.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-gray-500">No feedback yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Users Tab */}
        {activeTab === "users" && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-left text-gray-400 px-4 py-3 font-medium">Name</th>
                  <th className="text-left text-gray-400 px-4 py-3 font-medium">Email</th>
                  <th className="text-left text-gray-400 px-4 py-3 font-medium">Registered</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.session_id} className="border-b border-gray-800 hover:bg-gray-800 transition-colors">
                    <td className="px-4 py-3 text-white font-medium">{user.name}</td>
                    <td className="px-4 py-3 text-gray-400">{user.email}</td>
                    <td className="px-4 py-3 text-gray-500">
                      {new Date(user.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-4 py-8 text-center text-gray-500">No users yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}