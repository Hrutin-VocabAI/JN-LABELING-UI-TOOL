# JN Logo Labeling UI Tool

A premium, web-based image classification and labeling tool designed for sorting logo slice images or railway signal interlocking plans into numbered categories (1 to 13). Built with a Python Flask backend for file operations and a modern dark-themed single-page frontend.

## Features

- **Direct Filesystem Access**: Point to any local folder to load images, and classify them to copy them to category subfolders (`1` through `13`).
- **Autoresume**: Automatically scans output subfolders to detect already labeled images and resumes work from where you left off.
- **Detailed Image Inspection**: Full pan and zoom capabilities (mouse scroll to zoom, click and drag to pan, double click/Esc to reset) for high-resolution signal plans/logos.
- **Keyboard Shortcuts**: Designed for rapid annotation with zero mouse clicks required once loaded.
- **Undo History**: Made a mistake? Press `Backspace` to undo the last labeled action (removes the copied file and rolls the image index back).

---

## Installation & Setup

1. **Clone the Repository** (or navigate to the tool folder)
2. **Install Dependencies**:
   ```bash
   pip install -r requirements.txt
   ```
3. **Run the Application**:
   ```bash
   python3 app.py
   ```
   *The application will start the local server and automatically attempt to launch it in your web browser (typically on `http://127.0.0.1:5000` or an auto-detected open port).*

---

## How it Works

1. Enter the absolute path to your **Images Folder** containing the raw files to label.
2. Enter the absolute path to your **Output Folder** where sorted images should be copied.
3. Click **Load Dataset**.
4. The backend will verify directories and automatically create subfolders named `1` through `13` inside the output path if they don't already exist.
5. The UI will render the first unlabeled image. Apply a label using keyboard shortcuts or by clicking a category card.

---

## Keyboard Shortcuts

| Key | Action |
| --- | --- |
| `1` – `9` | Classify image to Category 1 – 9 |
| `0` | Classify image to Category 10 |
| `Q` | Classify image to Category 11 |
| `W` | Classify image to Category 12 |
| `E` | Classify image to Category 13 |
| `→` / `Space` | Skip current image (goes to next image without labeling) |
| `←` | Go back to previous image |
| `Backspace` | Undo last labeled action (removes the copied file) |
| `Esc` | Reset image zoom and pan position |

---

## Project Structure

```text
Labeling_UI_tool/
├── app.py                 # Flask server & REST API
├── requirements.txt       # Python dependencies
├── README.md              # Documentation
├── static/
│   ├── css/
│   │   └── style.css      # Dark theme & styling
│   └── js/
│       └── app.js         # Frontend interactive logic
└── templates/
    └── index.html         # HTML layout
```
