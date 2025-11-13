# Use an official Python base image
FROM python:3.10-slim

# Set the working directory inside the container
WORKDIR /app

# Copy the requirements file first to leverage Docker cache
COPY requirements.txt .

# Install the dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of your backend code (app.py, models/, etc.)
COPY . .

# Install Gunicorn (a production-ready web server)
RUN pip install gunicorn

# Tell the container to run your app using Gunicorn
# This will run on the $PORT environment variable, which Cloud Run provides
CMD exec gunicorn --bind :$PORT --workers 1 --threads 8 --timeout 0 app:app