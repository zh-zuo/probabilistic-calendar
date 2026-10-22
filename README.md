# Probabilistic Calendar

A week calendar where every event is a probability distribution instead of a fixed block.

**Live:** https://zh-zuo.github.io/probabilistic-calendar/ · original version: [/v1/](https://zh-zuo.github.io/probabilistic-calendar/v1/)

The page opens on a demo week. Click any event to edit it, add your own, or start from an empty week. Edits are stored only in your browser.

- **Distributions**: arrivals on a bell curve, a uniform window, or exact; durations right-skewed (meetings run long), symmetric, or fixed. Each event is a cloud of dots whose density is the chance you're there (3,000 Monte Carlo weeks).
- **Chained events**: "Dinner starts 20 ± 10 min after Climbing ends", so lateness propagates. The day-ends strip shows the chance each day is done by your bedtime.
- **Timing planner**: slide your plan earlier or later and see the chance you arrive or finish by a deadline; or ask "to be 90% sure, when do I start?"
- **Schrödinger blocks**: events with less than 100% chance of happening are free and busy at once until you click to open the box.
- **Invites**: copy a link that carries your arrival distribution; whoever opens it gets the event plus meet-up odds.
- **Conditions**: Rain, Monday blues, Deadline week, Double espresso, Friday feeling warp the distributions.
- **Observe / Play 100 universes**: sample concrete weeks and tally what collided.
- **Bets**: bet on your own week, settle bets afterwards, and compare your Brier score with the model's.

Single static `index.html`, no build step.
