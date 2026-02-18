---
name: download-311-data
description: >
  Use when the user asks to "download 311 data", "get 311 data",
  "fetch Austin 311", "update 311 data", "refresh 311 data",
  "download service requests", or discusses downloading or updating
  City of Austin 311 service request data.
version: 1.0.0
---

# Download Austin 311 Data

Download City of Austin 311 service request data from the Socrata Open Data API.

## Data Source

- **Portal:** City of Austin Open Data (data.austintexas.gov)
- **Dataset ID:** `xwdj-i9he`
- **API endpoint:** `https://data.austintexas.gov/resource/xwdj-i9he.csv`
- **No API key required** for reasonable request volumes

## Steps

### 1. Determine Date Range

Ask the user what date range they want if not specified. Common options:
- Past 7 days
- Past 1 month (default)
- Past 3 months
- Past 1 year
- Custom date range

Calculate the start date based on today's date.

### 2. Download the Data

Create the `data/` directory if it doesn't exist, then fetch via curl:

```bash
mkdir -p data
curl -s "https://data.austintexas.gov/resource/xwdj-i9he.csv?\$where=sr_created_date>='<START_DATE>T00:00:00'&\$limit=50000&\$offset=0" \
  -o data/austin_311_data.csv
```

**Pagination:** The Socrata API returns max 50,000 rows per request. If the dataset may exceed this:
1. First check the count: `$select=count(*)&$where=sr_created_date>='<START_DATE>T00:00:00'`
2. If count > 50,000, paginate using `$offset` in increments of 50,000 and concatenate results

### 3. Verify the Download

After downloading, verify by running:
```bash
wc -l data/austin_311_data.csv
head -2 data/austin_311_data.csv
```

Report to the user:
- Number of records downloaded
- Date range covered
- File location (`data/austin_311_data.csv`)

## Dataset Columns

| Column | Description |
|--------|-------------|
| `sr_number` | Unique service request ID |
| `sr_type_desc` | Request type (e.g., "ARR - Garbage") |
| `sr_department_desc` | Responsible city department |
| `sr_method_received_desc` | How it was reported (Phone, App, Web) |
| `sr_status_desc` | Status (Open, Closed, Duplicate, etc.) |
| `sr_status_date` | Last status change timestamp |
| `sr_created_date` | When the request was filed |
| `sr_updated_date` | Last update timestamp |
| `sr_closed_date` | When the request was closed |
| `sr_location` | Full address string |
| `sr_location_street_number` | Street number |
| `sr_location_street_name` | Street name |
| `sr_location_city` | City |
| `sr_location_zip_code` | ZIP code |
| `sr_location_county` | County |
| `sr_location_x` | X coordinate (state plane) |
| `sr_location_y` | Y coordinate (state plane) |
| `sr_location_lat` | Latitude |
| `sr_location_long` | Longitude |
| `sr_location_lat_long` | Point geometry (WKT) |
| `sr_location_council_district` | City council district number |
| `sr_location_map_page` | Map page reference |
| `sr_location_map_tile` | Map tile reference |

## Filtering Options

The Socrata SoQL API supports additional filters via `$where`:

```
# By department
$where=sr_department_desc='Austin Resource Recovery'

# By request type
$where=sr_type_desc='ARR - Garbage'

# By ZIP code
$where=sr_location_zip_code='78704'

# By status
$where=sr_status_desc='Open'

# Combined filters
$where=sr_created_date>='2026-01-01' AND sr_department_desc='Austin Resource Recovery'
```

Pass any user-specified filters into the `$where` clause.

## Output

Save to `data/austin_311_data.csv` by default. If the user specifies a custom filename, use that instead.
