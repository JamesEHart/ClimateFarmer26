# NOTE:
# This Flask backend is not part of the ClimateFarmer26 frontend app/runtime.
# It is archived here for reference/copying only.
# Current hosted location: https://adaptive-quiz-back-end-NealAddicott.replit.app

from flask import Flask, request, jsonify
import time
import json
import os
import logging
from flask_cors import CORS 
import gspread
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests
from oauth2client.service_account import ServiceAccountCredentials
import datetime

app = Flask(__name__)
allowed_origins = [
    "https://naddicott-dtech.github.io",
    "https://naddicott-dtech.github.io/AdaptiveQuizzer",
    "https://adaptive-quiz-nealaddicott.replit.app",
    "https://3148987b-4847-48ff-ace5-3aa92c0ee281-00-3ixipcxti7yt6.picard.replit.dev"
    # Add more authorized origins if needed
]
CORS(app, resources={r"/*": {"origins": allowed_origins}})

logging.basicConfig(level=logging.INFO,
    format='%(asctime)s %(levelname)s: %(message)s')

# Create data directory if it doesn't exist
os.makedirs("data", exist_ok=True)

# Set up Google Sheets scope - will be used inside request contexts
scope = ['https://spreadsheets.google.com/feeds', 'https://www.googleapis.com/auth/drive']
SPREADSHEET_KEY = '1oKjU_qforobfX5lA1gMum6cLQGo0MzATmNBC6AWxB5g'  # Your Google Sheet ID

# Initialize worksheet as None
worksheet = None

def get_credentials():
    """Return credentials dictionary with properly formatted private key."""
    credentials_json_str = os.environ.get('GOOGLE_CREDENTIALS', '{}')

    # Log a small part of the credentials to verify it's being read (without exposing the full key)
    if len(credentials_json_str) > 30:
        logging.info(f"Read credentials string (first 30 chars): {credentials_json_str[:30]}...")
    else:
        logging.warning("Credentials string is suspiciously short or empty")

    try:
        # Try to parse as JSON
        credentials = json.loads(credentials_json_str)

        logging.info(f"Credentials keys: {list(credentials.keys())}")
        if 'client_email' in credentials:
            logging.info(f"Using service account: {credentials['client_email']}")
        else:
            logging.warning("No client_email found in credentials")

        # Fix the private key format
        if 'private_key' in credentials:
            # Handle all possible escaping scenarios
            private_key = credentials['private_key']

            # Replace double backslashes with single
            private_key = private_key.replace('\\\\n', '\\n')

            # Replace single backslash n with actual newline
            private_key = private_key.replace('\\n', '\n')

            credentials['private_key'] = private_key

            # Log a small part of the beginning and end of the key to verify format
            if len(private_key) > 20:
                start = private_key[:20]
                end = private_key[-20:]
                logging.info(f"Private key format: {start}...{end}")
        else:
            logging.warning("No private_key found in credentials")

        return credentials
    except json.JSONDecodeError as e:
        logging.error(f"Failed to parse credentials JSON: {e}")
        # Log a bit more of the string to debug
        if len(credentials_json_str) > 100:
            logging.error(f"First 100 chars of credentials: {credentials_json_str[:100]}")
        return None

def get_worksheet():
    try:
        credentials = get_credentials()
        if not credentials:
            logging.error("Failed to get valid credentials")
            return None

        logging.info("Creating ServiceAccountCredentials...")
        service_account = ServiceAccountCredentials.from_json_keyfile_dict(
            credentials, scope)

        logging.info("Authorizing gspread with credentials...")
        gc = gspread.authorize(service_account)

        logging.info(f"Opening spreadsheet with key: {SPREADSHEET_KEY}")
        spreadsheet = gc.open_by_key(SPREADSHEET_KEY)

        logging.info("Getting first worksheet...")
        worksheet = spreadsheet.sheet1

        logging.info("Successfully connected to Google Sheets")
        return worksheet
    except Exception as e:
        logging.error(f"Error setting up Google Sheets: {str(e)}")
        # Print full exception details for debugging
        import traceback
        logging.error(traceback.format_exc())
        return None

@app.route('/')
def index():
    return "Quiz Backend API is running"

# Endpoint to verify the Google ID token
@app.route('/verify-token', methods=['POST'])
def verify_token():
    try:
        data = request.get_json()
        token = data.get('id_token')
        CLIENT_ID = os.environ['CLIENT_ID']  # Your secret stored on Replit
        idinfo = id_token.verify_oauth2_token(token, google_requests.Request(), CLIENT_ID)
        userid = idinfo['sub']
        email = idinfo.get('email')
        logging.info("Verified token for user: %s", email)
        return jsonify({'success': True, 'userid': userid, 'email': email}), 200
    except ValueError as e:
        # Token verification failed
        logging.error(f"Token verification failed: {str(e)}")
        return jsonify({'success': False, 'error': 'Invalid token'}), 401

# Endpoint to log a successful login
@app.route('/log_login', methods=['POST'])
def log_login():
    data = request.get_json()
    email = data.get('email')
    if email:
        logging.info("User logged in: %s", email)
        return jsonify({'success': True, 'message': f'Logged {email}'}), 200
    return jsonify({'success': False, 'error': 'No email provided'}), 400

@app.route('/submit_results', methods=['POST'])
def submit_results():
    try:
        data = request.get_json()
        user_email = data.get('user_email', 'unknown')
        logging.info(f"Received results submission from {user_email}")

        # Calculate totals
        total_questions = 0
        correct_questions = 0
        for page in data.get('pages', []):
            for question in page.get('questions', []):
                total_questions += 1
                if question.get('is_correct', False):
                    correct_questions += 1

        percent_correct = 0
        if total_questions > 0:
            percent_correct = round((correct_questions / total_questions) * 100, 2)

        # Get outcome ratings
        outcome_ratings = data.get('outcome_ratings', {})
        outcome_ratings_text = ", ".join([f"{k}: {v}" for k, v in outcome_ratings.items()])

        # Get worksheet inside the request context
        worksheet = get_worksheet()
        sheet_updated = False

        if worksheet:
            try:
                # 1. Add the summary row first
                summary_row = [
                    datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S'),  # Timestamp
                    user_email,                                             # User email
                    data.get('final_rating', 0),                            # Final rating
                    percent_correct,                                        # Percent correct
                    f"{correct_questions}/{total_questions}",               # Score fraction
                    outcome_ratings_text,                                   # Outcome ratings
                    "See detailed responses below"                          # Pointer to details
                ]

                # Add a unique session ID to link related entries
                session_id = f"{user_email}_{datetime.datetime.now().strftime('%Y%m%d%H%M%S')}"
                summary_row.insert(1, session_id)

                worksheet.append_row(summary_row)
                logging.info(f"Added summary row to spreadsheet for user {user_email}")

                # 2. Add a blank row as a separator
                worksheet.append_row([""] * len(summary_row))

                # 3. Add detailed header row
                detail_header = [
                    "Timestamp", "Session ID", "User Email", "Page ID", "Question Type", 
                    "Question Text (Full)", "Student Answer (Full)", "Expected Answer", "Keywords",
                    "Is Correct", "Auto Score", "Adjusted Score", "Feedback"
                ]
                worksheet.append_row(detail_header)

                # 4. Add detailed rows for each question
                current_time = datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')

                for page in data.get('pages', []):
                    page_id = page.get('page_index', 0)

                    for question in page.get('questions', []):
                        # Extract expected answer based on question type
                        expected_answer = ""
                        keywords = ""

                        if question.get('question_type') == "multiple_choice" and "expected_answer" in question:
                            expected_answer = question.get("expected_answer", "")
                        elif question.get('question_type') == "fill_in_blank" and "expected_answer" in question:
                            expected_answer = question.get("expected_answer", "")
                        elif question.get('question_type') == "short_answer" and "keywords" in question:
                            expected_answer = "See keywords"
                            keywords = ", ".join(question.get("keywords", []))

                        # Create a detailed row for each question/answer
                        detail_row = [
                            current_time,                          # Timestamp
                            session_id,                            # Session ID
                            user_email,                            # User Email
                            f"Page {page_id}",                     # Page ID
                            question.get('question_type', ''),     # Question Type
                            question.get('question_text', ''),     # Full Question Text
                            question.get('answer', ''),            # Full Student Answer
                            expected_answer,                       # Expected Answer
                            keywords,                              # Keywords for short answer
                            "Yes" if question.get('is_correct', False) else "No",  # Is Correct
                            question.get('score', 0),              # Auto Score
                            "",                                    # Empty cell for adjusted score
                            question.get('feedback', '')           # Feedback
                        ]

                        worksheet.append_row(detail_row)

                # 5. Add another blank row at the end
                worksheet.append_row([""] * len(summary_row))

                sheet_updated = True
                logging.info(f"Added all detailed rows to spreadsheet for session {session_id}")

            except Exception as e:
                logging.error(f"Error appending to spreadsheet: {str(e)}")
                import traceback
                logging.error(traceback.format_exc())
                sheet_updated = False
        else:
            logging.warning("Worksheet not available, skipping spreadsheet update")
            sheet_updated = False

        # Save full detailed data to a local JSON file (for backup/detailed analysis)
        timestamp = datetime.datetime.now().strftime('%Y%m%d%H%M%S')
        filename = f"data/quiz_{user_email}_{timestamp}.json"

        try:
            with open(filename, 'w') as f:
                json.dump(data, f, indent=2)
            logging.info(f"Saved detailed results to {filename}")
        except Exception as e:
            logging.error(f"Error saving file: {str(e)}")

        return jsonify({
            "status": "success", 
            "message": "Results received and stored",
            "sheet_updated": sheet_updated
        })

    except Exception as e:
        logging.error(f"Error processing submission: {str(e)}")
        import traceback
        logging.error(traceback.format_exc())
        return jsonify({"status": "error", "message": str(e)}), 500

# For compatibility with older code
@app.route('/api/save_results', methods=['POST'])
def save_results():
    try:
        data = request.get_json()
        user_email = data.get('user_email', 'unknown')
        final_rating = data.get('final_rating', 0)
        logging.info(f"Received results for {user_email}: Rating {final_rating}")
        return "Results received. Full implementation coming soon."
    except Exception as e:
        logging.error(f"Error in save_results: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/test', methods=['GET', 'POST'])
def test_api():
    if request.method == 'POST':
        data = request.get_json()
        return jsonify(message="hello to you too", received=data)
    else:
        return jsonify(message="hello to you too")

if __name__ == '__main__':
    # Listen on all interfaces; Replit uses port 8080 by default
    app.run(host='0.0.0.0', port=8080)
