/* ==========================================================================
   Cymru Compliance — site & portal configuration
   Leave both values empty to run the portal in DEMO MODE (sample data,
   stored in your own browser only — nothing is sent anywhere).
   To go live: create a free Supabase project (London region), run the SQL in
   /supabase, then paste the Project URL and the *anon public* key below.
   The anon key is designed to be public; security is enforced by the
   row-level-security rules in 01_schema.sql. NEVER paste the service_role key.
   ========================================================================== */
window.CC_CONFIG = {
  SUPABASE_URL: "",
  SUPABASE_ANON_KEY: ""
};
