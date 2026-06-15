import os
import shutil
import json
import webbrowser
from flask import Flask, request, jsonify, send_from_directory, render_template

app = Flask(__name__, static_folder='static', template_folder='templates')

# Supported image extensions
IMAGE_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.bmp', '.webp'}

# Global session state
class SessionState:
    def __init__(self):
        self.images_dir = ""
        self.output_dir = ""
        self.images = []       # List of filenames
        self.labeled = {}      # filename -> category (str: '1'-'13')
        self.current_index = 0
        self.history = []      # Stack of dicts: {"filename": str, "category": str, "prev_index": int}

session_state = SessionState()
CONFIG_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "last_session.json")

def load_last_session():
    """Load last used directories from configuration file."""
    if os.path.exists(CONFIG_FILE):
        try:
            with open(CONFIG_FILE, 'r') as f:
                data = json.load(f)
                return data.get("images_dir", ""), data.get("output_dir", "")
        except Exception:
            pass
    return "", ""

def save_last_session(images_dir, output_dir):
    """Save directories to configuration file."""
    try:
        with open(CONFIG_FILE, 'w') as f:
            json.dump({"images_dir": images_dir, "output_dir": output_dir}, f, indent=4)
    except Exception:
        pass

def scan_images():
    """Scan the images directory and detect already labeled images in the output directory."""
    if not session_state.images_dir or not os.path.isdir(session_state.images_dir):
        session_state.images = []
        session_state.labeled = {}
        return

    # List and sort all images in the input folder
    all_files = os.listdir(session_state.images_dir)
    images = []
    for f in all_files:
        ext = os.path.splitext(f)[1].lower()
        if ext in IMAGE_EXTENSIONS:
            images.append(f)
    images.sort()
    session_state.images = images

    # Scan output directory to auto-detect already labeled images
    session_state.labeled = {}
    if session_state.output_dir and os.path.isdir(session_state.output_dir):
        for cat in range(1, 14):
            cat_str = str(cat)
            cat_dir = os.path.join(session_state.output_dir, cat_str)
            if os.path.isdir(cat_dir):
                for f in os.listdir(cat_dir):
                    if f in session_state.images:
                        session_state.labeled[f] = cat_str

    # Set initial index to the first unlabeled image
    found_unlabeled = False
    for idx, f in enumerate(session_state.images):
        if f not in session_state.labeled:
            session_state.current_index = idx
            found_unlabeled = True
            break
    
    if not found_unlabeled and session_state.images:
        session_state.current_index = 0

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/status', methods=['GET'])
def get_status():
    last_img_dir, last_out_dir = load_last_session()
    return jsonify({
        "images_dir": session_state.images_dir or last_img_dir,
        "output_dir": session_state.output_dir or last_out_dir,
        "images": session_state.images,
        "labeled": session_state.labeled,
        "current_index": session_state.current_index,
        "has_history": len(session_state.history) > 0
    })

@app.route('/api/initialize', methods=['POST'])
def initialize():
    data = request.json or {}
    images_dir = data.get("images_dir", "").strip()
    output_dir = data.get("output_dir", "").strip()

    if not images_dir or not os.path.isdir(images_dir):
        return jsonify({"error": f"Images directory '{images_dir}' does not exist or is not a directory."}), 400

    if not output_dir:
        return jsonify({"error": "Output directory is required."}), 400

    # Create output directory if it doesn't exist
    try:
        os.makedirs(output_dir, exist_ok=True)
    except Exception as e:
        return jsonify({"error": f"Failed to create output directory: {str(e)}"}), 500

    # Ensure all 13 subfolders exist
    try:
        for cat in range(1, 14):
            os.makedirs(os.path.join(output_dir, str(cat)), exist_ok=True)
    except Exception as e:
        return jsonify({"error": f"Failed to create category subfolders: {str(e)}"}), 500

    session_state.images_dir = images_dir
    session_state.output_dir = output_dir
    session_state.history = []
    
    scan_images()
    save_last_session(images_dir, output_dir)

    return jsonify({
        "success": True,
        "images": session_state.images,
        "labeled": session_state.labeled,
        "current_index": session_state.current_index
    })

@app.route('/api/image')
def serve_image():
    filename = request.args.get('filename')
    if not filename or not session_state.images_dir:
        return "Missing parameter", 400

    # Path safety check
    safe_path = os.path.abspath(os.path.join(session_state.images_dir, filename))
    if not safe_path.startswith(os.path.abspath(session_state.images_dir)):
        return "Access denied", 403

    if not os.path.exists(safe_path):
        return "File not found", 404

    return send_from_directory(session_state.images_dir, filename)

@app.route('/api/label', methods=['POST'])
def label_image():
    if not session_state.images:
        return jsonify({"error": "No images loaded."}), 400

    data = request.json or {}
    filename = data.get("filename")
    category = str(data.get("category"))

    if filename not in session_state.images:
        return jsonify({"error": "Invalid filename."}), 400

    # Validate category range 1 to 13
    try:
        cat_num = int(category)
        if cat_num < 1 or cat_num > 13:
            raise ValueError()
    except ValueError:
        return jsonify({"error": "Category must be a number between 1 and 13."}), 400

    src_path = os.path.join(session_state.images_dir, filename)
    dest_dir = os.path.join(session_state.output_dir, category)
    dest_path = os.path.join(dest_dir, filename)

    try:
        # Check if file already exists in output folder and remove it if rewriting
        # (Though we copy it, standard shutil.copy2 overwrites)
        shutil.copy2(src_path, dest_path)
    except Exception as e:
        return jsonify({"error": f"Failed to copy file: {str(e)}"}), 500

    # Add to undo history
    session_state.history.append({
        "filename": filename,
        "category": category,
        "prev_index": session_state.current_index
    })

    # Update state
    session_state.labeled[filename] = category

    # Advance current index if we labeled the current active image
    if filename == session_state.images[session_state.current_index]:
        if session_state.current_index < len(session_state.images) - 1:
            session_state.current_index += 1

    return jsonify({
        "success": True,
        "labeled": session_state.labeled,
        "current_index": session_state.current_index,
        "has_history": True
    })

@app.route('/api/undo', methods=['POST'])
def undo_label():
    if not session_state.history:
        return jsonify({"error": "No history to undo."}), 400

    last_action = session_state.history.pop()
    filename = last_action["filename"]
    category = last_action["category"]
    prev_index = last_action["prev_index"]

    # Delete the copied file from output directory
    dest_path = os.path.join(session_state.output_dir, category, filename)
    if os.path.exists(dest_path):
        try:
            os.remove(dest_path)
        except Exception as e:
            return jsonify({"error": f"Failed to remove file during undo: {str(e)}"}), 500

    # Remove from session labels
    if filename in session_state.labeled:
        del session_state.labeled[filename]

    # Revert index
    session_state.current_index = prev_index

    return jsonify({
        "success": True,
        "labeled": session_state.labeled,
        "current_index": session_state.current_index,
        "has_history": len(session_state.history) > 0
    })

@app.route('/api/skip', methods=['POST'])
def skip_image():
    if not session_state.images:
        return jsonify({"error": "No images loaded."}), 400

    if session_state.current_index < len(session_state.images) - 1:
        session_state.current_index += 1

    return jsonify({
        "success": True,
        "current_index": session_state.current_index
    })

@app.route('/api/prev', methods=['POST'])
def prev_image():
    if not session_state.images:
        return jsonify({"error": "No images loaded."}), 400

    if session_state.current_index > 0:
        session_state.current_index -= 1

    return jsonify({
        "success": True,
        "current_index": session_state.current_index
    })

@app.route('/api/jump', methods=['POST'])
def jump_image():
    if not session_state.images:
        return jsonify({"error": "No images loaded."}), 400

    data = request.json or {}
    index = data.get("index")

    if index is None or not isinstance(index, int) or index < 0 or index >= len(session_state.images):
        return jsonify({"error": "Invalid index."}), 400

    session_state.current_index = index

    return jsonify({
        "success": True,
        "current_index": session_state.current_index
    })

if __name__ == '__main__':
    # Start the server on port 5000 (or other if occupied)
    import socket
    port = 5000
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    try:
        s.bind(('127.0.0.1', port))
        s.close()
    except socket.error:
        # Port is already in use, find an open port
        s.bind(('127.0.0.1', 0))
        port = s.getsockname()[1]
        s.close()

    print(f"Starting labeling UI server on http://127.0.0.1:{port}")
    # Open webbrowser automatically in a local environment
    try:
        webbrowser.open(f"http://127.0.0.1:{port}")
    except Exception:
        pass
        
    app.run(host='127.0.0.1', port=port, debug=True)
