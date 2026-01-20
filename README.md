# EshaCharts - Interactive CSV Plotting Application

A web-based interactive CSV plotting application, similar to Origin/matplotlib editor, running fully in the browser.

## Features

- **CSV Upload**: Single file or folder of CSV files
- **Smart Axis Detection**: Automatically detects X/Y axes based on column names
- **Interactive Editing**:
  - Swap X/Y axes
  - Change line color and width
  - Toggle curve visibility
  - Toggle title and axis labels
  - Switch between normal and scientific notation
- **Zoom & Pan**: Click-drag to zoom, scroll wheel, double-click to reset
- **Export**: PNG, JPEG, SVG, PDF - single or batch export
- **Multiple Curves**: Support for multiple Y columns per CSV
- **Dark/Light Theme**: Toggle between themes
- **Clean Scientific UI**: Suitable for research demos and presentations

## Tech Stack

- **Backend**: Python FastAPI
- **Frontend**: React 18 + Plotly.js
- **No Desktop Frameworks**: Runs entirely in browser

---

## Installation

### Prerequisites

- Python 3.8+
- Node.js 16+ and npm

### 1. Clone/Download the project

```bash
cd EshaCharts
```

### 2. Backend Setup

```bash
# Navigate to backend directory
cd backend

# Create virtual environment (recommended)
python -m venv venv

# Activate virtual environment
# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

### 3. Frontend Setup

```bash
# Navigate to frontend directory (from project root)
cd frontend

# Install dependencies
npm install
```

---

## Running the Application

You need **two terminal windows** - one for backend, one for frontend.

### Terminal 1 - Start Backend

```bash
cd backend

# Activate virtual environment if not already active
# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

# Start the server
python main.py
```

Backend will run at: `http://localhost:8000`

### Terminal 2 - Start Frontend

```bash
cd frontend

# Start React development server
npm start
```

Frontend will open automatically at: `http://localhost:3000`

---

## Usage Guide

### Uploading Files

1. **Single File**: Click "Select Files" and choose a CSV
2. **Multiple Files**: Click "Select Files" and select multiple CSVs (Ctrl/Cmd+Click)
3. **Folder**: Click "Select Folder" to upload all CSVs in a directory
4. **Drag & Drop**: Drag CSV files directly onto the upload zone

### Axis Detection Rules

The application automatically determines X and Y axes:

1. If any column name contains "time" (case-insensitive) → That column becomes X-axis
2. Otherwise:
   - 3+ columns: X = column 3, Y = columns 1, 2, etc.
   - 2 columns: X = column 2, Y = column 1

### Graph Controls

| Control | Description |
|---------|-------------|
| Show Title | Toggle the graph title on/off |
| Show Axis Labels | Toggle X/Y axis labels |
| Swap X/Y Axes | Rotate the graph |
| X/Y Axis Format | Normal or Scientific notation |
| Curve Color | Click color picker to change |
| Curve Width | Slider from 1-10px |
| Curve Visibility | Checkbox to show/hide |

### Zoom & Pan

| Action | How to |
|--------|--------|
| Zoom In | Click and drag to select region |
| Zoom Out | Double-click on graph |
| Pan | Hold Shift + drag |
| Scroll Zoom | Mouse wheel |
| Reset | Double-click or use toolbar button |

### Exporting

1. Select format: PNG, JPEG, SVG, or PDF
2. Click "Export Current Graph" for single export
3. Click "Export All" to batch export as ZIP file

---

## CSV Format

Example valid CSV:

```csv
time,voltage,current
0.0,1.2,0.5
0.1,1.5,0.6
0.2,1.8,0.7
```

Requirements:
- Standard CSV format with comma delimiter
- First row must be column headers
- At least 2 columns
- Numeric data for plotting

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | Health check |
| POST | `/upload/single` | Upload single CSV |
| POST | `/upload/multiple` | Upload multiple CSVs |
| GET | `/session/{id}/file/{index}` | Get specific file |
| GET | `/session/{id}/all` | Get all files |
| DELETE | `/session/{id}` | Delete session |

---

## Project Structure

```
EshaCharts/
├── backend/
│   ├── main.py              # FastAPI server
│   ├── requirements.txt     # Python dependencies
│   └── uploads/             # Temporary file storage
├── frontend/
│   ├── package.json
│   ├── public/
│   │   └── index.html
│   └── src/
│       ├── App.jsx          # Main application
│       ├── App.css          # Styles
│       ├── index.js         # Entry point
│       └── components/
│           ├── FileUpload.jsx
│           ├── GraphDisplay.jsx
│           ├── ControlPanel.jsx
│           └── Navigation.jsx
└── README.md
```

---

## Troubleshooting

### CORS Error
Ensure backend is running on port 8000 before starting frontend.

### File Upload Fails
Check that files are valid CSV format with comma delimiters.

### Graph Not Rendering
Ensure CSV has at least 2 columns with numeric data.

### Large File Performance
Files over 10,000 rows are automatically downsampled for performance.

---

## License

MIT License - Free for personal and commercial use.
