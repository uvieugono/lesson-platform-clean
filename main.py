import os
from flask import Flask, request, jsonify, Request  # Added Request import
from firebase_admin import firestore, initialize_app, credentials
import firebase_admin
import logging
import uuid
from datetime import datetime, timezone  # Add timezone import
from flask_cors import CORS
import google.generativeai as genai
from dotenv import load_dotenv
from google.api_core import exceptions
from google.generativeai.types import GenerationConfig  # Add this import

# Configure logging
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Initialize Firebase Admin
if not firebase_admin._apps:
    try:
        if os.getenv('GOOGLE_APPLICATION_CREDENTIALS'):
            cred = credentials.Certificate(os.getenv('GOOGLE_APPLICATION_CREDENTIALS'))
            firebase_admin.initialize_app(cred)
        else:
            firebase_admin.initialize_app()
        logger.info("Firebase initialized successfully")
    except Exception as e:
        logger.error(f"Error initializing Firebase: {e}")

# Initialize Firestore
try:
    db = firestore.client()
    logger.info("Firestore client initialized successfully")
except Exception as e:
    logger.error(f"Error initializing Firestore client: {e}")

# Initialize Flask app
app = Flask(__name__)
# Allow all origins for development, adjust as needed for production
CORS(app, origins=['*'], allow_headers=['Content-Type'], methods=['POST'])

# Initialize Gemini
genai.configure(api_key=os.getenv('PALM_API_KEY'), transport='rest')
model = genai.GenerativeModel('gemini-pro')

def create_response(success: bool, message: str, data=None, status_code=200):
    response = {
        'success': success,
        'message': message,
        'timestamp': datetime.now(timezone.utc).isoformat()  # Updated line
    }
    if data is not None:
        response['data'] = data

    # Log the response for debugging
    logger.info(f"Sending response: {response}")
    return jsonify(response), status_code

def find_lesson_by_ref(lesson_ref: str, country: str, curriculum: str, grade: str, level: str, subject: str):
    doc_path = (
        f"countries/{country}/curriculums/{curriculum}/"
        f"grades/{grade}/levels/{level}/subjects/{subject}/lessonRef/{lesson_ref}"
    )
    logger.debug(f"Looking for document at: {doc_path}")
    
    doc_ref = db.document(doc_path)
    doc = doc_ref.get()
    
    if not doc.exists:
        logger.error(f"Document not found at path: {doc_path}")
        raise ValueError(f"Document not found at path: {doc_path}")
    
    return doc_ref.path, doc.to_dict()

# The following try-except block was causing indentation errors - it has been removed
# try:
#     # Code that might raise an exception
#     # ...
# except Exception as e:
#     # Handle the exception (e.g., log the error, return an error response)
#     logger.error(f"An error occurred: {e}")
#     # ...

def initialize_lesson_data(student_id, lesson_ref, lesson_path, lesson_data):
    """Centralized function for initializing sessions and lesson states"""
    # Enhanced lesson data remains the same
    enhanced_lesson_data = {
        'lessonRef': lesson_ref,
        'title': lesson_data.get('title', 'Untitled Lesson'),
        'content': {
            'introduction': lesson_data.get('introduction', ''),
            'sections': lesson_data.get('sections', []),
            'key_concepts': lesson_data.get('key_concepts', []),
            'examples': lesson_data.get('examples', [])
        },
        'interactiveElements': lesson_data.get('interactiveElements', []),
        'quizzes': lesson_data.get('quizzes', []),
        'examContent': lesson_data.get('examContent', []),
        'objectives': lesson_data.get('objectives', []),
        'prerequisites': lesson_data.get('prerequisites', []),
        'resources': lesson_data.get('resources', []),
        'metadata': {
            'difficulty_level': lesson_data.get('difficulty_level', 'intermediate'),
            'estimated_duration': lesson_data.get('estimated_duration', 30),
            'tags': lesson_data.get('tags', []),
            'subject': lesson_data.get('subject', ''),
            'topic': lesson_data.get('topic', '')
        }
    }

    # Create session - moved from initialize_lesson route
    session_id = f"session_{str(uuid.uuid4())}"
    session_data = {
        'session_id': session_id,
        'student_id': student_id,
        'lesson_ref': lesson_ref,
        'lesson_path': lesson_path,
        'status': 'active',
        'created_at': firestore.SERVER_TIMESTAMP,
        'last_interaction': firestore.SERVER_TIMESTAMP,
        'progress': 0,
        'completion_status': 'in_progress'
    }
    db.collection('lesson_sessions').document(session_id).set(session_data)

    # Create lesson state - moved from initialize_lesson route
    lesson_state = {
        'current_section': 0,
        'completed_sections': [],
        'quiz_attempts': 0,
        'current_score': 0,
        'interactive_elements_state': {},
        'time_spent': 0,
        'total_duration': lesson_data.get('metadata', {}).get('estimated_duration', 30)
    }
    db.collection('lesson_states').document(session_id).set(lesson_state)

    return session_id, enhanced_lesson_data, lesson_state

@app.route('/initialize-lesson', methods=['POST'])
def initialize_lesson():
    try:
        data = request.get_json()
        student_id = data.get('student_id')
        lesson_ref = data.get('lesson_ref')
        country = data.get('country')
        curriculum = data.get('curriculum')
        grade = data.get('grade')
        level = data.get('level')
        subject = data.get('subject')

        # Validation
        if not all([student_id, lesson_ref, country, curriculum, grade, level, subject]):
            return create_response(False, 'Missing required fields', status_code=400)

        # Find lesson document
        lesson_path, lesson_data = find_lesson_by_ref(
            lesson_ref, country, curriculum, grade, level, subject
        )

        # Single point of initialization
        session_id, enhanced_data, lesson_state = initialize_lesson_data(
            student_id, lesson_ref, lesson_path, lesson_data
        )

        return create_response(
            True,
            'Lesson initialized successfully',
            {
                'session_id': session_id,
                'lessonData': enhanced_data,
                'state': lesson_state
            }
        )

    except Exception as e:
        logger.error(f"Error initializing lesson: {e}")
        return create_response(False, str(e), status_code=500)

def fetch_lesson_data(lesson_ref):
    """
    Fetch lesson data from Firestore based on the lesson_ref.
    """
    try:
        # Query Firestore for the lesson document
        lesson_query = db.collection('lessons').where('lessonRef', '==', lesson_ref).get()
        if lesson_query:
            return lesson_query[0].to_dict()  # Return the first matching document
        return None
    except Exception as e:
        logger.error(f"Error fetching lesson data: {e}")
        return None

@app.route('/pause-lesson', methods=['POST'])
def pause_lesson():
    try:
        data = request.get_json()
        session_id = data.get('session_id')
        timestamp = data.get('timestamp', datetime.utcnow().isoformat())
        reason = data.get('reason', 'No reason provided')

        if not session_id:
            return create_response(False, 'Missing session_id', status_code=400)

        db.collection('lesson_sessions').document(session_id).update({
            'status': 'paused',
            'last_active': timestamp,
            'pause_reason': reason
        })
        return create_response(True, 'Lesson paused successfully')
    except Exception as e:
        logger.error(f"Error pausing lesson: {e}")
        return create_response(False, str(e), status_code=500)

@app.route('/resume-lesson', methods=['POST'])
def resume_lesson():
    try:
        data = request.get_json()
        session_id = data.get('session_id')
        timestamp = data.get('timestamp', datetime.utcnow().isoformat())

        if not session_id:
            return create_response(False, 'Missing session_id', status_code=400)

        db.collection('lesson_sessions').document(session_id).update({
            'status': 'active',
            'last_resumed': timestamp
        })
        return create_response(True, 'Lesson resumed successfully')
    except Exception as e:
        logger.error(f"Error resuming lesson: {e}")
        return create_response(False, str(e), status_code=500)

@app.route('/generate-notes', methods=['POST'])
def generate_notes():
    """
    Generate dynamic, age-appropriate notes with key summary headers (LessonRef, Subject, Topic).
    Homework tasks are dynamically created by Gemini based on student performance.
    """
    try:
        data = request.get_json()

        # Required fields
        lesson_ref = data.get('lessonRef')
        student_id = data.get('studentId')

        if not lesson_ref or not student_id:
            return create_response(False, 'Missing required fields: lessonRef, studentId', status_code=400)

        # ... (Your logic to generate notes using Gemini) ...

        # Instead of setting completion status here, just return the notes data.
        return create_response(True, 'Notes generated successfully', note_data)

    except Exception as e:
        logger.error(f"Error generating notes: {e}")
        return create_response(False, str(e), status_code=500)

def calculate_engagement(time_spent: int, total_duration: int) -> float:
    """Calculate engagement as percentage of time spent vs total lesson duration"""
    if total_duration <= 0:
        return 0.0  # Prevent division by zero
    
    engagement = (time_spent / total_duration) * 100
    return min(engagement, 100)  # Cap at 100%

def calculate_avg_response_time(interactions):
    # Placeholder function to calculate average response time
    total_response_time = sum(interaction.get('response_time', 0) for interaction in interactions)
    return total_response_time / len(interactions) if interactions else 0

def calculate_pause_analysis(interactions):
    # Placeholder function to analyze pauses
    return {"total_pauses": sum(1 for interaction in interactions if interaction.get('type') == 'pause')}

def aggregate_tool_usage(interactions):
    # Placeholder function to aggregate tool usage
    tool_usage = {}
    for interaction in interactions:
        tools = interaction.get('tool_usage', {})
        for tool, usage in tools.items():
            if tool not in tool_usage:
                tool_usage[tool] = 0
            tool_usage[tool] += usage
    return tool_usage

def update_topics(doc_data, interaction_data, topic_type):
    # Placeholder function to update topics mastered or struggled
    existing_topics = set(doc_data.get(f'topics_{topic_type}', []))
    new_topics = set(interaction_data.get(f'topics_{topic_type}', []))
    return list(existing_topics.union(new_topics))

def categorize_bloom_level(interaction_text):
    # Example: Using keywords to determine Bloom's level
    keywords = {
        "remembering": ["define", "list", "recall"],
        "understanding": ["explain", "summarize", "describe"],
        "applying": ["use", "solve", "demonstrate"],
        "analyzing": ["compare", "contrast", "differentiate"],
        "evaluating": ["assess", "critique", "justify"],
        "creating": ["design", "develop", "compose"]
    }
    for level, verbs in keywords.items():
        if any(verb in interaction_text.lower() for verb in verbs):
            return level
    return "unknown"

@app.route('/process-interaction', methods=['POST'])
def process_interaction():
    try:
        data = request.get_json()
        student_id = data.get('student_id')
        lesson_ref = data.get('lesson_ref')
        session_id = data.get('session_id')  # Added session_id
        interaction_data = data.get('interaction_data', {})
        interaction_duration = interaction_data.get('duration', 0)  # In minutes

        if not all([student_id, lesson_ref, session_id]):
            return create_response(False, 'Missing required fields', status_code=400)

        # Get lesson state to update time spent
        lesson_state_ref = db.collection('lesson_states').document(session_id)
        lesson_state = lesson_state_ref.get().to_dict() or {}
        
        # Update time spent with validation
        current_time_spent = lesson_state.get('time_spent', 0)
        new_time_spent = current_time_spent + max(interaction_duration, 0)  # Prevent negative values
        total_duration = lesson_state.get('total_duration', 30)  # Default to 30 mins
        
        # Update lesson state
        lesson_state_ref.update({'time_spent': new_time_spent})

        # Calculate meaningful engagement rate
        engagement_rate = calculate_engagement(new_time_spent, total_duration)

        # Rest of the processing remains similar but uses engagement_rate
        doc_ref = db.collection('lesson_analysis').document(f"{student_id}_{lesson_ref}")
        doc = doc_ref.get()
        
        if (doc.exists()):
            doc_data = doc.to_dict()
            interactions = doc_data.get('interactions', [])
        else:
            doc_data = {
                'student_id': student_id,
                'lesson_ref': lesson_ref,
                'interactions': [],
                'engagement_rate': 0,
                'avg_response_time': 0,
                'tool_usage': {},
                'topics_mastered': [],
                'topics_struggled': [],
                'bloom_analysis': {}
            }
            interactions = []

        # 1. Get the interaction text
        interaction_text = interaction_data.get('text', '')

        # 2. Build a prompt for Gemini
        prompt = (
            f"Analyze the following student interaction text:\n\n"
            f"\"{interaction_text}\"\n\n"
            "1. Identify which Bloom's taxonomy level (remembering, understanding, applying, analyzing, evaluating, creating) best applies.\n"
            "2. Provide a short reason or rationale.\n"
        )

        # 3. Send the prompt to Gemini
        try:
            gemini_response = model.generate_content(
                prompt,
                request_options={'timeout': 30}  # 30-second timeout
            )
            if gemini_response:
                bloom_result = gemini_response.text.strip()
            else:
                bloom_result = "Unable to classify"
        except Exception as e:
            logger.error(f"Gemini API Error: {str(e)}")
            return create_response(False, f"Gemini API Error: {str(e)}", status_code=500)

        # 4. Parse or store the result
        interaction_data['bloom_level'] = bloom_result

        # 5. Append the new interaction and update analysis
        interactions.append(interaction_data)

        valid_levels = ["remembering", "understanding", "applying", "analyzing", "evaluating", "creating"]
        bloom_analysis = doc_data.get('bloom_analysis', {})
        if bloom_result.lower() in valid_levels:
            bloom_analysis[bloom_result.lower()] = bloom_analysis.get(bloom_result.lower(), 0) + 1
        else:
            bloom_analysis["unknown"] = bloom_analysis.get("unknown", 0) + 1

        avg_response_time = calculate_avg_response_time(interactions)
        tool_usage = aggregate_tool_usage(interactions)
        topics_mastered = update_topics(doc_data, interaction_data, 'mastered')
        topics_struggled = update_topics(doc_data, interaction_data, 'struggled')

        # 6. Update document data and save to Firestore in lesson_analysis collection
        doc_data.update({
            'interactions': interactions,
            'engagement_rate': engagement_rate,
            'avg_response_time': avg_response_time,
            'tool_usage': tool_usage,
            'topics_mastered': topics_mastered,
            'topics_struggled': topics_struggled,
            'bloom_analysis': bloom_analysis
        })

        doc_ref.set(doc_data)
        return create_response(True, "Interaction processed successfully", doc_data)

    except Exception as e:
        logger.error(f"Error processing interaction: {e}")
        return create_response(False, str(e), status_code=500)

@app.route('/save-progress', methods=['POST'])
def save_progress(request):  # <-- Add this parameter
    try:
        data = request.get_json()
        session_id = data.get('session_id')
        user_id = data.get('user_id')
        lesson_ref = data.get('lesson_ref')
        progress = data.get('progress')

        if not all([session_id, user_id, lesson_ref, progress is not None]):
            return create_response(False, 'Missing required fields', status_code=400)

        db.collection('lesson_progress').document(session_id).set({
            'session_id': session_id,
            'lesson_ref': lesson_ref,
            'progress': progress,
            'updated_at': firestore.SERVER_TIMESTAMP  # Corrected line
        })

        return create_response(True, 'Progress saved successfully')
    except Exception as e:
        logger.error(f"Error saving progress: {e}")
        return create_response(False, str(e), status_code=500)

@app.route('/ai-tutor', methods=['POST'])
def ai_tutor():
    try:
        data = request.get_json()
        student_id = data.get('student_id')
        question = data.get('question')
        lesson_path = data.get('lesson_path')

        if not all([student_id, question, lesson_path]):
            return create_response(False, 'Missing required fields', status_code=400)

        prompt = f"The student asked: '{question}'. Provide a detailed explanation for the lesson '{lesson_path}'."
        response = model.generate_content(prompt)
        explanation = response.text if response else "No response generated."

        return create_response(True, 'Response generated successfully', {'explanation': explanation})
    except Exception as e:
        logger.error(f"Error in AI Tutor: {e}")
        return create_response(False, str(e), status_code=500)

@app.route('/generate-summary', methods=['POST'])
def generate_summary():
    try:
        data = request.get_json()
        analytics_data = data.get('analytics_data')

        if not analytics_data:
            return create_response(False, 'Missing analytics data', status_code=400)

        prompt = f"Based on this data: {analytics_data}, create a detailed performance summary."
        response = model.generate_content(prompt)
        summary = response.text if response else "No summary generated."

        return create_response(True, 'Summary generated successfully', {'summary': summary})
    except Exception as e:
        logger.error(f"Error generating summary: {e}")
        return create_response(False, str(e), status_code=500)

@app.route('/generate-blooms-summary', methods=['POST'])
def generate_blooms_summary():
    try:
        data = request.get_json()
        bloom_data = data.get('bloom_data')

        if not bloom_data:
            return create_response(False, 'Missing Bloom\'s data', status_code=400)

        prompt = f"Analyze this data: {bloom_data}, and summarize cognitive engagement across Bloom's levels."
        response = model.generate_content(prompt)
        summary = response.text if response else "No summary generated."

        return create_response(True, 'Bloom\'s summary generated successfully', {'summary': summary})
    except Exception as e:
        logger.error(f"Error generating Bloom's summary: {e}")
        return create_response(False, str(e), status_code=500)

@app.route('/save-lesson-notes', methods=['POST'])
def save_lesson_notes():
    try:
        data = request.get_json()

        # Extract required fields
        lesson_ref = data.get('lesson_ref')
        subject = data.get('subject')
        grade_level = data.get('grade_level')
        theme = data.get('theme')
        topic = data.get('topic')
        lesson_title = data.get('lesson_title')
        learning_objectives = data.get('learning_objectives', [])
        content = data.get('content', {})
        homework = data.get('homework', {})
        timestamp = datetime.utcnow().isoformat()

        # Construct the lesson notes document
        lesson_notes = {
            "lessonRef": lesson_ref,
            "subject": subject,
            "gradeLevel": grade_level,
            "theme": theme,
            "topic": topic,
            "lessonTitle": lesson_title,
            "learningObjectives": learning_objectives,
            "content": content,
            "homework": homework,
            "timestamp": timestamp,
        }

        # Save to Firestore in the lesson_notes collection
        doc_ref = db.collection('lesson_notes').document(lesson_ref)
        doc_ref.set(lesson_notes)

        return create_response(True, "Lesson notes saved successfully.")
    except Exception as e:
        logger.error(f"Error saving lesson notes: {e}")
        return create_response(False, str(e), status_code=500)

@app.route('/generate-lesson-notes', methods=['POST'])
def generate_lesson_notes():
    try:
        # Parse request data
        data = request.get_json()
        lesson_ref = data.get('lesson_ref')
        country = data.get('country')
        curriculum = data.get('curriculum')
        grade = data.get('grade')
        level = data.get('level')
        subject = data.get('subject')
        student_id = data.get('student_id')
        include_performance_summary = data.get('include_performance_summary', False)
        timestamp = data.get('timestamp', datetime.utcnow().isoformat())
        format = data.get('format', 'txt')
        download = data.get('download', False)
        lesson_data = data.get('lesson_data', {})  # Get lesson_data from the request

        # Validate input
        if not all([lesson_ref, country, curriculum, grade, level, subject]):
            return create_response(False, "country, curriculum, grade, level, subject, and lesson_ref are required.", status_code=400)

        # Extract lesson content from lesson_data
        key_concepts = lesson_data.get('key_concepts', ["No key concepts available."])
        examples = lesson_data.get('examples', [])
        lesson_summary = lesson_data.get('summary', 'No summary available.')
        lesson_title = lesson_data.get('lessonTitle', 'Untitled Lesson')
        topic = lesson_data.get('topic', 'Untitled Topic')
        theme = lesson_data.get('theme', 'General')
        learning_objectives = lesson_data.get('learningObjectives', [])

        # Generate prompt for Gemini (focus on homework and additional content)
        grade_level = grade  # e.g., "Junior Secondary School 3"

        # Craft a detailed and age-appropriate prompt for Gemini
        prompt = (
            f"Generate age-appropriate homework for a {grade_level} student based on the following lesson:\n\n"
            f"**Lesson Title:** {lesson_title}\n"
            f"**Subject:** {subject}\n"
            f"**Topic:** {topic}\n"
            f"**Key Concepts:** {', '.join(key_concepts)}\n"
            f"**Examples:** {', '.join(examples) if examples else 'No examples available.'}\n"
            f"**Summary:** {lesson_summary}\n\n"
            "**Instructions for Homework:**\n"
            "1. Create fun and interactive homework tasks that reinforce the lesson content.\n"
            "2. Use simple, age-appropriate language suitable for a {grade_level} student.\n"
            "3. Include at least one practice activity, one fun activity, and one exploration task.\n\n"
            "Please generate the homework now."
        )

        # Request homework from Gemini
        logger.info(f"Sending prompt to Gemini: {prompt}")  # Log for debugging
        try:
            gemini_response = model.generate_content(prompt)
            if (gemini_response):
                homework_content = gemini_response.text
            else:
                homework_content = "Gemini could not generate homework."
        except Exception as e:
            logger.error(f"Gemini API Error: {str(e)}")
            return create_response(False, f"Gemini API Error: {str(e)}", status_code=500)

        # Generate detailed lesson notes
        lesson_notes = {
            "lessonRef": lesson_ref,
            "subject": subject,
            "gradeLevel": grade,
            "theme": theme,
            "topic": topic,
            "lessonTitle": lesson_title,
            "learningObjectives": learning_objectives,
            "content": {
                "key_concepts": key_concepts,
                "examples": examples,
                "summary": lesson_summary  # Use the provided summary from lesson_data
            },
            "homework": parse_homework_response(homework_content),  # Parse Gemini's response for homework
            "timestamp": timestamp
        }

        # Instead of setting completion status here, just return the notes data.
        return create_response(True, 'Notes generated successfully', lesson_notes)

    except Exception as e:
        logger.error(f"Error generating notes: {e}")
        return create_response(False, str(e), status_code=500)

def parse_homework_response(homework_content):
    """
    Parse Gemini's response to extract homework tasks.
    """
    # Default homework tasks
    homework = {
        "practice_activity": "Review the key concepts from the lesson and write a short paragraph about what you learned.",
        "fun_activity": "Create a poster or drawing that represents the topic covered in this lesson.",
        "explore_ai": "Upload these lesson notes into NotebookLM to explore further questions about the topic."
    }

    # If Gemini provides a valid response, update the homework tasks
    if homework_content and "**Homework:**" in homework_content:
        # Extract homework tasks from Gemini's response
        homework_section = homework_content.split("**Homework:**")[1].strip()
        tasks = homework_section.split("\n")
        for task in tasks:
            if "**Practice Activity:**" in task:
                homework["practice_activity"] = task.split("**Practice Activity:**")[1].strip()
            elif "**Fun Activity:**" in task:
                homework["fun_activity"] = task.split("**Fun Activity:**")[1].strip()
            elif "**Exploration Task:**" in task:
                homework["explore_ai"] = task.split("**Exploration Task:**")[1].strip()

    return homework

@app.route('/get-sample-lesson-ref', methods=['GET'])
def get_sample_lesson_ref():
    logger.info("Sample lesson ref endpoint called")
    try:
        data = request.get_json()
        country = data.get('country')
        curriculum = data.get('curriculum')
        grade = data.get('grade')
        level = data.get('level')
        subject = data.get('subject')
        lesson_ref = data.get('lesson_ref')

        # Construct the document reference
        doc_path = f"countries/{country}/curriculums/{curriculum}/grades/{grade}/levels/{level}/subjects/{subject}"
        doc_ref = db.document(doc_path)
            
        logger.info(f"Attempting to fetch lesson at path: {doc_ref.path}")
        
        # Get the document
        lesson_doc = doc_ref.get()
        
        if not lesson_doc.exists:
            logger.error(f"No lesson found at path: {doc_ref.path}")
            return create_response(False, f'No lesson found at specified path', status_code=404)
            
        lesson_data = lesson_doc.to_dict()
        logger.info(f"Found lesson: {lesson_doc.id}")
        logger.info(f"Lesson data: {lesson_data}")

        # Return the found lesson data with its full path information
        return create_response(True, 'Sample lesson reference retrieved', {
            'lessonRef': lesson_ref,
            'fullPath': doc_ref.path,
            'lessonData': lesson_data
        })

    except Exception as e:
        logger.error(f"Error getting sample lesson ref: {e}")
        return create_response(False, str(e), status_code=500)

@app.route('/generate-final-report', methods=['POST'])
def generate_final_report():
    """
    Generate and merge performance and Bloom's taxonomy summaries into a final lesson-focused report.
    Saves the merged report in the 'student_reports' collection, including lesson reference and date.
    """
    try:
        data = request.get_json()
        analytics_data = data.get('analytics_data')
        bloom_data = data.get('bloom_data')
        student_id = data.get('student_id')
        lesson_ref = data.get('lesson_ref')

        # Validate required fields
        if not all([analytics_data, bloom_data, student_id, lesson_ref]):
            return create_response(
                False,
                'Missing required fields: analytics_data, bloom_data, student_id, or lesson_ref',
                status_code=400
            )

        # 1. Build a day-month-year timestamp (e.g., "18 January 2025")
        report_date_str = datetime.utcnow().strftime("%d %B %Y")

        # 2. Craft a single prompt that merges analytics and Bloom data in a lesson context
        final_prompt = (
            f"You are generating a final lesson summary for student '{student_id}' on lesson '{lesson_ref}' "
            f"dated {report_date_str}. The data below is strictly about a student's classroom performance, "
            f"not brand engagement.\n\n"
            f"Analytics Data: {analytics_data}\n"
            f"Bloom's Taxonomy Data: {bloom_data}\n\n"
            "Please produce a single comprehensive summary discussing:\n"
            "1. The student's overall performance and engagement (use analytics_data).\n"
            "2. The student's cognitive engagement across Bloom's levels (use bloom_data).\n"
            "3. Keep the report short, direct, and educational.\n"
            "4. Conclude by re-stating the lesson reference and today's date.\n"
        )

        # 3. Generate content from Gemini
        try:
            gemini_response = model.generate_content(
                final_prompt,
                request_options={'timeout': 30}  # 30-second timeout
            )
            if gemini_response:
                final_report = gemini_response.text
            else:
                final_report = "No final report generated."
        except Exception as e:
            logger.error(f"Gemini API Error: {str(e)}")
            return create_response(False, f"Gemini API Error: {str(e)}", status_code=500)

        # 4. Combine date, lesson reference, final report
        final_report_with_heading = (
            f"=== Final Lesson Report ===\n"
            f"Lesson Reference: {lesson_ref}\n"
            f"Date: {report_date_str}\n\n"
            f"{final_report}\n"
        )

        # 5. Save the final merged report in the student_reports collection
        report_data = {
            "student_id": student_id,
            "lesson_ref": lesson_ref,
            "report_type": "final_merged_report",
            "report_content": final_report_with_heading,
            "created_at": datetime.utcnow().isoformat(),
            "report_date": report_date_str
        }
        db.collection('student_reports').document(f"{student_id}_{lesson_ref}").set(report_data, merge=True)

        return create_response(True, 'Final merged report generated successfully', {
            'report': final_report_with_heading
        })

    except Exception as e:
        logger.error(f"Error generating final merged report: {e}")
        return create_response(False, str(e), status_code=500)

@app.route('/lesson-content', methods=['POST'])
def get_lesson_content():
    try:
        logger.info("==== /lesson-content endpoint called ====")
        data = request.get_json()
        logger.debug(f"Request data: {data}")

        # Validate input
        student_id = data.get('student_id')
        lesson_ref = data.get('lesson_ref')
        if not student_id or not lesson_ref:
            logger.error("Missing student_id or lesson_ref")
            return create_response(False, "Missing required fields", status_code=400)

        # Fetch country, curriculum, grade, level, subject from request data
        country = data.get('country')
        curriculum = data.get('curriculum')
        grade = data.get('grade')
        level = data.get('level')
        subject = data.get('subject')
        logger.info(f"Params: country={country}, curriculum={curriculum}, grade={grade}, level={level}, subject={subject}")

        # Locate the Firestore document
        try:
            lesson_path, doc_data = find_lesson_by_ref(lesson_ref, country, curriculum, grade, level, subject)
            logger.info(f"Fetched document from path: {lesson_path}")
            logger.debug(f"Document data: {doc_data}")
        except ValueError as e:
            logger.error(f"Firestore document error: {str(e)}")
            return create_response(False, str(e), status_code=404)

        # Validate document structure
        required_fields = ["lessonContent", "interactiveElements", "quizzes"]
        for field in required_fields:
            if field not in doc_data:
                logger.error(f"Missing field in document: {field}")
                return create_response(False, f"Document missing field: {field}", status_code=500)

        # Build response
        dynamic_content = {
            "lessonContent": doc_data.get("lessonContent", {}),
            "interactiveElements": doc_data.get("interactiveElements", []),
            "quizzes": doc_data.get("quizzes", []),
        }
        return create_response(True, "Lesson content fetched", dynamic_content)

    except Exception as e:
        logger.error(f"Unexpected error: {str(e)}", exc_info=True)  # Log full traceback
        return create_response(False, "Internal server error", status_code=500)

@app.route('/generate-lesson-plan', methods=['POST'])
def generate_lesson_plan():
    try:
        data = request.get_json()  # Use global `request`
        if not data:
            return create_response(False, 'Invalid JSON data', status_code=400)

        # Parameter extraction with validation
        required_fields = {
            'lessonRef': str,
            'studentId': str,
            'learningObjectives': list,
            'country': str,
            'curriculum': str,
            'grade': str,
            'level': str,
            'subject': str
        }
        
        missing = [field for field, _ in required_fields.items() if field not in data]
        if missing:
            return create_response(False, f'Missing required fields: {", ".join(missing)}', status_code=400)

        # Extract parameters
        lesson_ref = data['lessonRef']
        student_id = data['studentId']
        learning_objectives = data['learningObjectives']
        country = data['country']
        curriculum = data['curriculum']
        grade = data['grade']
        level = data['level']
        subject = data['subject']

        # Add validation for learning_objectives
        if not isinstance(learning_objectives, list) or len(learning_objectives) == 0:
            return create_response(False, "Invalid learning objectives format", status_code=400)

        # Firestore document retrieval
        try:
            logger.debug(f"Attempting to fetch lesson: {lesson_ref}")
            lesson_path, lesson_data = find_lesson_by_ref(
                lesson_ref, country, curriculum, grade, level, subject
            )
            logger.debug(f"Retrieved lesson data: {lesson_data}")
            if not lesson_data:
                return create_response(False, "Lesson document not found", status_code=404)
                
        except Exception as e:
            logger.error(f"Firestore error: {str(e)}")
            return create_response(False, "Database error", status_code=500)

        # Data extraction with fallbacks
        metadata = lesson_data.get('metadata', {})
        blooms_levels = metadata.get('blooms_level', metadata.get('BloomsLevel', ["unspecified"]))
        lesson_time_length = metadata.get('estimated_duration', '30 min')
        
        # Time allocation logic
        instructional_steps = lesson_data.get('instructionalSteps') or []
        if not instructional_steps:
            logger.warning("No instructional steps found in document")
        time_allocation = {
            'intro': lesson_data.get('introduction', {}).get('sectionTimeLength', '5 min'),
            'key_concepts': '10 min',
            'guided_practice': '10 min',
            'assessment': '5 min',
            'conclusion': '5 min'
        }
        
        for step in instructional_steps:
            title = step.get('sectionTitle', '').lower()
            if 'key concept' in title:
                time_allocation['key_concepts'] = step.get('sectionTimeLength', time_allocation['key_concepts'])
            elif 'guided practice' in title:
                time_allocation['guided_practice'] = step.get('sectionTimeLength', time_allocation['guided_practice'])
            elif 'assessment' in title:
                time_allocation['assessment'] = step.get('sectionTimeLength', time_allocation['assessment'])

        # Construct final prompt
        prompt = f"""
        You are an AI teacher preparing a comprehensive lesson plan for an individual student, {student_id}, on the topic of '{lesson_data.get('topic', 'Untitled Topic')}' for {grade} level. This lesson plan is for you to deliver directly to this student in a one-on-one, interactive online setting.

        Subject: {subject}
        Topic: {lesson_data.get('topic', 'Untitled Topic')}
        Grade Level: {grade}
        Country: {country}
        Curriculum: {curriculum}
        Lesson Reference: {lesson_ref}
        Student ID: {student_id}

        Learning Objectives:
        - {", ".join(learning_objectives)}

        Lesson Duration: {lesson_time_length} (Please adhere to this duration)

        Lesson Structure:
        1. Introduction (approx. {time_allocation['intro']}):
            - As the AI teacher, I will begin by greeting the student personally, using their ID, {student_id}.
            - I will introduce the topic, {lesson_data.get('topic', 'Untitled Topic')}, and explain why it's relevant to them.
            - I will use an engaging opening, such as a surprising fact or a real-world scenario related to {lesson_data.get('topic', 'Untitled Topic')}, to capture the student's attention. **Do not use video clips.**
        2. Key Concepts (approx. {time_allocation['key_concepts']}):
            - I will explain the key concepts clearly and concisely, using simple, age-appropriate language for {grade} students.
            - I will use a virtual whiteboard to write down definitions and create simple diagrams or charts.
            - For each key concept, I will pause and ask the student a question to check for understanding, encouraging them to respond in the chat. For example, I might ask, "{student_id}, can you give me an example of [key concept] in your daily life?".
            - I will provide at least 3 real-world examples to illustrate each concept, ensuring they are relevant to students' lives in {country}.
        3. Guided Practice (approx. {time_allocation['guided_practice']}):
            - I will engage the student in interactive activities to practice the concepts.
            - For example, I might present a problem on the virtual whiteboard and ask the student to solve it step-by-step, providing guidance and feedback through the chat.
            - I will use questions like, "{student_id}, how would you apply [key concept] in this situation?" to encourage critical thinking.
            - I will provide immediate feedback and prompts during these activities to keep the student on track.
        4. Assessment (approx. {time_allocation['assessment']}):
            - I will conduct a short quiz with exactly 10 questions to assess the student's understanding.
            - The quiz will include a variety of question types: 
                - 4 multiple-choice questions
                - 3 fill-in-the-gap questions
                - 3 short answer questions.
            - **Generate specific quiz questions and answers relevant to '{lesson_data.get('topic', 'Untitled Topic')}' and '{subject}', suitable for '{grade}' students in '{country}' following the '{curriculum}' curriculum. Ensure that these questions align with the Bloom's Taxonomy levels: {", ".join(blooms_levels)}. Provide the correct answers to the quiz questions immediately after each question.**
            - I will provide immediate feedback on each answer, explaining the correct answer if the student's response is incorrect.
        5. Conclusion (approx. {time_allocation['conclusion']}):
            - I will summarize the key takeaways from the lesson, emphasizing the main learning objectives.
            - I will offer encouraging words and acknowledge the student's participation, using their ID, {student_id}.
            - I will preview the next lesson or suggest related topics for the student to explore.

        Interactive Elements:
        - Throughout the lesson, I will frequently ask questions and encourage the student to respond in the chat.
        - I will use polls to quickly check for understanding and keep the student engaged.
        - I will use a virtual whiteboard for interactive problem-solving and demonstrations.
        - I will provide immediate feedback on student responses and adapt my teaching style based on their interaction.
        - I will use interactive elements such as **graphs, charts, animations, flashcards, drag-and-drop activities, and simulations** to enhance understanding and engagement. **Do not suggest videos.**

        Visual Aids:
        - I will use diagrams, images, and charts to explain complex concepts visually.
        - **Instead of video clips, I will use animations and interactive simulations** to demonstrate practical examples of the key concepts.

        Tone and Style:
        - I will maintain a conversational, encouraging, and engaging tone throughout the lesson.
        - I will keep the language simple and easy to understand, suitable for {grade} students.
        - I will address the student directly using their ID, {student_id}.
        - I will use positive reinforcement and encouragement to build confidence.

        Differentiation:
        - For a student who is struggling, I will offer additional explanations, simplified examples, and one-on-one support through the chat.
        - For an advanced student, I will pose extra challenge questions related to {lesson_data.get('topic', 'Untitled Topic')} and encourage them to explore the subject further independently.

        Materials:
        - Virtual whiteboard
        - Presentation software (e.g., Google Slides, PowerPoint)
        - Digital resources (e.g., relevant websites, interactive simulations, **but no videos**)
        - Poll creation tool
        - Chat feature for student interaction

        Please generate the complete lesson plan now, following the specified structure and guidelines, assuming the role of the AI teacher delivering the lesson in a personalized, one-on-one online setting. **Generate specific examples and quiz questions. Do not include any video suggestions or placeholders.**
        """
        
        # Corrected Gemini API call
        try:
            logger.info("Generating lesson plan with Gemini")
            gemini_response = model.generate_content(
                prompt,
                request_options={'timeout': 30}  # Add timeout within request_options
            )
            
            if not gemini_response.text:
                return create_response(False, "Empty response from AI", status_code=500)
                
            return create_response(True, "Success", {"lesson_plan": gemini_response.text})
        except Exception as e:
            logger.error(f"Gemini Error: {str(e)}")
            return create_response(False, "AI service unavailable", status_code=503)

    except ValueError as e:
        logger.error(f"Validation error: {str(e)}")
        return create_response(False, str(e), status_code=400)
    except Exception as e:
        logger.exception(f"Unexpected error: {str(e)}")  # Log full traceback
        return create_response(False, "Internal server error", status_code=500)

@app.route("/", methods=["GET", "POST"])
def lesson_manager():  # Removed parameter
    # Allow both GET and POST methods
    if request.method not in ['GET', 'POST']:
        return jsonify({"error": "Method not allowed"}), 405

    # Handle GET requests
    if request.method == 'GET':
        return jsonify({"message": "GET request successful"}), 200

    # Handle POST requests
    if request.method == 'POST':
        try:
            logger.debug("Request received at /")

            # Check if the request contains JSON data
            if not request.is_json:
                return jsonify({'success': False, 'message': 'Invalid JSON data'}), 400

            # Parse and log request payload
            data = request.get_json()
            logger.debug(f"Parsed payload: {data}")

            # Validate payload
            lesson_ref = data.get('lessonRef')
            if not lesson_ref:
                logger.error("Missing lessonRef")
                return jsonify({'success': False, 'message': 'Missing lessonRef'}), 400

            # Extract parameters
            action = data.get("action")
            student_id = data.get("student_id")
            logger.debug(f"Action: {action}, Student ID: {student_id}, LessonRef: {lesson_ref}")

            # Validate parameters
            if not action or not student_id:
                logger.error("Missing required parameters")
                return jsonify({"success": False, "message": "Missing required parameters"}), 400

            # Process action
            if action == "initiate_lesson":
                logger.info(f"Initiating lesson {lesson_ref} for student {student_id}")
                return jsonify({"success": True, "message": f"Lesson {lesson_ref} initiated for student {student_id}"})

            logger.error(f"Invalid action: {action}")
            return jsonify({"success": False, "message": "Invalid action"}), 400

        except Exception as e:
            # Log the exception with full traceback
            logger.exception("An unexpected error occurred")
            return jsonify({"success": False, "message": f"Internal server error: {str(e)}"}), 500

# Error Handlers
@app.errorhandler(500)
def handle_500_error(e):
    logger.exception("Internal server error occurred")
    return create_response(
        False,
        "An internal server error occurred. Please try again later.",
        status_code=500
    )

@app.errorhandler(404)
def handle_404_error(e):
    return create_response(
        False,
        "The requested resource was not found.",
        status_code=404
    )

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8080))
    app.run(host="0.0.0.0", port=port)


