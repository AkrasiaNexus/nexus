# EcoSphere pre-deploy checklist

Claude: when the user asks to deploy EcoSphere (app or website), walk them through this list FIRST and get each item ticked or explicitly skipped.

## Scanner real-world accuracy
- [ ] **Real-world photo test.** Take 50–100 photos of real waste around school/home on your phone and send them to Claude. That's the only honest real-world test; Claude reports the per-bin score on those before launch.
- [ ] **Expectations.** Day one will likely be good but not perfect. With the corrections loop (users tap the right bin when it's wrong) running, accuracy keeps climbing as people use it. Retrain from corrections periodically.
- [ ] **Bigger model fallback.** If it's still not good enough after that, there's a bigger model option: more accurate, but the first download is ~3–4× heavier on phones. Only switch if the numbers say we need it.

## Other open items
- [ ] Delete the old Sydney Supabase project.
- [ ] Mumbai Supabase Auth URL config: Site URL + Redirect URLs set to the real domain (not localhost).
- [ ] Turn on "Secure password change" in Supabase Auth.
- [ ] Website finishing touches done (user said: no deploy until then); landing CTAs point at real routes.
