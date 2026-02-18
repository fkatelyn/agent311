---
name: visualize
description: >
  Use AUTOMATICALLY whenever responding to data-related prompts — any question
  involving counts, comparisons, trends, percentages, rankings, distributions,
  breakdowns, or statistics from 311 data or any CSV/dataset. Do NOT wait for
  the user to ask for a chart. If the answer involves numbers, visualize them.
  DEFAULT: Generate a Chart.js HTML file and open it in the browser.
  EXCEPTION: If the user says "in text", "ascii", "terminal", or "in the terminal",
  use ASCII text charts instead.
  Trigger phrases include but are not limited to: "how many", "what percentage",
  "compare", "top", "worst", "most common", "trend", "over time", "by district",
  "by zip", "breakdown", "distribution", "average", "which", or any question
  whose answer benefits from a visual representation.
version: 2.0.0
---

# Visualize Data

Whenever you answer a data-related question, **always include a visualization**. There are two modes:

- **Default → Chart.js HTML** (interactive charts opened in the browser)
- **Text mode → ASCII** (only when user says "in text", "ascii", "terminal", or "in the terminal")

---

## MODE 1: Chart.js HTML (Default)

Generate a self-contained HTML file in `analysis/charts/` and open it with `open` (macOS).

### Rules

1. **Always visualize.** If your answer includes 3+ data points, generate a chart. No exceptions.
2. **Self-contained HTML.** Load Chart.js from CDN. No other dependencies.
3. **Dark theme.** Use dark background (`#1a1a2e`) to match terminal aesthetic.
4. **Open automatically.** Run `open <file>` after writing so it opens in the browser.
5. **Multiple charts per page.** If the analysis has several dimensions, put them all in one HTML file with multiple `<canvas>` elements.
6. **Summarize in your response.** After generating the chart, include a brief text summary of the key findings in your message.

### HTML Template

Every chart HTML file should follow this structure:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CHART TITLE</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <style>
    body {
      background: #1a1a2e;
      color: #e0e0e0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
      margin: 0;
      padding: 24px;
    }
    h1 {
      text-align: center;
      font-size: 1.5rem;
      margin-bottom: 8px;
      color: #fff;
    }
    .subtitle {
      text-align: center;
      font-size: 0.9rem;
      color: #888;
      margin-bottom: 32px;
    }
    .chart-container {
      max-width: 900px;
      margin: 0 auto 48px auto;
      background: #16213e;
      border-radius: 12px;
      padding: 24px;
    }
    .chart-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 24px;
      max-width: 1400px;
      margin: 0 auto 48px auto;
    }
    .chart-row .chart-container {
      margin: 0;
    }
    .insight {
      max-width: 900px;
      margin: -32px auto 48px auto;
      padding: 16px 24px;
      background: #0f3460;
      border-radius: 8px;
      font-size: 0.95rem;
      line-height: 1.5;
      color: #ccc;
    }
    .takeaways {
      max-width: 900px;
      margin: 48px auto;
      padding: 24px;
      background: #0f3460;
      border: 1px solid #1a5276;
      border-radius: 12px;
    }
    .takeaways h2 {
      margin-top: 0;
      color: #00d2ff;
    }
    .takeaways li {
      margin-bottom: 8px;
      line-height: 1.5;
    }
  </style>
</head>
<body>
  <h1>CHART TITLE</h1>
  <p class="subtitle">Data source · date range · record count</p>

  <div class="chart-container">
    <canvas id="chart1"></canvas>
  </div>

  <!-- For side-by-side charts use chart-row -->
  <div class="chart-row">
    <div class="chart-container"><canvas id="chart2"></canvas></div>
    <div class="chart-container"><canvas id="chart3"></canvas></div>
  </div>

  <div class="takeaways">
    <h2>Key Takeaways</h2>
    <ul>
      <li>First finding</li>
      <li>Second finding</li>
    </ul>
  </div>

  <script>
    // Chart.js defaults for dark theme
    Chart.defaults.color = '#a0a0a0';
    Chart.defaults.borderColor = '#333355';

    // CHART 1
    new Chart(document.getElementById('chart1'), {
      type: 'bar', // or 'line', 'doughnut', 'pie', 'polarArea'
      data: {
        labels: ['Label 1', 'Label 2'],
        datasets: [{
          label: 'Dataset',
          data: [100, 200],
          backgroundColor: ['#00d2ff', '#7b2ff7', '#ff6b6b', '#ffd93d', '#6bcb77'],
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { display: false },
          title: { display: true, text: 'Chart Title', font: { size: 16 } }
        }
      }
    });
  </script>
</body>
</html>
```

### Choosing Chart.js Chart Types

| Data Shape | Chart.js Type | Notes |
|---|---|---|
| Ranked categories | `bar` (horizontal: `indexAxis: 'y'`) | Use for top-N lists |
| Values over time | `line` with `fill: true` | Area chart for trends |
| Proportions / shares | `doughnut` or `pie` | Use doughnut for status breakdowns |
| Numeric distributions | `bar` | Histogram-style with range labels |
| 24-hour / weekly cycle | `line` or `bar` | Use `bar` for discrete, `line` for continuous |
| Comparing 2 groups | `bar` with grouped datasets | Side-by-side bars |
| Geographic (district/zip) | `bar` (horizontal) | Sorted by value descending |

### Color Palette

Use these colors consistently:
```javascript
const COLORS = [
  '#00d2ff', // cyan
  '#7b2ff7', // purple
  '#ff6b6b', // red/coral
  '#ffd93d', // yellow
  '#6bcb77', // green
  '#4d96ff', // blue
  '#ff922b', // orange
  '#845ef7', // violet
  '#20c997', // teal
  '#f06595', // pink
];
```

### Workflow

1. Compute the data using `uv run python3` (read CSV, aggregate, etc.)
2. Write the HTML file to `analysis/charts/<descriptive-name>.html`
3. Run `open analysis/charts/<descriptive-name>.html` to open in browser
4. In your response text, summarize the key findings (no ASCII chart needed)

---

## MODE 2: ASCII Text (On Request)

Use this mode ONLY when the user explicitly asks for "text", "ascii", "terminal", or "in the terminal".

### Rules

1. **Always visualize.** If your answer includes 3+ data points, include a chart.
2. **Print directly in your response message.** The ASCII charts MUST appear in your chat response as markdown fenced code blocks (triple backticks). Do NOT rely on Bash tool output — the user cannot see tool output. After computing the data with Bash, copy/reproduce the charts into your response text inside ``` blocks.
3. **Pick the right chart type** for the data.
4. **Keep it compact.** Max 40 characters for bar width.
5. **Include numbers.** Every bar/row must show its count and percentage.
6. **Add context.** Use `◄──` markers for peaks, outliers, or notable values.
7. **Use box drawing.** Frame titles with `┌─┐ │ │ └─┘` borders.

### ASCII Chart Types

**Horizontal Bar:**
```
┌─────────────────────────────────────────┐
│  TITLE HERE                             │
└─────────────────────────────────────────┘
Label A   ████████████████████████████  142 (38%)
Label B   ██████████████████░░░░░░░░░░   95 (25%)
Label C   ████████████░░░░░░░░░░░░░░░░   63 (17%)
```
Use `█` for filled and `░` for unfilled.

**Timeline:**
```
┌─────────────────────────────────────────┐
│  TITLE OVER TIME                        │
└─────────────────────────────────────────┘
Jan  ███████████░░░░░░░░░░░░░░░░░░░  118
Feb  ██████████████████████████░░░░░  278
Mar  ████████████████████████████░░░  317 ◄── peak
```

**Distribution:**
```
┌─────────────────────────────────────────┐
│  DISTRIBUTION OF X                      │
└─────────────────────────────────────────┘
< 6 hrs    █████████████████████████████  1144 (39%)
6-12 hrs   ████████░░░░░░░░░░░░░░░░░░░░   288 (10%)

Median: 12.3 hours  ·  Mean: 17.0 hours
```

**Heat Strip (hour/day patterns):**
```
 8:00  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓   212
11:00  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓  246 ◄── peak
```
Use `▓` for heat strips.

**Comparison Table:**
```
┌──────────────────┬────────────┬────────────┐
│  Metric          │  Group A   │  Group B   │
├──────────────────┼────────────┼────────────┤
│  Fix rate        │  100%      │  96.3%     │
└──────────────────┴────────────┴────────────┘
```

**Summary Box:**
```
╔══════════════════════════════════════════════╗
║  KEY TAKEAWAYS                              ║
╠══════════════════════════════════════════════╣
║  · First insight with specific number       ║
║  · Second insight with specific number      ║
╚══════════════════════════════════════════════╝
```

### Bar Scaling
```
filled = int((value / max_value) * BAR_WIDTH)
bar = '█' * filled + '░' * (BAR_WIDTH - filled)
```
Use `BAR_WIDTH = 30` for most charts.
