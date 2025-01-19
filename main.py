import os
from flask import Flask, request, jsonify
from google.cloud import firestore
from firebase_admin import firestore as admin_firestore, initialize_app, credentials
import firebase_admin
import logging
import uuid
from datetime import datetime
from flask_cors import CORS
import google.generativeai as genai

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize Firebase Admin and Firestore
if not firebase_admin._apps:
    if os.getenv('GOOGLE_APPLICATION_CREDENTIALS'):
        cred = credentials.Certificate(os.getenv('GOOGLE_APPLICATION_CREDENTIALS'))
        firebase_admin.initialize_app(cred)
    else:
        firebase_admin.initialize_app()

db = admin_firestore.client()

# Initialize Flask app
app = Flask(__name__)
CORS(app)

# Initialize Gemini
genai.configure(api_key=os.getenv('PALM_API_KEY'))
model = genai.GenerativeModel('gemini-pro')

def create_response(success: bool, message: str, data=None, status_code=200):
    response = {
        'success': success,
        'message': message
    }
    if data is not None:
        response['data'] = data
    return jsonify(response), status_code

@app.route('/')
def home():
    return create_response(True, 'Lesson Manager API is running')

def find_lesson_by_ref(lesson_ref: str):
    """
    Find a lesson document in Firestore using its lesson reference ID within the countries collection.
    
    Args:
        lesson_ref: The lesson reference ID
        
    Returns:
        tuple: (document_path, lesson_data) if found
        raises ValueError if not found
    """
    try:
        # Start with countries collection
        countries = db.collection('countries').get()
        
        for country in countries:
            # Build the query path for each country
            lessonRefs = db.collection('countries').document(country.id)\
                .collection('curriculums').document('National Curriculum')\
                .collection('grades')\
                .list_documents()
                
            for grade in lessonRefs:
                # Query within the lessonRef subcollection
                lessons = grade.collection('levels')\
                    .list_documents()
                    
                for level in lessons:
                    subjects = level.collection('subjects')\
                        .list_documents()
                        
                    for subject in subjects:
                        lesson_query = subject.collection('lessonRef')\
                            .where('lessonRef', '==', lesson_ref)\
                            .limit(1)\
                            .get()
                            
                        if lesson_query and len(lesson_query) > 0:
                            lesson_doc = lesson_query[0]
                            return lesson_doc.reference.path, lesson_doc.to_dict()
        
        raise ValueError(f'Lesson with reference {lesson_ref} not found')
        
    except Exception as e:
        logger.error(f"Error finding lesson by reference: {e}")
        raise

@app.route('/initialize-lesson', methods=['POST'])
def initialize_lesson():
    try:
        data = request.get_json()
        student_id = data.get('student_id')
        lesson_ref = data.get('lesson_ref')  # This should be just the lesson reference ID

        if not student_id or not lesson_ref:
            return create_response(False, 'Missing required fields', status_code=400)

        try:
            # Find the lesson using the reference ID
            lesson_path, lesson_data = find_lesson_by_ref(lesson_ref)
            
            # Add the reference ID to the lesson data if not present
            if 'lessonRef' not in lesson_data:
                lesson_data['lessonRef'] = lesson_ref

        except ValueError as ve:
            return create_response(False, str(ve), status_code=404)

        session_id = f"session_{str(uuid.uuid4())}"
        session_data = {
            'session_id': session_id,
            'student_id': student_id,
            'lesson_ref': lesson_ref,
            'lesson_path': lesson_path,
            'lesson_data': lesson_data,
            'status': 'active',
            'created_at': admin_firestore.SERVER_TIMESTAMP
        }

        db.collection('lesson_sessions').document(session_id).set(session_data)
        
        return create_response(True, 'Lesson initialized successfully', {
            'session_id': session_id,
            'lessonData': lesson_data
        })
        
    except Exception as e:
        logger.error(f"Error initializing lesson: {e}")
        return create_response(False, str(e), status_code=500)

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
    try:
        data = request.get_json()
        lesson_ref = data.get('lessonRef')
        student_id = data.get('studentId')

        if not lesson_ref or not student_id:
            return create_response(False, 'Missing required fields', status_code=400)

        # Generate prompt
        prompt = f"Create study notes for lesson {lesson_ref}. Include key concepts and summary."
        response = model.generate_content(prompt)
        note_content = response.text if response else "No content generated."

        note_data = {
            'lessonRef': lesson_ref,
            'noteContent': note_content,
            'noteCreated': datetime.utcnow().isoformat(),  # Use ISO format instead of SERVER_TIMESTAMP
            'studentId': student_id
        }

        # Save to Firestore with SERVER_TIMESTAMP
        db_data = note_data.copy()
        db_data['noteCreated'] = admin_firestore.SERVER_TIMESTAMP  # Use SERVER_TIMESTAMP only for database
        db.collection('student_notes').document(f"{student_id}_{lesson_ref}").set(db_data)

        return create_response(True, 'Notes generated successfully', note_data)
    except Exception as e:
        logger.error(f"Error generating notes: {e}")
        return create_response(False, str(e), status_code=500)

def calculate_engagement(interactions):
    # Placeholder function to calculate engagement rate
    return len(interactions) / 100  # Example calculation

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
        interaction_data = data.get('interaction_data', {})
        interaction_text = interaction_data.get('text', '')

        if not all([student_id, lesson_ref]):
            return create_response(False, 'Missing required fields', status_code=400)

        # Categorize Bloom's level
        bloom_level = categorize_bloom_level(interaction_text)
        interaction_data['bloom_level'] = bloom_level

        doc_ref = db.collection('analytics').document(f"{student_id}_{lesson_ref}")
        doc = doc_ref.get()

        if doc.exists:
            doc_data = doc.to_dict()
            interactions = doc_data.get('interactions', [])
            interactions.append(interaction_data)

            # Update all metrics
            engagement_rate = calculate_engagement(interactions)
            avg_response_time = calculate_avg_response_time(interactions)
            pause_analysis = calculate_pause_analysis(interactions)

            doc_ref.update({
                'engagement_rate': engagement_rate,
                'avg_response_time': avg_response_time,
                'tool_usage': aggregate_tool_usage(interactions),
                'pause_analysis': pause_analysis,
                'topics_mastered': update_topics(doc_data, interaction_data, 'mastered'),
                'topics_struggled': update_topics(doc_data, interaction_data, 'struggled'),
                'interactions': interactions
            })
        else:
            doc_ref.set({
                'student_id': student_id,
                'lesson_ref': lesson_ref,
                'interactions': [interaction_data],
                'engagement_rate': calculate_engagement([interaction_data]),
                'avg_response_time': interaction_data.get('response_time', 0),
                'tool_usage': interaction_data.get('tool_usage', {}),
                'pause_analysis': interaction_data.get('pause_data', {}),
                'topics_mastered': interaction_data.get('topics_mastered', []),
                'topics_struggled': interaction_data.get('topics_struggled', []),
            })

        return create_response(True, "Interaction processed successfully")
    except Exception as e:
        logger.error(f"Error processing interaction: {e}")
        return create_response(False, str(e), status_code=500)

@app.route('/save-progress', methods=['POST'])
def save_progress():
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
            'user_id': user_id,
            'lesson_ref': lesson_ref,
            'progress': progress,
            'updated_at': admin_firestore.SERVER_TIMESTAMP
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
        data = request.get_json()
        lesson_ref = data.get('lesson_ref')

        if not lesson_ref:
            return create_response(False, "lesson_ref is required.", status_code=400)

        # Fetch lesson data from Firestore
        lesson_doc = db.collection('lessons').document(lesson_ref).get()
        if not lesson_doc.exists:
            return create_response(False, "Lesson not found.", status_code=404)

        lesson_data = lesson_doc.to_dict()

        # Dynamically generate notes
        timestamp = datetime.utcnow().isoformat()
        lesson_notes = {
            "lessonRef": lesson_data.get('lessonRef'),
            "subject": lesson_data.get('subject'),
            "gradeLevel": lesson_data.get('gradeLevel'),
            "theme": lesson_data.get('theme'),
            "topic": lesson_data.get('topic'),
            "lessonTitle": lesson_data.get('lessonTitle'),
            "learningObjectives": lesson_data.get('learningObjectives', []),
            "content": {
                "introduction": lesson_data.get('introduction', "Introduction not provided."),
                "bar_graphs": lesson_data.get('bar_graphs', {}),
                "mode": lesson_data.get('mode', {}),
                "everyday_applications": lesson_data.get('everyday_applications', [])
            },
            "homework": generate_homework(lesson_data),
            "timestamp": timestamp,
        }

        # Save generated lesson notes to Firestore
        notes_ref = db.collection('lesson_notes').document(lesson_ref)
        notes_ref.set(lesson_notes)

        return create_response(True, "Lesson notes generated successfully.", lesson_notes)
    except Exception as e:
        logger.error(f"Error generating lesson notes: {e}")
        return create_response(False, str(e), status_code=500)

def generate_homework(lesson_data):
    """
    Generate homework dynamically based on lesson data and student interaction insights.
    """
    return {
        "practice_activity": f"Use NotebookLM to create a bar graph based on the topic '{lesson_data.get('topic')}'.",
        "mode_practice": "Identify the mode of your dataset and explain its significance.",
        "explore_ai": "Upload these lesson notes into NotebookLM to explore further questions about the topic."
    }

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 8080))
    app.run(host='0.0.0.0', port=port)
