-- Supabase grants EXECUTE on new public functions to anon/authenticated by default.
-- award() must only run inside the vetted RPCs (it trusts its arguments), so remove that grant explicitly.
revoke execute on function award(uuid, int, text, text) from anon, authenticated, public;
revoke execute on function audit_append_only() from anon, authenticated, public;
-- Future functions start locked; each RPC is granted to authenticated deliberately.
alter default privileges in schema public revoke execute on functions from anon, authenticated, public;
