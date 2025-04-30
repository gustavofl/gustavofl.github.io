from flask import Flask, request
from flask_cors import CORS
import json

app = Flask(__name__)
CORS(app)

@app.route('/log', methods=['POST'])
def log_entry():
    data = request.get_json()
    if not data:
        return {"error": "JSON esperado"}, 400

    try:
        with open('/app/app.log', 'a') as f:
            json.dump(data, f)
            f.write('\n') # Add a newline after each log entry
        return {"status": "ok"}, 200
    except Exception as e:
        return {"error": f"Erro ao gravar log: {e}"}, 500

@app.route('/ping', methods=['GET'])
def ping():
    return {"message": "pong"}, 200

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
