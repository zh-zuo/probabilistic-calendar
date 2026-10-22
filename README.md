# Probabilistic Calendar

A week calendar where every event is a probability distribution instead of a fixed block.

**Live:** https://zh-zuo.github.io/stochastic-calendar/

- **Arrival times** follow a bell curve (18:30 ± 15 min), a uniform window (sometime 20:00–21:00), or are exact.
- **Durations** can be right-skewed (log-normal: meetings run long), symmetric, or fixed.
- Each event is drawn as a cloud of dots; dot density is the probability you're in that event at that minute (3,000 Monte Carlo weeks per event).
- Hover any minute to see where you probably are, and the probability you're free.
- **Collision risk** lists the chance that two events overlap on a shared day.
- **Observe the week** samples one concrete week and reports what actually collided.

Single static `index.html`, no build step. Edits are saved in your browser's localStorage.
