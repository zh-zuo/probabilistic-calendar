# The model behind Probabilistic Calendar

This page says exactly what the app computes, and which parts are principled and which are heuristics. The code is in `index.html`; the tests in `tests/` check the properties listed under *What is tested*.

## 1. Plans

Each event stores a **plan**, which never changes unless you edit it:

| Part | Options | Parameters |
|---|---|---|
| Arrival | Gaussian | centre μ, spread σ |
| | Skewed | typical time μ (the median), spread ω, skew k ∈ [−1, 1] |
| | Uniform | earliest, latest |
| | Exact | time |
| | After another event | parent, gap g, gap spread σ_g, gap skew, what to do if the parent does not happen, fallback time |
| Duration | Lognormal ("usually runs long") | median m, log-spread s |
| | Normal | mean m, σ (truncated at 1 min) |
| | Fixed | minutes |
| Existence | probability it happens, p ∈ (0, 1] | — |

**Skewed** uses a skew-normal with shape α = 6k, shifted so that its **median** is exactly μ. Its spread parameter ω is a scale, not the standard deviation.

**Learned predictions** (section 4) are stored separately from the plan, and you can switch them off per event. "Exact 11:00" stays the plan even if you usually arrive at 11:07; the prediction is what the clouds, odds and planner use.

## 2. Simulating a day

For each date, the app draws N = 2,500 joint samples of the whole day. In each sample *i*:

1. **Shared lateness** (optional, off by default): one offset δᵢ ~ Normal(0, σ_day²) is drawn for the day and added to the start of every event that has its own time (not Exact, not chained). This makes events on the same day late together; with σ_day equal to an event's own σ, two events' starts have correlation 0.5.
2. Events are processed in dependency order. For each event:
   - It **happens** with probability p (or always, if you logged it; or as decided, if you opened its Schrödinger box). A chained event set to *skip this too* happens only if its parent happened in the same sample.
   - **Start**: chained events start at parent end + max(0, gap), where the gap is drawn from its own (optionally skewed) distribution; if the parent did not happen, they use their fallback time. Other events draw from their arrival shape, plus δᵢ.
   - **Duration** is drawn from its distribution.
   - **Conditions** (Rain, Deadline week, and so on) are fixed transformations of the parameters: they shift arrivals, scale the spread, and scale durations. They are not learned.
3. If you logged an arrival or a finish, the sample uses the logged value. If you logged an arrival today and the event has not finished, the duration is redrawn until the event is still running at the current time ("it's still going").

Random numbers are seeded by the date, so the picture does not flicker between redraws.

## 3. What the app reports

All of these are Monte Carlo estimates from the samples in section 2:

- **Cloud density**: the fraction of samples in which the event is in progress at the centre of each 5-minute bin (a difference array over sampled intervals). It is a probability, between 0 and 1.
- **Collision risk**: the fraction of samples in which both events happen and their intervals overlap.
- **Timing planner and bets**: the empirical CDF of the sampled start or finish time, evaluated at your deadline. Shifting the plan by Δ shifts the samples by Δ.
- **Day ends**: the distribution of the latest finish time in the day.

Monte Carlo error is at most √(p(1−p)/N) ≈ 1 percentage point at N = 2,500.

## 4. Learning from your logs

This is a **heuristic shrinkage estimator**, not a full Bayesian model.

For an event with plan centre μ₀ and spread σ₀, and n logged arrival times with mean x̄ and sum of squares SS:

- μ̂ = (k μ₀ + n x̄) / (k + n), with k = 3 pseudo-observations;
- σ̂² = (k σ₀² + SS + (k n / (k + n)) (x̄ − μ₀)²) / (k + n).

Durations are learned the same way on the log scale, starting from the planned median and spread. For chained events, the gap after the parent is learned instead of the arrival time, from days where both were logged.

The forecast then widens the spread by the posterior-predictive factor √(1 + 1/(k + n)), which accounts for the uncertainty in μ̂ itself (for a normal model with known variance, the predictive variance is σ²(1 + 1/(k + n))). σ̂ is still a point estimate, so with few logs the intervals remain a little too narrow; see section 6.

Consequences you should know about:

- After learning, arrival becomes **Gaussian** and duration **lognormal**, whatever shape the plan had.
- Learning is **marginal**: it cannot learn that you are late only when it rains, or only on Mondays.
- Days you forget to log are missing, and if the days you remember are unusual, the estimate is biased.

## 5. What is tested

`node --test 'tests/*.test.js'` runs the app's own script under Node and checks:

- occupancy is exactly 1 inside and 0 outside a fixed event, stays within [0, 1] for the whole demo week, and integrates to the mean duration;
- the collision probability of a fixed event and a Gaussian one matches the analytic value Φ(1) ≈ 0.841;
- skewed arrivals keep their median at the typical time, with the tail on the chosen side;
- chained events never start before their parent ends, and *skip this too* events never happen without their parent;
- circular or dangling "after" links are repaired instead of hanging;
- shared lateness gives the expected correlation (0 when off, 0.5 when σ_day equals σ);
- learning reproduces the shrinkage formula;
- CRPS matches its closed forms; logs drawn from the plan itself come out calibrated; learning beats the plan when the real timing differs;
- *Find a time* reports 100% clear on an empty week and 0% inside a fully booked window;
- `.ics` import handles a weekly rule with a skipped date, a one-off with a duration, and skips all-day events;
- `calendar.json` leaves out private events and round-trips.

## 6. Calibration: checked on your own logs

The **Can you trust the odds?** panel runs a chronological holdout over your logs: every logged arrival and finish is forecast again using only logs from earlier dates (with conditions and opened boxes switched off), and compared with what happened. It reports:

- **80% interval coverage**: the share of outcomes inside the central 80% range. A calibrated forecast gives about 80%; the panel calls it calibrated when coverage is within the 95% binomial band 0.8 ± 1.96·√(0.16/n), and only after about 10 scored outcomes.
- **PIT histogram**: where each outcome fell within its forecast distribution. Flat means calibrated, U-shaped means overconfident, sloped means biased.
- **CRPS** (continuous ranked probability score, in minutes; lower is better), with learning and with the plan alone. CRPS = E|X − y| − ½E|X − X′| for forecast X and outcome y, computed from the samples.

**Measured on simulated data.** *Try with simulated logs* generates four weeks of logs from a "true you" who arrives about 12 minutes later than planned, with 30% more scatter, 20% longer durations, shared daily lateness of 8 minutes, and 20% of days unlogged. Averaged over 12 such runs on the demo week:

| | 80% coverage, all dates | 80% coverage, last 2 weeks | CRPS (min) |
|---|---|---|---|
| Plan alone | 52.7% ± 1.4 | 54.3% ± 1.7 | 21.5 |
| Learning, plug-in spread | 68.4% ± 0.9 | 69.7% ± 2.0 | 17.8 |
| Learning, predictive spread (current) | 72.0% ± 1.0 | 75.1% ± 1.5 | 17.8 |

(± is the standard error over the 12 runs; CRPS varies by about ±0.5 min between batches.) The plan alone is badly overconfident against this "true you". Learning cuts the forecast error by about a fifth, and the predictive widening brings coverage closer to 80% at no cost in CRPS. The remaining shortfall comes from early dates with few logs, where the plan's too-narrow spread still carries weight. The tests check that logs drawn from the plan itself come out calibrated (coverage 80% ± 5 points over 480 outcomes), and that learning beats the plan when the two differ.

## 7. Not yet validated
- **Calendar import**: `TZID` times are read as local clock time, monthly and yearly repeats are skipped, and changed single occurrences (`RECURRENCE-ID`) are ignored. Import is a one-time snapshot, not a sync.
- Correlations other than shared lateness and explicit "after" links are not modelled.
