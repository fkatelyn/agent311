---
name: estimate-complaint
description: Estimate resolution time for a customer complaint or issue
disable-model-invocation: true
---

# Complaint Resolution Time Estimator

Analyze the following complaint and provide an estimated resolution time:

**Complaint:** $ARGUMENTS

## Your Analysis

Evaluate the complaint based on these factors:

1. **Severity Level**
   - Critical (system down, data loss, security breach): Immediate to 4 hours
   - High (major feature broken, affecting many users): 4-24 hours
   - Medium (minor feature issue, workaround available): 1-3 days
   - Low (cosmetic issue, enhancement request): 3-7 days

2. **Complexity**
   - Simple (config change, quick fix): +0 time
   - Moderate (single component fix, testing needed): +1-2 days
   - Complex (multiple systems, requires investigation): +3-7 days
   - Very Complex (architecture change, extensive testing): +1-4 weeks

3. **Dependencies**
   - No dependencies: +0 time
   - Internal team dependencies: +1-3 days
   - External vendor/partner dependencies: +3-14 days
   - Regulatory/legal review needed: +1-4 weeks

4. **Resources Required**
   - Single developer: +0 time
   - Multiple team members: +2-5 days
   - Cross-team coordination: +1-2 weeks
   - External consultants needed: +2-4 weeks

## Output Format

Provide your response in this format:

```
COMPLAINT RESOLUTION ESTIMATE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Complaint Summary: [Brief 1-sentence summary]

Severity: [Critical/High/Medium/Low]
Complexity: [Simple/Moderate/Complex/Very Complex]
Key Dependencies: [List any blocking dependencies]

ESTIMATED RESOLUTION TIME: [X hours/days/weeks]

Breakdown:
- Investigation & diagnosis: [time]
- Implementation: [time]
- Testing & QA: [time]
- Deployment & verification: [time]

Confidence Level: [High/Medium/Low]

Assumptions:
- [List key assumptions affecting the estimate]

Risk Factors:
- [List factors that could extend the timeline]

Next Steps:
1. [Immediate action needed]
2. [Follow-up actions]
```

Be realistic and account for typical development cycles. If the complaint is vague or lacks details, note that in your assumptions and provide a range.
