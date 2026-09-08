# Help & Glossary — Draft Copy (Kaching Weekly Income)

Written in original wording, but with real conceptual substance —
concrete numbers and rules, grounded in what this app's own engine
actually does (WeeklyIncomeDiagonalBuilder / KaChingLifecycleService),
plus standard, industry-wide options-education concepts (Greeks, DTE,
assignment) that aren't exclusive to any one source. Deliberately still
avoids the specific book's wording, analogies, and worked-example
narratives (SCHW/CHWY/YETI) — those remain copyright-restricted; the
underlying method and numbers are not.

---

## What is the Kaching Weekly Income Strategy?

This is a two-leg options position built on a single stock, designed to
generate income on a recurring, weekly basis:

- **One long-dated put, bought once.** This is the "insurance" leg — it
  puts a floor under how much you can lose if the stock drops
  significantly. It's bought roughly 90–150 days out (this app targets
  ~120 days specifically), so it doesn't need to be replaced often.
- **One short-dated put, sold weekly.** This is the "income" leg — sold
  fresh every week, expiring in about 5–12 days. Most weeks it simply
  expires worthless, and you keep the money you were paid for selling
  it.

The two legs work together: the weekly leg is what pays you, and the
long-dated leg is what keeps a bad week from turning into a disaster.
As long as the long-dated leg is in place, you can keep selling a new
weekly leg indefinitely.

## The actual numbers this app uses

- **Long leg (insurance): 90–150 days to expiration**, targeting ~120
  days specifically, at roughly a **25% delta** — meaning the option is
  priced as if it has roughly a 25% chance of ending up valuable.
  Lower delta = cheaper insurance, but less protection; higher delta
  costs more but protects more.
- **Short leg (income): 5–12 days to expiration.** The strike sold
  depends on how the stock is trending: closer to the current price
  (higher delta, more premium, more risk) when the trend looks
  favorable, further away (lower delta, less premium, less risk) when
  it doesn't.
- **Position sizing:** keeping any single position to a small slice of
  the total account (commonly cited around 3–5%) means no single trade
  going wrong can meaningfully damage the whole account.

## What happens week to week

Most weeks are uneventful by design: the short put expires worthless,
you keep the premium, and you sell a new one for the following week.

Two things can happen that call for an adjustment, both totally normal
and expected, not signs of a problem:

- **The stock drops and the short put is now in danger of finishing
  in-the-money.** The usual response is to buy back that put (at a
  loss on that leg alone) and immediately sell a new one further out —
  called **rolling**. The premium from the new sale is generally enough
  to offset most or all of the loss from closing the old one, and the
  long-dated insurance leg is simultaneously gaining value to help
  offset the damage too.
- **The stock jumps and the short put quickly loses most of its value.**
  If the short leg's delta drops below the long leg's delta, it's
  usually not worth holding onto for the rest of the week just to
  collect the last few cents of premium — this app calls that
  situation "ready to double dip": close the now-cheap short put early
  and immediately sell a new one, effectively collecting two weeks of
  premium in a single week.

## Glossary — terms you'll see on this site

| Term | What it means |
|---|---|
| **Strike** | The specific price written into an option contract. |
| **Premium** | The price paid (or received) for an option contract. |
| **DTE** | "Days to expiration" — how many days remain before a contract expires. |
| **Delta** | Roughly, the odds an option ends up valuable, and how much its price moves per $1 move in the stock. A 25-delta option behaves like it has roughly a 25% chance of finishing valuable. |
| **Theta** | How much value an option loses purely from time passing, even with no price movement. This is the mechanism that makes selling short-dated options for income work at all — you're being paid for time decay. |
| **Gamma** | How fast Delta itself changes as the stock moves. Highest for options trading right at the current stock price. |
| **Vega** | How sensitive an option's price is to changes in implied volatility (see IV Rank below). |
| **IV Rank** | Whether options on this stock are currently expensive or cheap to trade, *relative to that same stock's own recent history* — not compared to other stocks. |
| **Assignment** | What happens if you've sold a put and the buyer exercises it — you're required to buy the shares at the strike price. Can happen anytime after selling, though it's most common near expiration when the option is meaningfully in-the-money. |
| **Rolling** | Closing this week's short put early and opening a new one — a routine, planned adjustment, not an emergency measure. |
| **Double dip** | When the weekly short put loses most of its value early (the stock rallied), closing it early and selling a fresh one — collecting two premiums from the same underlying position in one week. |
| **Laggard** | A stock that's underperformed the broader market recently. Often the starting point for a new candidate, since a laggard that's stabilizing can make a good setup. |
| **RSI** | A common technical indicator measuring whether a stock has recently been oversold or overbought. |
| **KACHING PUT** | This site's label for "a strong candidate to open a new position on, right now." |
| **WATCH** | Promising, but not quite meeting the bar for a fresh entry yet. |
| **WAIT** | Not currently an attractive candidate. |
| **TOO EXTENDED** | The stock has already moved up a lot recently — a new entry today would be chasing a move that's largely already played out. |
| **FALLING KNIFE** | Cheap, but still actively dropping with no sign of stabilizing — a warning, not a buy signal. |

## Disclaimer

Everything on this site is for informational and educational purposes
only. It is not financial advice, and nothing here is a recommendation
to buy or sell any security. Options trading carries real risk,
including the risk of loss. Always do your own research and consider
speaking with a licensed financial professional before trading.
