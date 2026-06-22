/* ============================================================
   auth.js — shared Supabase auth + game-state save/load + Resend emails
   Used by: account.html, game.html (and any other page that
   wants to know if a user is logged in)
   ============================================================ */

(function () {
  // supabase-js loaded via CDN script tag (see <head> of each page)
  const sb = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_KEY);
  window.sbClient = sb;

  /* ---------- session helpers ---------- */

  async function getSession() {
    const { data, error } = await sb.auth.getSession();
    if (error) { console.error('getSession error', error); return null; }
    return data.session;
  }

  async function getUser() {
    const session = await getSession();
    return session ? session.user : null;
  }

  async function signUp(email, password) {
    return sb.auth.signUp({ email, password });
  }

  async function signIn(email, password) {
    return sb.auth.signInWithPassword({ email, password });
  }

  async function signOut() {
    return sb.auth.signOut();
  }

  async function resetPasswordForEmail(email, redirectTo) {
    return sb.auth.resetPasswordForEmail(email, { redirectTo });
  }

  async function updatePassword(newPassword) {
    return sb.auth.updateUser({ password: newPassword });
  }

  function onAuthChange(callback) {
    sb.auth.onAuthStateChange((_event, session) => callback(_event, session));
  }

  /* ---------- game progress save / load ----------
     Table: game_progress
       user_id   uuid   (references auth.users, primary key)
       state     jsonb  (the full game state blob)
       updated_at timestamptz default now()
  ------------------------------------------------- */

  async function saveProgress(stateObj) {
    const user = await getUser();
    if (!user) return { error: 'not_logged_in' };
    const { error } = await sb
      .from('game_progress')
      .upsert({ user_id: user.id, state: stateObj, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
    if (error) console.error('saveProgress error', error);
    return { error };
  }

  async function loadProgress() {
    const user = await getUser();
    if (!user) return { data: null, error: 'not_logged_in' };
    const { data, error } = await sb
      .from('game_progress')
      .select('state')
      .eq('user_id', user.id)
      .maybeSingle();
    if (error) console.error('loadProgress error', error);
    return { data: data ? data.state : null, error };
  }

  /* ---------- Resend email sending ----------
     Send emails via Resend API
     Requires: window.RESEND_API_KEY set in HTML <head>
     
     Add this to your HTML:
     <script>
       window.RESEND_API_KEY = 're_your_actual_key_here';
     </script>
  ------------------------------------------------- */

  async function sendEmail(toEmail, subject, message) {
    const apiKey = window.RESEND_API_KEY;
    
    if (!apiKey) {
      console.error('RESEND_API_KEY not found. Add to your HTML <head>: window.RESEND_API_KEY = "your_key"');
      return { error: 'API key missing' };
    }
    
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + apiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: 'onboarding@resend.dev',
          to: toEmail,
          subject: subject,
          html: message
        })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        console.error('Resend API error:', data);
        return { error: data.message || 'Failed to send email' };
      }
      
      console.log('Email sent successfully:', data);
      return { data, error: null };
    } catch (err) {
      console.error('sendEmail error:', err);
      return { error: err.message };
    }
  }

  /* ---------- admin dashboard ----------
     ADMIN_EMAIL must match the email used in the SQL policies
     in supabase-setup.sql ("Admin can view all progress" and
     "Admin can view visits"). Change it in BOTH places.
  --------------------------------------- */
  const ADMIN_EMAIL = 'umaryusuf8681@gmail.com'; // <-- set this to your real admin email

  async function isAdmin() {
    const user = await getUser();
    return !!user && user.email === ADMIN_EMAIL;
  }

  async function logVisit(page) {
    try {
      await sb.from('site_visits').insert({ page: page || window.location.pathname });
    } catch (e) {
      // Visit logging is best-effort and should never break the page.
      console.warn('logVisit failed (non-fatal):', e);
    }
  }

  // Returns every row in game_progress, joined with each user's email.
  // Only succeeds for the admin account — RLS blocks everyone else,
  // so this will simply return an empty/blocked result for non-admins.
  async function adminGetAllProgress() {
    const { data, error } = await sb
      .from('game_progress')
      .select('user_id, state, updated_at')
      .order('updated_at', { ascending: false });
    if (error) console.error('adminGetAllProgress error', error);
    return { data: data || [], error };
  }

  async function adminGetVisitStats() {
    const { data, error } = await sb
      .from('site_visits')
      .select('page, visited_at')
      .order('visited_at', { ascending: false })
      .limit(5000);
    if (error) console.error('adminGetVisitStats error', error);
    return { data: data || [], error };
  }

  async function adminGetAllUserEmails() {
    const { data, error } = await sb
      .from('user_emails')
      .select('user_id, email, created_at');
    if (error) console.error('adminGetAllUserEmails error', error);
    return { data: data || [], error };
  }

  window.Auth = {
    getSession,
    getUser,
    signUp,
    signIn,
    signOut,
    resetPasswordForEmail,
    updatePassword,
    onAuthChange,
    saveProgress,
    loadProgress,
    sendEmail,
    isAdmin,
    logVisit,
    adminGetAllProgress,
    adminGetVisitStats,
    adminGetAllUserEmails,
  };
  window.AUTH_JS_VERSION = '2026-06-21-3'; // fixed Resend to work without Vite
})();