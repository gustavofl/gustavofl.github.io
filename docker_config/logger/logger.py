from flask import Flask, request
from datetime import datetime
import pytz

app = Flask(__name__)

def log(message):
    recife_tz = pytz.timezone('America/Recife')
    now = datetime.now(recife_tz).strftime('%Y-%m-%d %H:%M:%S')
    with open('/app/request.log', 'a') as log_file:
        log_file.write(f"[{now}] {message}\n")

@app.route('/', methods=['GET','POST', 'PUT', 'PATCH'])
def log_request():
    body = request.get_data(as_text=True)
    log(f"Request Body: {body}")
    return 'Logged', 200

if __name__ == '__main__':
    app.run(debug=False, port=5000, host='0.0.0.0')