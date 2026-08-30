/**
 * API Configuration for React Frontend
 * Handles all connections to Express backend
 */

// API Base URL - adjust based on environment
const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3000/api";
const BACKEND_BASE_URL = API_BASE_URL.replace(/\/api\/?$/, "");

export function backendAssetUrl(path?: string) {
  if (!path) return "";
  if (/^(https?:|data:|blob:)/.test(path)) return path;
  return `${BACKEND_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

/**
 * Fetch wrapper with error handling
 */
async function apiCall(endpoint, options = {}) {
  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
      ...options,
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error(`API call failed: ${endpoint}`, error);
    throw error;
  }
}

/**
 * API Service Methods
 */
export const apiService = {
  // Prayer Times
  getPrayerTimes: () => apiCall("/prayer-times"),

  // Events
  getEvents: () => apiCall("/events"),

  // Dashboard Stats
  getDashboardStats: () => apiCall("/dashboard-stats"),

  // Donations
  getRecentDonations: (limit = 6) => apiCall(`/donations/recent?limit=${limit}`),
  submitDonation: (donationData) =>
    apiCall("/donations/submit", {
      method: "POST",
      body: JSON.stringify(donationData),
    }),

  // Members
  getMembersCount: () => apiCall("/members/count"),

  // Announcements
  getAnnouncements: (type = "all", limit = 10) =>
    apiCall(`/announcements?type=${type}&limit=${limit}`),

  // Company Settings
  getCompanySettings: () => apiCall("/company-settings"),

  // Gallery
  getGalleryImages: (category = "all", limit = 12) =>
    apiCall(`/gallery?category=${category}&limit=${limit}`),

  // Staff Directory
  getStaff: () => apiCall("/staff"),

  // FAQ
  getFAQs: (category = "all") => apiCall(`/faq?category=${category}`),

  // Janaza Notices
  getJanazaNotices: (limit = 5) => apiCall(`/janaza?limit=${limit}`),

  // Contact Form
  submitContactForm: (formData) =>
    apiCall("/contact", {
      method: "POST",
      body: JSON.stringify(formData),
    }),
};

export default apiService;
