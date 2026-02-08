# agent311

Austin 311 Data Science Agent

## Architecture

- **Backend:** FastAPI (Python) with Claude SDK for AI agent capabilities
- **Frontend:** React / JavaScript with Vercel AI Chat SDK
- **Deployment:** Railway

## Getting Started

### Backend

```bash
# Install uv (if not installed)
curl -LsSf https://astral.sh/uv/install.sh | sh

# Run the FastAPI server
cd agent311
uv run uvicorn main:app --host 0.0.0.0 --port 8000
```

### Railway Deployment

The `start.sh` script handles uv installation and server startup automatically. Railway will run this script to start the backend service.

## Project Structure

```
agent311/
├── agent311/
│   ├── main.py          # FastAPI application
│   └── pyproject.toml   # Python dependencies
├── start.sh             # Railway startup script
├── CLAUDE.md            # Development context
└── README.md
```
