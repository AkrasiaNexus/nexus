# EcoSphere pre-deploy checklist

Claude: when the user asks to deploy EcoSphere (app or website), walk them through this list FIRST and get each item ticked or explicitly skipped.

## Scanner real-world accuracy
- [ ] **Real-world photo test.** Take 50–100 photos of real waste around school/home on your phone and send them to Claude. That's the only honest real-world test; Claude reports the per-bin score on those before launch.
- [ ] **Expectations.** Day one will likely be good but not perfect. With the corrections loop (users tap the right bin when it's wrong) running, accuracy keeps climbing as people use it. Retrain from corrections periodically: `npx tsx scripts/retrain-scanner.mts` (see docs/SCANNER.md).
- [ ] **Bigger model fallback.** If it's still not good enough after that, there's a bigger model option: more accurate, but the first download is ~3–4× heavier on phones. Only switch if the numbers say we need it.

- [ ] **Consent for minors.** The scanner's "Help the scanner learn" box is ON by default (per device, user can untick). Decide with the school whether it should default OFF for under-13s or need parent/school consent (e.g. India's DPDP Act), and add a line to the privacy page (/legal) about scan fingerprints (linked to account, deleted after 180 days).
- [ ] Apply migration `0011_scan_feedback.sql` to the production database (already applied to the Mumbai dev project).

## Other open items
- [ ] Delete the old Sydney Supabase project.
- [ ] Mumbai Supabase Auth URL config: Site URL + Redirect URLs set to the real domain (not localhost).
- [ ] Turn on "Secure password change" in Supabase Auth.
- [ ] Website finishing touches done (user said: no deploy until then); landing CTAs point at real routes.
