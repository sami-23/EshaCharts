"""
EshaCharts Backend - FastAPI server for CSV plotting application
"""

import os
import shutil
import uuid
from pathlib import Path
from typing import List, Optional

import pandas as pd
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

app = FastAPI(title="EshaCharts API", version="1.0.0")

# CORS middleware for frontend communication
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Storage for uploaded files
UPLOAD_DIR = Path(__file__).parent / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

# In-memory session storage for CSV data
sessions = {}


def detect_axes(columns: List[str], num_columns: int) -> dict:
    """
    Detect X and Y axes based on column names and count.

    Rules:
    - If a column name contains "time" (case-insensitive), use it as X-axis
    - Columns named "index" (case-insensitive) are excluded from Y by default
    - Otherwise:
      - If columns >= 3: X = column index 0, Y = remaining columns
      - If columns == 2: X = column index 0, Y = column index 1
    """
    # Helper to check if column is an index column (should be excluded from Y)
    def is_index_column(col_name):
        return col_name.lower().strip() in ['index', 'idx', '#', 'no', 'no.', 'row']

    # Check for "time" column
    for i, col in enumerate(columns):
        if "time" in col.lower():
            # X is time column, Y is all other columns (excluding index columns)
            y_indices = [j for j in range(num_columns) if j != i and not is_index_column(columns[j])]
            # If no Y columns left, include all except X
            if not y_indices:
                y_indices = [j for j in range(num_columns) if j != i]
            return {
                "x_index": i,
                "x_name": col,
                "y_indices": y_indices,
                "y_names": [columns[j] for j in y_indices]
            }

    # Default logic based on column count
    # Find first non-index column for X
    x_index = 0
    for i, col in enumerate(columns):
        if not is_index_column(col):
            x_index = i
            break

    # Y is all other columns except X and index columns
    y_indices = [i for i in range(num_columns) if i != x_index and not is_index_column(columns[i])]
    # If no Y columns, include all except X
    if not y_indices:
        y_indices = [i for i in range(num_columns) if i != x_index]

    return {
        "x_index": x_index,
        "x_name": columns[x_index],
        "y_indices": y_indices,
        "y_names": [columns[i] for i in y_indices]
    }


def parse_csv(file_path: Path, filename: str) -> dict:
    """Parse a CSV file and return structured data for plotting."""
    try:
        # Try different encodings
        # Skip comment lines starting with #
        for encoding in ['utf-8', 'latin-1', 'cp1252']:
            try:
                df = pd.read_csv(file_path, encoding=encoding, comment='#')
                break
            except UnicodeDecodeError:
                continue
        else:
            raise ValueError("Could not decode CSV file")

        # Handle empty dataframes
        if df.empty:
            raise ValueError("CSV file is empty")

        columns = df.columns.tolist()
        num_columns = len(columns)
        total_rows = len(df)

        # For large CSVs, downsample if needed (> 10000 points)
        max_points = 10000
        step = 1
        if total_rows > max_points:
            step = total_rows // max_points
            df = df.iloc[::step]

        # Store ALL column data for axis reconfiguration
        # Replace NaN/inf values with None for JSON compatibility
        all_column_data = {}
        for idx, col in enumerate(columns):
            col_data = df.iloc[:, idx].tolist()
            # Convert NaN and inf to None for JSON serialization
            col_data = [None if (isinstance(v, float) and (pd.isna(v) or v == float('inf') or v == float('-inf'))) else v for v in col_data]
            all_column_data[idx] = col_data

        # Detect axes
        axes = detect_axes(columns, num_columns)

        # Prepare data based on detected axes
        if axes["x_index"] == -1:
            x_data = list(range(len(df)))
        else:
            x_data = all_column_data[axes["x_index"]]

        # Get Y data for detected Y columns
        y_data = []
        for y_idx in axes["y_indices"]:
            y_data.append({
                "name": columns[y_idx],
                "data": all_column_data[y_idx]
            })

        # Double-check: clean any remaining NaN values in x_data
        x_data = [None if (isinstance(v, float) and (pd.isna(v) or v == float('inf') or v == float('-inf'))) else v for v in x_data]

        return {
            "filename": filename,
            "title": Path(filename).stem,
            "columns": columns,
            "x_name": axes["x_name"],
            "x_data": x_data,
            "y_data": y_data,
            "all_column_data": all_column_data,  # All columns for axis reconfiguration
            "total_rows": total_rows,
            "displayed_rows": len(df),
            "axes_config": axes
        }

    except Exception as e:
        raise ValueError(f"Error parsing CSV: {str(e)}")


@app.get("/")
async def root():
    """Health check endpoint."""
    return {"status": "ok", "message": "EshaCharts API is running"}


@app.post("/upload/single")
async def upload_single_file(file: UploadFile = File(...)):
    """Upload a single CSV file."""
    if not file.filename.lower().endswith('.csv'):
        raise HTTPException(status_code=400, detail="Only CSV files are allowed")

    # Create session
    session_id = str(uuid.uuid4())
    session_dir = UPLOAD_DIR / session_id
    session_dir.mkdir(exist_ok=True)

    # Save file
    file_path = session_dir / file.filename
    with open(file_path, "wb") as f:
        content = await file.read()
        f.write(content)

    # Parse CSV
    try:
        csv_data = parse_csv(file_path, file.filename)
    except ValueError as e:
        shutil.rmtree(session_dir)
        raise HTTPException(status_code=400, detail=str(e))

    # Store in session
    sessions[session_id] = {
        "files": [csv_data],
        "current_index": 0
    }

    return {
        "session_id": session_id,
        "total_files": 1,
        "current_index": 0,
        "data": csv_data
    }


@app.post("/upload/multiple")
async def upload_multiple_files(files: List[UploadFile] = File(...)):
    """Upload multiple CSV files."""
    csv_files = [f for f in files if f.filename.lower().endswith('.csv')]

    if not csv_files:
        raise HTTPException(status_code=400, detail="No CSV files found")

    # Create session
    session_id = str(uuid.uuid4())
    session_dir = UPLOAD_DIR / session_id
    session_dir.mkdir(exist_ok=True)

    parsed_files = []
    errors = []

    for file in csv_files:
        file_path = session_dir / file.filename
        with open(file_path, "wb") as f:
            content = await file.read()
            f.write(content)

        try:
            csv_data = parse_csv(file_path, file.filename)
            parsed_files.append(csv_data)
        except ValueError as e:
            errors.append({"filename": file.filename, "error": str(e)})

    if not parsed_files:
        shutil.rmtree(session_dir)
        raise HTTPException(status_code=400, detail=f"No valid CSV files: {errors}")

    # Store in session
    sessions[session_id] = {
        "files": parsed_files,
        "current_index": 0
    }

    return {
        "session_id": session_id,
        "total_files": len(parsed_files),
        "current_index": 0,
        "data": parsed_files[0],
        "errors": errors if errors else None
    }


@app.get("/session/{session_id}/file/{index}")
async def get_file(session_id: str, index: int):
    """Get a specific file from a session by index."""
    if session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")

    session = sessions[session_id]
    if index < 0 or index >= len(session["files"]):
        raise HTTPException(status_code=404, detail="File index out of range")

    session["current_index"] = index

    return {
        "session_id": session_id,
        "total_files": len(session["files"]),
        "current_index": index,
        "data": session["files"][index]
    }


@app.get("/session/{session_id}/all")
async def get_all_files(session_id: str):
    """Get all files from a session (for batch export)."""
    if session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")

    session = sessions[session_id]

    return {
        "session_id": session_id,
        "total_files": len(session["files"]),
        "files": session["files"]
    }


@app.delete("/session/{session_id}")
async def delete_session(session_id: str):
    """Delete a session and its files."""
    if session_id in sessions:
        del sessions[session_id]

    session_dir = UPLOAD_DIR / session_id
    if session_dir.exists():
        shutil.rmtree(session_dir)

    return {"status": "ok", "message": "Session deleted"}


@app.on_event("shutdown")
async def cleanup():
    """Cleanup uploads directory on shutdown."""
    if UPLOAD_DIR.exists():
        shutil.rmtree(UPLOAD_DIR)
        UPLOAD_DIR.mkdir(exist_ok=True)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
