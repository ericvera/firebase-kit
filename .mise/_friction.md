# Friction

requirements: goals bootstrap phase 1 ("push to main") is unexecutable under the repo's own `.mise/` guard and the CLAUDE.md never-merge rule — the contradiction survived the goals gate
requirements: goals fixed placeholder version at `0.0.1` while also requiring the first real release be `1.0.0`; conventional-changelog cannot bridge those, so an approved goal was mechanically impossible
requirements: goals recorded scdate as the template for dependabot auto-merge and for provenance without checking what scdate actually does — scdate auto-merges npm majors and has no provenance at all
critic requirements: round 2 found a false claim I had just added to goals (phase-1 push "runs the emulator tests") — writing an unverified upside into an artifact cost a second gate trip
critic requirements: round 3 disproved a fact the whole verification method rested on — npm pack does NOT rewrite the workspace: protocol, only Yarn's packer does; the mise-config test exception had prescribed `npm pack` and would have produced uninstallable tarballs every time
