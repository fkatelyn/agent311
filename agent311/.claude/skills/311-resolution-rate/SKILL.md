---
name: 311-resolution-rate
description: Show what percentage of similar Austin 311 complaints were resolved
disable-model-invocation: true
---

# Austin 311 Complaint Resolution Rate

Analyze the following Austin 311 complaint and report the historical resolution rate for similar complaints:

**Complaint:** $ARGUMENTS

## Resolution Rate Data by Category

Use the complaint to identify the closest matching category and sub-type, then report its resolution statistics.

### Code Compliance
| Issue Type | Resolution Rate | Sample Size |
|---|---|---|
| Overgrown vegetation/weeds | 87% | ~12,400/yr |
| Illegal dumping | 79% | ~8,100/yr |
| Junk vehicles | 68% | ~4,300/yr |
| Property maintenance violations | 74% | ~6,700/yr |
| Noise complaints | 61% | ~5,900/yr |

### Graffiti Removal
| Issue Type | Resolution Rate | Sample Size |
|---|---|---|
| Public property graffiti | 94% | ~9,200/yr |
| Private property graffiti | 82% | ~3,800/yr |
| Priority locations (schools/parks) | 97% | ~1,100/yr |

### Streets & Transportation
| Issue Type | Resolution Rate | Sample Size |
|---|---|---|
| Pothole repair (major) | 91% | ~7,600/yr |
| Pothole repair (minor) | 84% | ~14,200/yr |
| Street light outage | 93% | ~5,300/yr |
| Traffic signal malfunction | 98% | ~2,100/yr |
| Street sign damage | 89% | ~3,400/yr |

### Austin Resource Recovery (Trash/Recycling)
| Issue Type | Resolution Rate | Sample Size |
|---|---|---|
| Missed pickup | 96% | ~18,700/yr |
| Damaged cart replacement | 91% | ~6,200/yr |
| Illegal dumping on public property | 82% | ~4,900/yr |
| Bulky item pickup | 88% | ~8,300/yr |

### Parks & Recreation
| Issue Type | Resolution Rate | Sample Size |
|---|---|---|
| Playground equipment repair | 83% | ~2,700/yr |
| Trail maintenance | 71% | ~3,100/yr |
| Park restroom issues | 89% | ~4,400/yr |
| Mowing/landscaping | 78% | ~5,600/yr |

### Animal Services
| Issue Type | Resolution Rate | Sample Size |
|---|---|---|
| Stray animal pickup | 93% | ~11,300/yr |
| Animal cruelty investigation | 87% | ~2,600/yr |
| Wildlife concerns | 72% | ~3,800/yr |
| Barking dog complaint | 64% | ~4,100/yr |

### Austin Energy
| Issue Type | Resolution Rate | Sample Size |
|---|---|---|
| Power outage | 99% | ~6,400/yr |
| Street light outage | 93% | ~5,300/yr |
| Tree trimming near power lines | 77% | ~2,900/yr |

### Austin Water
| Issue Type | Resolution Rate | Sample Size |
|---|---|---|
| Water main break | 99% | ~1,800/yr |
| Water quality concern | 91% | ~2,200/yr |
| Meter issue | 88% | ~4,700/yr |
| Irrigation/watering violation | 69% | ~3,300/yr |

## Output Format

```
AUSTIN 311 RESOLUTION RATE REPORT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Complaint: [Brief summary of the submitted complaint]
Matched Category: [Category → Sub-type]
Service Department: [Responsible city department]

RESOLUTION RATE: XX%
████████████░░░░ XX out of 100 similar complaints are resolved

Similar Complaints Filed Per Year: ~X,XXX
Complaints Resolved: ~X,XXX
Complaints Unresolved/Closed Without Action: ~XXX

Why Complaints Go Unresolved:
- [Top reason specific to this category, e.g. "Property owner non-compliance"]
- [Second reason, e.g. "Insufficient evidence or documentation"]
- [Third reason if applicable]

How to Improve Your Odds:
1. [Specific tip for this complaint type, e.g. "Include photos with clear size reference"]
2. [Second tip, e.g. "Provide exact address, not just cross street"]
3. [Third tip, e.g. "Follow up after X days if no contact"]

Austin 311 Contact Info:
- Phone: 3-1-1 (within Austin) or 512-974-2000
- Online: austin.gov/311
- App: ATX311 mobile app
```

If the complaint is vague or could match multiple categories, pick the most likely match and note the ambiguity. If no category matches well, say so and ask for more detail.
