---
name: create-report
description: >
  Use when the user asks to "create a report", "generate a report", "make a report",
  "build a report", "report on 311 data", "311 report", "weekly report", "summary report",
  or any request that involves producing a standalone HTML report, PNG chart, or CSV export
  from 311 data. This skill uses the save_report MCP tool to write files to the reports
  directory so they appear in the sidebar file tree.
version: 1.0.0
---

# Create Report

Generate self-contained reports from Austin 311 data and save them using the `save_report` MCP tool. Reports appear in the sidebar file tree for easy access.

## Important Rules

1. **Always use `save_report`** to write report files. Do NOT use Write, Bash, or any other tool to create report files.
2. **Filename convention:** `<topic>-report-<YYYY-MM-DD>.html` for HTML reports, `<topic>-chart-<YYYY-MM-DD>.png` for PNG charts, `<topic>-data-<YYYY-MM-DD>.csv` for CSV exports.
3. **Sanitize filenames:** Use lowercase, hyphens instead of spaces, no special characters.

## Report Types

### HTML Reports (Primary)

Self-contained Chart.js reports with dark theme. Structure:

- Header with title and subtitle (data source, date range, record count)
- Executive summary (2-3 sentences)
- Metric cards row (key numbers)
- Charts (Chart.js, multiple canvases if needed)
- Data tables (top items, breakdowns)
- Key takeaways section

```
save_report(filename="complaint-types-report-2026-02-19.html", content="<!DOCTYPE html>...")
```

#### HTML Template

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>REPORT TITLE</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      background: #1a1a2e;
      color: #e0e0e0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
      padding: 32px;
    }
    .report { max-width: 1100px; margin: 0 auto; }
    h1 { text-align: center; font-size: 1.8rem; color: #fff; margin-bottom: 8px; }
    .subtitle { text-align: center; color: #888; margin-bottom: 32px; }
    .summary {
      background: #0f3460; border-radius: 12px; padding: 20px 24px;
      margin-bottom: 32px; line-height: 1.6; color: #ccc;
    }
    .metrics {
      display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 16px; margin-bottom: 32px;
    }
    .metric-card {
      background: #16213e; border-radius: 12px; padding: 20px;
      text-align: center;
    }
    .metric-card .value { font-size: 2rem; font-weight: 700; color: #00d2ff; }
    .metric-card .label { font-size: 0.85rem; color: #888; margin-top: 4px; }
    .chart-container {
      background: #16213e; border-radius: 12px; padding: 24px;
      margin-bottom: 32px;
    }
    .chart-row {
      display: grid; grid-template-columns: 1fr 1fr; gap: 24px;
      margin-bottom: 32px;
    }
    .chart-row .chart-container { margin-bottom: 0; }
    table {
      width: 100%; border-collapse: collapse; margin-bottom: 32px;
      background: #16213e; border-radius: 12px; overflow: hidden;
    }
    th { background: #0f3460; padding: 12px 16px; text-align: left; font-size: 0.85rem; color: #aaa; }
    td { padding: 12px 16px; border-top: 1px solid #333355; }
    .takeaways {
      background: #0f3460; border: 1px solid #1a5276; border-radius: 12px;
      padding: 24px; margin-top: 32px;
    }
    .takeaways h2 { color: #00d2ff; margin-bottom: 12px; }
    .takeaways li { margin-bottom: 8px; line-height: 1.5; }
  </style>
</head>
<body>
  <div class="report">
    <h1>REPORT TITLE</h1>
    <p class="subtitle">Austin 311 · Date Range · N records</p>
    <div class="summary">Executive summary goes here.</div>
    <div class="metrics">
      <div class="metric-card"><div class="value">1,234</div><div class="label">Total Requests</div></div>
    </div>
    <div class="chart-container"><canvas id="chart1"></canvas></div>
    <div class="takeaways">
      <h2>Key Takeaways</h2>
      <ul><li>Finding 1</li><li>Finding 2</li></ul>
    </div>
  </div>
  <script>
    Chart.defaults.color = '#a0a0a0';
    Chart.defaults.borderColor = '#333355';
    const COLORS = ['#00d2ff','#7b2ff7','#ff6b6b','#ffd93d','#6bcb77','#4d96ff','#ff922b','#845ef7','#20c997','#f06595'];
    // Charts here
  </script>
</body>
</html>
```

### PNG Charts

For standalone chart images, use matplotlib with dark theme:

1. Generate the chart with Python (matplotlib, dark background `#1a1a2e`)
2. Save to a buffer, base64-encode it
3. Call `save_report(filename="...", content="<base64>", encoding="base64")`

### CSV Exports

For raw data dumps:

1. Generate CSV content as a string
2. Call `save_report(filename="...", content="col1,col2\nval1,val2\n...")`

## Workflow

1. Read and analyze the data (from `/tmp/agent311_data/311_recent.csv` or Socrata API)
2. Compute aggregations and statistics using Python
3. Generate the report content (HTML with embedded data)
4. Call `save_report` to save the file
5. Summarize key findings in your chat response
6. Tell the user to check the file tree in the sidebar for the full report
