# Graph Report - nexus  (2026-11-10)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 682 nodes · 1080 edges · 45 communities (15 shown, 30 thin omitted)
- Extraction: 89% EXTRACTED · 11% INFERRED · 0% AMBIGUOUS · INFERRED: 122 edges (avg confidence: 0.88)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `db7269c6`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Community 0
- Community 1
- Community 2
- Community 3
- Community 4
- Community 5
- Community 6
- Community 7
- Community 8
- Community 9
- Community 10
- Community 11
- Community 12
- Community 13
- Community 14
- Community 15
- Community 16
- Community 17
- Community 18
- Community 19
- Community 20
- Community 21
- Community 22
- Community 23
- Community 24
- Community 25
- Community 26
- Community 27
- Community 28
- Community 29
- Community 30
- Community 31
- Community 32
- Community 33
- Community 34
- Community 35
- Community 36
- Community 37
- Community 38
- Community 39

## God Nodes (most connected - your core abstractions)
1. `PrinterAgent` - 41 edges
2. `AudioLoop` - 33 edges
3. `FaceAuthenticator` - 28 edges
4. `KasaAgent` - 27 edges
5. `CadAgent` - 20 edges
6. `WebAgent` - 18 edges
7. `react` - 16 edges
8. `start_audio()` - 15 edges
9. `Printer` - 13 edges
10. `ProjectManager` - 13 edges

## Surprising Connections (you probably didn't know these)
- `TestCadAgentInit` --uses--> `CadAgent`  [INFERRED]
  tests/test_cad_agent.py → backend/cad_agent.py
- `TestCadGeneration` --uses--> `CadAgent`  [INFERRED]
  tests/test_cad_agent.py → backend/cad_agent.py
- `TestCadIteration` --uses--> `CadAgent`  [INFERRED]
  tests/test_cad_agent.py → backend/cad_agent.py
- `TestCadSystemPrompt` --uses--> `CadAgent`  [INFERRED]
  tests/test_cad_agent.py → backend/cad_agent.py
- `TestPrinterDiscovery` --uses--> `PrinterAgent`  [INFERRED]
  tests/test_printer_agent.py → backend/printer_agent.py

## Import Cycles
- None detected.

## Communities (45 total, 30 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.05
Nodes (10): get_input_devices(), get_output_devices(), CadAgent, capture_reference_face(), main(), verify(), MyListener, scan() (+2 more)

### Community 1 - "Community 1"
Cohesion: 0.05
Nodes (5): KasaAgent, main(), TestKasaColorConversion, TestKasaDeviceControl, TestKasaDiscovery

### Community 2 - "Community 2"
Cohesion: 0.05
Nodes (29): add_printer(), confirm_tool(), connect(), control_kasa(), disconnect(), discover_kasa(), discover_printers(), generate_cad() (+21 more)

### Community 4 - "Community 4"
Cohesion: 0.06
Nodes (8): WebAgent, TestCoordinateDenormalization, TestPlaywrightInstallation, TestWebAgentInit, TestWebAgentTask, TestWebBrowserLaunch, TestWebNavigation, TestWebScreenshot

### Community 5 - "Community 5"
Cohesion: 0.12
Nodes (20): lucide-react, react, App(), { ipcRenderer }, socket, AuthLock(), BrowserWindow(), CadWindow() (+12 more)

### Community 6 - "Community 6"
Cohesion: 0.07
Nodes (5): TestBuild123dImport, TestCadAgentInit, TestCadGeneration, TestCadIteration, TestCadSystemPrompt

### Community 8 - "Community 8"
Cohesion: 0.11
Nodes (7): kasa_devices(), printers(), sample_stl_content(), settings(), temp_dir(), main(), run_tests()

### Community 10 - "Community 10"
Cohesion: 0.13
Nodes (3): TestPrinterDiscovery, TestPrinterStatus, TestPrinterType

### Community 11 - "Community 11"
Cohesion: 0.15
Nodes (3): main(), PrinterType, probe()

### Community 13 - "Community 13"
Cohesion: 0.13
Nodes (15): dependencies, clsx@^2.1.0, framer-motion@^11.0.0, lucide-react@^0.300.0, react@^18.2.0, @react-three/drei@^9.99.0, @react-three/fiber@^8.15.16, socket.io-client@^4.7.4 (+7 more)

### Community 14 - "Community 14"
Cohesion: 0.13
Nodes (15): devDependencies, autoprefixer@^10.4.17, concurrently@^8.2.2, cross-env@^7.0.3, electron@^28.2.0, postcss@^8.4.35, tailwindcss@^3.4.1, wait-on@^7.2.0 (+7 more)

### Community 15 - "Community 15"
Cohesion: 0.17
Nodes (5): { app, BrowserWindow, ipcMain }, checkBackendPort(), path, { spawn }, waitForBackend()

### Community 18 - "Community 18"
Cohesion: 0.20
Nodes (9): author, three@^0.160.0, description, keywords, license, main, name, version (+1 more)

### Community 35 - "Community 35"
Cohesion: 0.40
Nodes (4): vite@^5.1.0, @vitejs/plugin-react@^4.2.1, vite, @vitejs/plugin-react

### Community 36 - "Community 36"
Cohesion: 0.50
Nodes (4): scripts, build, dev, start

## Knowledge Gaps
- **30 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `PrinterAgent` connect `Community 7` to `Community 0`, `Community 34`, `Community 3`, `Community 10`, `Community 11`, `Community 16`, `Community 17`, `Community 21`, `Community 29`?**
  _High betweenness centrality (0.152) - this node is a cross-community bridge._
- **Are the 15 inferred relationships involving `PrinterAgent` (e.g. with `AudioLoop` and `TestPrinterAgentInit`) actually correct?**
  _`PrinterAgent` has 15 INFERRED edges - model-reasoned connections that need verification._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.05179982440737489 - nodes in this community are weakly interconnected._
- **Why does `AudioLoop` connect `Community 3` to `Community 0`, `Community 1`, `Community 2`, `Community 4`, `Community 7`, `Community 19`, `Community 24`, `Community 31`?**
  _High betweenness centrality (0.138) - this node is a cross-community bridge._
- **Are the 9 inferred relationships involving `AudioLoop` (e.g. with `CadAgent` and `KasaAgent`) actually correct?**
  _`AudioLoop` has 9 INFERRED edges - model-reasoned connections that need verification._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.050816696914700546 - nodes in this community are weakly interconnected._
- **Why does `KasaAgent` connect `Community 1` to `Community 0`, `Community 2`, `Community 3`?**
  _High betweenness centrality (0.116) - this node is a cross-community bridge._