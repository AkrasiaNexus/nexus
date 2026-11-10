# Verdict

A browser extension concept that audits online checkouts as you shop. It catches dark patterns (fake timers, drip pricing, pre-ticked add-ons, free-trial traps), shows the real total in hours of work, checks whether a "deal" is actually a deal, and explains each trick so you learn to spot it yourself. Built for a financial-literacy club.

**Live demo:** https://claude.ai/artifact/SreKDLXgPY81yz7Q7bYefY

> **Status: interactive demo.** `demo.html` simulates the extension on two fake shops with made-up figures. The real extension isn't built yet.

## The demo

Open `demo.html`, pick a shop, and flip the **Verdict** switch.

| Shop | Tricks Verdict flags |
|---|---|
| Northbay (electronics checkout) | Fake countdown timer, pre-ticked AED 29 protection plan, AED 36 of fees held back until the last step |
| Bloomly (subscription sign-up) | Fake scarcity, a "free" trial that renews at AED 59/month, data sharing with 14 partners pre-ticked, a guilt-trip decline button |

When Verdict is on, the panel shows:
- **True-cost x-ray:** removed add-ons, revealed fees, the real total, and that total in hours of part-time work
- **Deal checker:** a 90-day price history showing the "was" price was never charged
- **Trial radar:** the day you get charged and the cost of the first year if you forget
- **Privacy meter:** which data gets shared, and with how many partners
- **Tips** that teach the pattern, not just the fix

## Tech

One self-contained HTML/CSS/JS file with no framework.

## Roadmap

- [ ] Chrome Manifest V3 extension with content-script detectors for each pattern
- [ ] Price history source for the deal checker
- [ ] "Teach mode" lessons and a tricks-caught counter
- [ ] Field test with club members, tracking money saved

## Brand

Ink `#0B1220`, "honest" green `#19E39A`, "flagged" red `#FF5A5F`. Fonts: Sora, Manrope, JetBrains Mono.

## License

MIT. See [LICENSE](LICENSE).
