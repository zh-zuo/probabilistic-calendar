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

Consequences you should know about:

- After learning, arrival becomes **Gaussian** and duration **lognormal**, whatever shape the plan had.
- The forecast uses the point estimates μ̂ and σ̂, not a posterior predictive distribution. With few logs, the uncertainty in μ̂ itself is ignored, so intervals are somewhat too narrow.
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
- `.ics` import handles a weekly rule with a skipped date, a one-off with a duration, and skips all-day events;
- `calendar.json` leaves out private events and round-trips.

## 6. Not yet validated

- **Calibration**: whether events the app gives 80% to finish on time actually do so 80% of the time. The plan is to score each logged occurrence against a forecast made only from logs before that date (a chronological holdout), reporting interval coverage and CRPS.
- **Calendar import**: `TZID` times are read as local clock time, monthly and yearly repeats are skipped, and changed single occurrences (`RECURRENCE-ID`) are ignored. Import is a one-time snapshot, not a sync.
- Correlations other than shared lateness and explicit "after" links are not modelled.
