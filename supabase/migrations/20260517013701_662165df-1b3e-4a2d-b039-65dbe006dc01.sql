
-- Revoke EXECUTE from anon/authenticated on SECURITY DEFINER functions that
-- should never be invoked directly by clients. Triggers, the service role,
-- and the function owner can still run them.

-- Trigger-only functions
REVOKE EXECUTE ON FUNCTION public.auto_update_request_status() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.prevent_note_edit_when_completed() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.auto_populate_review_statuses() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.guard_review_request_columns() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.validate_password_reset_token() FROM PUBLIC, anon, authenticated;

-- Queue helpers — only the service role / edge functions need these
REVOKE EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.delete_email(text, bigint) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) FROM PUBLIC, anon, authenticated;

-- has_role and is_team_member are intentionally kept executable by
-- authenticated so RLS policies that call them continue to work.
