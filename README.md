# Probabilistic Calendar

<p align="center">
  <a href="https://zh-zuo.github.io/probabilistic-calendar/"><img src="media/hero.png" alt="Probabilistic Calendar: open the live app" width="100%"></a>
</p>

<p align="center">
  <a href="https://zh-zuo.github.io/probabilistic-calendar/"><img src="https://img.shields.io/badge/%E2%96%B6%20Try%20it%20live-zh--zuo.github.io%2Fprobabilistic--calendar-2F47C9?style=for-the-badge" alt="Try it live"></a>
</p>

A week calendar where every event is a probability distribution instead of a fixed block. It runs entirely in your browser: no sign-up, and your data never leaves your device.

## Demo

<p align="center">
  <a href="media/demo.mp4"><img src="media/demo.gif" alt="Demo: hovering the probability clouds, toggling conditions, opening a Schrödinger block, sliding the timing planner, observing universes and playing 100 universes" width="100%"></a>
</p>
<p align="center"><sub>Hover for live odds · toggle conditions · open a Schrödinger block · slide the timing planner · observe a universe · play 100 universes. <a href="media/demo.mp4">Full-quality MP4</a>.</sub></p>

<p align="center"><img src="media/universes.png" alt="One Thursday as a probability cloud and as six sampled universes" width="100%"></p>

## Features

The [live app](https://zh-zuo.github.io/probabilistic-calendar/) opens on a demo week. Click any event to edit it, add your own, or start from an empty week. The [original version](https://zh-zuo.github.io/probabilistic-calendar/v1/) is kept at `/v1/`.

- **Distributions**: arrivals on a bell curve, a uniform window, or exact; durations right-skewed (meetings run long), symmetric, or fixed. Each event is a cloud of dots whose density is the chance you're there (3,000 Monte Carlo weeks).
- **Chained events**: "Dinner starts 20 ± 10 min after Climbing ends", so lateness propagates. The day-ends strip shows the chance each day is done by your bedtime.
- **Timing planner**: slide your plan earlier or later and see the chance you arrive or finish by a deadline; or ask "to be 90% sure, when do I start?"
- **Schrödinger blocks**: events with less than 100% chance of happening are free and busy at once until you click to open the box.
- **Invites**: copy a link that carries your arrival distribution; whoever opens it gets the event plus meet-up odds.
- **Conditions**: Rain, Monday blues, Deadline week, Double espresso, Friday feeling warp the distributions.
- **Observe / Play 100 universes**: sample concrete weeks and tally what collided.
- **Bets**: bet on your own week, settle bets afterwards, and compare your Brier score with the model's.

Single static `index.html`, no build step.

## License

MIT. See [LICENSE](LICENSE).
