# Sources

**Status:** written by lane D (B62) on Saturday 14 November 2026, about 23:00 to 23:59. "Opened" means the page was fetched and the quoted wording was read on it. Quotes are short excerpts, verbatim as fetched. A figure may go in the pitch, the UI or Devpost only if its row here says **usable**.
**Related:** [Spec §1](SPEC.md) · [Validation §5 and §6](VALIDATION.md) · [Claims](CLAIMS.md) · [Pitch](PITCH.md)

How to read the verdicts:

- **Usable:** an opened source says it, and the pitch must say it the way the source does (including who said it).
- **Usable with change:** an opened source supports a corrected form of the figure. Use the corrected form only.
- **Not usable:** no source opened, or the source does not say it.

## 1. Figures from the idea brief (SPEC §1, VALIDATION §6)

### S1. "BRTA estimates over 60 lakh battery-run rickshaws, 10 to 12 lakh of them in Dhaka"

- **Source opened:** UNB, "Tougher policy soon to regulate battery-run rickshaws in Bangladesh", republished by The Business Standard, 8 August 2025. <https://www.tbsnews.net/bangladesh/tougher-policy-soon-regulate-battery-run-rickshaws-bangladesh-1207206>
- **Wording:** "the Bangladesh Road Transport Authority (BRTA) estimates that there are over 60 lakh battery-run rickshaws" … "with 10 to 12 lakh operating in Dhaka alone."
- **Verdict: usable**, attributed: "BRTA estimates, reported by UNB in August 2025". It is an estimate. Other official estimates differ: the Home Minister gave "approximately five to eight million" (50 to 80 lakh) in Parliament in September 2026 (S3). Do not present any count as exact.

### S2. "In August, demand was 16,059 MW against 12,388 MW of supply, a 3,671 MW deficit"

- **Source opened:** The New Nation (editorial), 11 August 2026, citing the Power Grid Company of Bangladesh (PGCB). <https://dailynewnation.com/news/848597>
- **Wording:** "The PGCB further said electricity demand stood at 16,059 megawatts at 3pm on Sunday" … "supply was only 12,388 megawatts, resulting in a deficit of 3,671 megawatts."
- **Verdict: usable with change.** It is a one-hour reading, not a monthly figure: "at 3 pm on Sunday 9 August 2026, PGCB reported demand of 16,059 MW against 12,388 MW supplied". Say "one afternoon in August", not "in August". The Daily Observer carried the same figures (<https://observerbd.com/news/587300>, refused our fetch with HTTP 403, so not opened). The figure is about the national supply shortage. TRICKLE does not address that, and the claims ledger forbids implying it does.

### S3. "The Home Minister told Parliament that illegal charging costs around Tk 4,000 crore a year"

- **Source opened:** The Financial Express, "Auto-rickshaws cause Tk 40b revenue loss yearly: Home Minister", 8 September 2026. <https://thefinancialexpress.com.bd/national/auto-rickshaws-cause-tk-40b-revenue-loss-yearly-home-minister>
- **Wording:** Home Minister Salahuddin Ahmed, in Parliament on Monday (7 September 2026), replying to a notice from MP Rehana Akhter Ranu: "causing a revenue loss of the government of around Tk 40 billion annually"; the article's lead gives "Tk 40 billion (4,000 crore)". The same report: "approximately five to eight million electric three-wheelers are currently operating"; legal charging points "only around 3,300"; "over 48,000 informal or illegal charging points exist in Dhaka alone".
- **Verdict: usable**, as "the Home Minister told Parliament in September 2026 that illegal charging costs the government about Tk 4,000 crore a year in revenue". It is a government estimate of lost revenue, not of grid damage. Dhaka Tribune and BSS carry the same statement but refused our fetch (HTTP 403), so they are not opened.

### S4. "The government is moving to register the vehicles"

- **Sources opened:**
  - UNB via TBS, 8 August 2025 (S1 link): under a draft policy, "all battery-operated three-wheelers must be registered with the Bangladesh Road Transport Authority (BRTA)", "as per the Electric Motor Vehicle Registration and Operation Policy 2023".
  - pv magazine, "Bangladesh mandates solar charging for millions of electric rickshaws", Syful Islam, 21 August 2026. <https://www.pv-magazine.com/2026/08/21/bangladesh-mandates-solar-charging-for-millions-of-electric-rickshaws/> Mir Shahe Alam, State Minister for Local Government: "To get registered, these auto-rickshaws will have to charge their batteries with solar power."
- **Verdict: usable**, as "the government says it is bringing them under registration". We found no confirmation that a final policy has been gazetted, so do not say registration is in force. Note for the pitch: the government's own stated plan ties registration to how the vehicles charge. That supports the "charging standard" policy argument, but it is still an argument.

### S5. "Night charging overloads local transformers and is left out of load forecasts, according to officials"

- **Source opened:** Prothom Alo English, "Power shortages at midnight, more load-shedding in rural areas", 28 June 2026. <https://en.prothomalo.com/bangladesh/e4s0883p85>
- **Wording:** Md Zahurul Islam, member (Generation), Bangladesh Power Development Board: "Previously, electricity demand fell by around 3,000 megawatts after midnight. Now it declines by only about 1,000 megawatts." Unnamed "people associated with the power sector" believe "the widespread charging of electric rickshaw batteries across the country contributes to the higher demand."
- **Verdict: partly usable.** Usable: "a BPDB official said night-time demand now falls by about 1,000 MW after midnight instead of about 3,000 MW, and people in the power sector link this to rickshaw charging." **Not usable:** "overloads local transformers" and "left out of load forecasts". We found these claims only in search snippets (a Dhaka Tribune report quoting an anonymous senior DESCO official, and an interview citing a Khulna study of a 250 kVA transformer), and those pages refused our fetch or were PDFs we could not read. Do not say either until someone opens a source.
- **Related, opened (S3 link):** the Home Minister's statement that the government estimates the vehicles use about 5% of electricity generation. pv magazine (S4 link) gives "roughly 800 MW to 1 GW, about 5% of national generation". Usable with attribution.

### S11. "Mobile internet was shut down across Bangladesh in July 2024"

- **Source opened:** Wikipedia, "2024 Bangladesh internet blackouts" (read 15 November 2026). <https://en.wikipedia.org/wiki/2024_Bangladesh_internet_blackouts>
- **Wording:** It quotes Cloudflare Radar: "Bangladesh is experiencing a near complete #Internet outage after a government-ordered shutdown of mobile networks." The nationwide shutdown began on 18 July 2024. Broadband returned on 24 July and mobile internet on 28 July.
- **Verdict: usable with attribution**, as "mobile internet was shut down nationwide for about ten days in July 2024". This is a secondary source; a news report or the Cloudflare Radar post should be opened before Devpost. Used as the first outage reason in the demo (`OUTAGE_REASONS` in `src/ui/app.ts`). Say it neutrally: it is an example of a network outage, not a political point.
- **Not sourced:** "load-shedding drains mobile towers' backup batteries", the second outage reason. It is plausible but no source has been opened, so the demo labels the 30-minute backup a model assumption.

## 2. Comparisons from memory (SPEC §2, VALIDATION §6)

| # | Claim | Source | Opened? | Verdict |
| --- | --- | --- | --- | --- |
| S6 | Ethernet's randomised back-off as the model for the random delay | Metcalfe and Boggs, "Ethernet: Distributed Packet Switching for Local Computer Networks", *Communications of the ACM* 19(7), July 1976, pp. 395–404. Reprint: <https://www.cs.cornell.edu/courses/cs414/2004fa/papers/ethernet/ethernet.htm> | Yes | **Usable.** After a collision, "the controller delays for an interval of random length with a mean twice that of the previous interval". That is the same idea as our charger's back-off (SPEC §5 rule 2). (The reprint page says No. 5; other listings say No. 7.) |
| S7 | AIMD converges to an efficient and fair share | Chiu and Jain, "Analysis of the Increase and Decrease Algorithms for Congestion Avoidance in Computer Networks", *Computer Networks and ISDN Systems* 17(1), 1989, pp. 1–14. <https://classes.engineering.wustl.edu/~jain/papers/cong_av.htm> | Yes (abstract page) | **Usable.** The abstract says additive increase with multiplicative decrease "satisfies the sufficient conditions for convergence to an efficient and fair state". Our rule is AIMD-like, not AIMD, so say "borrowed from", not "proven by". |
| S8 | TCP congestion control backs senders off under congestion | Jacobson, "Congestion Avoidance and Control", ACM SIGCOMM 1988 | No. Only summaries were seen; the paper was not opened | **Not usable as a citation.** Saying "the same idea as TCP backing off when the network is congested" is general knowledge and fine. Do not cite the paper or quote numbers from it until it is opened. |
| S9 | Firefly-inspired desynchronisation spreads nodes out in time | Degesys, Rose, Patel and Nagpal, "DESYNC: Self-Organizing Desynchronization and TDMA on Wireless Sensor Networks", IPSN 2007, pp. 11–20, DOI 10.1109/IPSN.2007.4379660 | No. Seen in search listings only (Princeton and Harvard repository pages) | **Not usable as a citation** until opened. The idea (nodes spreading out by local reactions) matches. |
| S10 | Grid-friendly appliances that shed load when the local frequency falls | Hammerstrom et al., "Pacific Northwest GridWise Testbed Demonstration Projects; Part II. Grid Friendly Appliance Project", PNNL-17079, 1 October 2007. <https://www.osti.gov/biblio/926122> | Yes (OSTI record and abstract) | **Usable.** 50 water heaters and 150 clothes dryers responded to under-frequency; the abstract says they "responded reliably to each shallow underfrequency event" and owners found the responses "unnoticed and caused little or no inconvenience". This is the closest existing idea, in frequency rather than voltage. It is why the pitch must not claim novelty. |

## 3. Prior art: voltage-responsive and decentralised charging

We searched the literature and Devpost for chargers that respond to their own voltage or frequency. **The field exists and is active.** TRICKLE is a demonstration of a known family of ideas applied to an informal fleet. It is not a new method. What we found:

| # | Work | Opened? | What it does | How close |
| --- | --- | --- | --- | --- |
| P1 | Marinelli, Knezovic and Alvarez, "Analysis and comparison of voltage dependent charging strategies for single-phase electric vehicles in an unbalanced Danish distribution grid", UPEC 2016, DOI 10.1109/UPEC.2016.8114062. <https://www.scipedia.com/public/Marinelli_et_al_2016a> | Yes (abstract) | A decentralised controller "sets the EV reference current based on the phase-to-neutral voltage at the EV connection node". It notes that EVs on lower-voltage phases are constrained more, and fixes instability "due to lack of communication between the controllers". | **Very close.** Same sensing, same input, same fairness issue (our near and far shares). It modulates current where we switch on and off. |
| P2 | Liu and McLoone, "Enhanced AIMD-based decentralized residential charging of EVs", *Transactions of the Institute of Measurement and Control*, 2013 (online 18 July 2013). <https://metatoc.com/papers/15453-enhanced-aimd-based-decentralized-residential-charging-of-evs> | Yes (abstract) | Distributed AIMD charging extended "to enable local power system infrastructure and voltage level constraints to be taken into account"; reports "50% EV penetration can be accommodated, compared with only 10% with uncontrolled charging". | **Very close.** AIMD back-off for chargers. |
| P3 | Al Zishan, Moghimi Haji and Ardakanian, "Adaptive Congestion Control for Electric Vehicle Charging in the Smart Grid", IEEE Transactions on Smart Grid, 2021, DOI 10.1109/TSG.2021.3051032 | No. The PDF was fetched but its text could not be extracted; details are from search snippets only | Reported to tune an AIMD-like charging rule with multi-agent reinforcement learning, building on a fully decentralised AIMD rule that uses local voltage measurements only. | Likely very close. **Do not cite** until someone reads it. |
| P4 | Liu, Phanivong, Shi and Callaway, "Decentralized Charging Control of Electric Vehicles in Residential Distribution Networks", arXiv:1710.05533, 16 October 2017. <https://arxiv.org/abs/1710.05533> | Yes (abstract) | Decentralised "valley-filling" of overnight EV demand under network constraints, using an optimisation algorithm (shrunken primal-dual subgradient). Needs iterative signalling. | Same goal (flatten the night). Different means: it optimises and communicates, we do not. |
| P5 | Hackathon and Devpost search | Partly | No Devpost project matching "chargers that sense their own voltage" turned up in one search. Nearby: "Murmuration", an AWS Builder Center post of 11 October 2026 (opened) that simulates 500 homes on five transformers and finds a *central* scheduler, FlockShield, avoids overloads where "each home alone" overloads all five. Hackathon entries that orchestrate EV fleets under a 250 kW transformer limit also exist (AWS Builder Center, not opened). | Same problem framing (the street transformer, not the tariff). Opposite answer: central coordination. Expect a judge to have seen something similar. |

**Unwelcome but important:** P1 and P2 do what our local rule does, for cars in Europe, years ago. The honest framing is "a known decentralised idea, applied to an informal fleet that cannot be registered or scheduled, and made pokeable". VALIDATION §5 already says "must not say nobody has built this before". This search confirms that rule.

## 4. Model assumptions (CONTRACTS §10)

| Assumption | Our value | What we found | Verdict |
| --- | --- | --- | --- |
| Battery size | 7 kWh | Search snippets (not opened) describe 4 to 5 lead-acid 12 V batteries, 48 to 60 V, about 4.8 to 6 kWh, and one driver quoted as saying about 10 hours to charge four batteries | **Assumption.** Our 7 kWh looks high against unopened figures of 4.8 to 6 kWh. Say "a 7 kWh battery, assumed". This is lane A's config, so a change goes through lane A (B03). Not changed by lane D |
| Charger power | 1.0 kW | No source opened | **Assumption** |
| Transformer rating | 220 kW | An unopened interview mentions a 250 kVA transformer in a charging zone in Khulna | **Assumption.** "Neighbourhood transformers of a few hundred kVA" is not sourced either; avoid it |
| Household load curve | CONTRACTS §10 | No source opened | **Assumption** |
| Voltage sag at full load | 8% | No source opened | **Assumption** |
| Night charging takes several hours | about 5 to 6.6 h in the model | Snippets (not opened) say 5 to 7 hours or about 10 hours | **Assumption** |

The pitch calls every row in this table an assumption, and says the model is a sketch.

## 5. Sources found but not opened (do not cite)

These came up in searches but refused our fetch (HTTP 403), failed to resolve, or were PDFs whose text we could not extract. Anyone who opens one can move it into the sections above.

- Dhaka Tribune, "Salahuddin: Tk4,000C annual revenue loss from autorickshaw charging" (403)
- Dhaka Tribune, "Battery-run rickshaws strain Bangladesh's power grid" (403): reportedly quotes an anonymous senior DESCO official on transformer overloading
- Dhaka Tribune, "Millions of battery vehicles fuel power theft" (403)
- BSS, parliamentary session report, <https://www.bssnews.net/js-session/422007> (403)
- The Daily Observer, <https://observerbd.com/news/587300> and <https://observerbd.com/news/579003> (403)
- Energy & Power, interview PDF, <https://ep-bd.com/userfiles/EP_23_1_Interview.pdf> (text not extractable): reportedly a Khulna study of 250 kVA transformer overloading
- CPD, "Electric Three Wheelers in Urban Transport Networks: Challenges and Way Forward", April 2026 PDF (text not extractable)
- The Daily Star, "Dissecting battery-rickshaws: how do they work?" (host did not resolve)
- Jacobson 1988 (S8), DESYNC 2007 (S9), Al Zishan et al. 2021 (P3)
