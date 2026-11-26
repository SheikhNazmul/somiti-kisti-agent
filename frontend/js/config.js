// API_BASE খালি থাকলে অ্যাপ একই ডোমেইনের /api/v1 ডাকে।
// Netlify সেই অনুরোধ Render-এর ব্যাকএন্ডে পাঠিয়ে দেয় (netlify.toml দেখো),
// তাই ব্রাউজারে CORS সমস্যা হয় না।
export const API_BASE = '';
