# Use the official Python 3.11 slim image
FROM python:3.11-slim

# Install WeasyPrint system dependencies for modern Debian
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libgdk-pixbuf-2.0-0 \
    libffi-dev \
    shared-mime-info \
    fonts-liberation \
    && rm -rf /var/lib/apt/lists/*

# Set the working directory
WORKDIR /app

# Copy your project files into the container
COPY . /app

# Install your specific Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Start the server using Render's required 0.0.0.0 host
CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "10000"]