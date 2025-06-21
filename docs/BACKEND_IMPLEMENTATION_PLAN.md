# Backend Implementation Plan for Secure Downloads
**Assigned to: Edmundo (Backend Developer)**  
**Priority: High**  
**Estimated Time: 3-5 days**  
**Target Completion: ASAP**

## 🎯 Overview
Implement secure download system to prevent unauthorized access to macOS and Windows application files. Currently, macOS files are publicly accessible via GitHub Actions, creating a security vulnerability where non-paying users can download the software.

## 🔒 Security Problem
- **Current Issue**: macOS DMG files are publicly downloadable from GitHub Actions
- **Risk**: Users can download without paying, only blocked by license validation
- **Solution**: Implement authenticated download system with time-limited tokens

## 🛠️ Implementation Tasks

### Phase 1: Database Schema (Day 1)
Create new tables for download token management:

```sql
-- 1. Download tokens table
CREATE TABLE download_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_email VARCHAR(255) NOT NULL,
    payment_intent_id VARCHAR(255) NOT NULL,
    token_hash VARCHAR(255) UNIQUE NOT NULL,
    platform VARCHAR(50) NOT NULL, -- 'windows', 'macos', 'linux'
    user_agent TEXT,
    ip_address INET,
    expires_at TIMESTAMP NOT NULL,
    used_at TIMESTAMP NULL,
    max_uses INTEGER DEFAULT 3,
    current_uses INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 2. Download logs table
CREATE TABLE download_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_email VARCHAR(255) NOT NULL,
    download_token_id UUID REFERENCES download_tokens(id),
    platform VARCHAR(50) NOT NULL,
    file_name VARCHAR(255),
    file_size BIGINT,
    ip_address INET,
    user_agent TEXT,
    download_started_at TIMESTAMP DEFAULT NOW(),
    download_completed_at TIMESTAMP NULL,
    success BOOLEAN DEFAULT FALSE,
    error_message TEXT NULL
);

-- 3. Indexes for performance
CREATE INDEX idx_download_tokens_email ON download_tokens(customer_email);
CREATE INDEX idx_download_tokens_payment ON download_tokens(payment_intent_id);
CREATE INDEX idx_download_tokens_hash ON download_tokens(token_hash);
CREATE INDEX idx_download_tokens_expires ON download_tokens(expires_at);
CREATE INDEX idx_download_logs_email ON download_logs(customer_email);
CREATE INDEX idx_download_logs_token ON download_logs(download_token_id);
```

### Phase 2: API Endpoints (Day 2-3)
Create new router file: `backend-api/src/backend_api/routers/downloads.py`

#### Endpoint 1: Generate Download Token
```python
@router.post("/generate-token")
async def generate_download_token(
    request: GenerateTokenRequest,
    db: Session = Depends(get_db)
):
    """
    Generate a secure download token after payment verification.
    
    Request Body:
    {
        "customer_email": "user@example.com",
        "payment_intent_id": "pi_xxx",
        "platform": "MacIntel",
        "user_agent": "Mozilla/5.0..."
    }
    
    Response:
    {
        "download_token": "dt_xxx_yyy_zzz",
        "expires_at": "2024-01-01T12:00:00Z",
        "valid_for_hours": 24,
        "max_downloads": 3
    }
    """
    # 1. Verify payment intent exists and is paid
    # 2. Check if customer has valid license
    # 3. Generate secure token (use secrets.token_urlsafe(32))
    # 4. Hash token for storage (use hashlib.sha256)
    # 5. Store in database with expiration
    # 6. Return token to frontend
```

#### Endpoint 2: Secure macOS Download
```python
@router.post("/macos")
async def download_macos(
    request: DownloadRequest,
    db: Session = Depends(get_db)
):
    """
    Provide secure macOS download URL.
    
    Request Body:
    {
        "download_token": "dt_xxx_yyy_zzz",
        "customer_email": "user@example.com"
    }
    
    Response:
    {
        "download_url": "https://storage.googleapis.com/linkedin-automation-secure/macos/xxx.dmg?X-Goog-Signature=...",
        "filename": "LinkedIn_Automation_Tool_v3.1.0-beta_macOS.dmg",
        "expires_at": "2024-01-01T13:00:00Z",
        "file_size": "45MB"
    }
    """
    # 1. Validate download token
    # 2. Check token not expired
    # 3. Verify customer email matches
    # 4. Check usage limits
    # 5. Generate signed GCS URL (1 hour expiry)
    # 6. Log download attempt
    # 7. Update token usage count
    # 8. Return download URL
```

#### Endpoint 3: Secure Windows Download
```python
@router.post("/windows")
async def download_windows(
    request: DownloadRequest,
    db: Session = Depends(get_db)
):
    """
    Provide secure Windows download URL.
    Same logic as macOS but for Windows ZIP file.
    """
    # Same implementation as macOS but for Windows files
```

### Phase 3: Pydantic Models (Day 2)
Create request/response models in `backend-api/src/backend_api/schemas/downloads.py`:

```python
from pydantic import BaseModel, EmailStr
from datetime import datetime
from typing import Optional

class GenerateTokenRequest(BaseModel):
    customer_email: EmailStr
    payment_intent_id: str
    platform: str
    user_agent: Optional[str] = None

class GenerateTokenResponse(BaseModel):
    download_token: str
    expires_at: datetime
    valid_for_hours: int
    max_downloads: int

class DownloadRequest(BaseModel):
    download_token: str
    customer_email: EmailStr

class DownloadResponse(BaseModel):
    download_url: str
    filename: str
    expires_at: datetime
    file_size: str

class DownloadStatsResponse(BaseModel):
    total_downloads: int
    downloads_today: int
    unique_customers: int
    platform_breakdown: dict
```

### Phase 4: Service Layer (Day 3)
Create `backend-api/src/backend_api/services/download_service.py`:

```python
import secrets
import hashlib
from datetime import datetime, timedelta
from typing import Optional
from google.cloud import storage
from google.auth import default
import json

class DownloadService:
    def __init__(self, db: Session):
        self.db = db
        # Initialize GCP Storage client
        self.storage_client = storage.Client()
        self.bucket_name = "linkedin-automation-secure-files"
        self.bucket = self.storage_client.bucket(self.bucket_name)
        
    def generate_token(self, customer_email: str, payment_intent_id: str, 
                      platform: str, user_agent: str = None, 
                      ip_address: str = None) -> dict:
        """Generate secure download token"""
        # 1. Verify payment exists and is successful
        # 2. Generate secure token
        token = secrets.token_urlsafe(32)
        token_hash = hashlib.sha256(token.encode()).hexdigest()
        
        # 3. Store in database with expiration
        expires_at = datetime.utcnow() + timedelta(hours=24)
        
        # 4. Return token data
        return {
            "download_token": token,
            "expires_at": expires_at,
            "valid_for_hours": 24,
            "max_downloads": 3
        }
        
    def validate_token(self, token: str, customer_email: str) -> bool:
        """Validate download token"""
        # 1. Hash token for database lookup
        token_hash = hashlib.sha256(token.encode()).hexdigest()
        
        # 2. Find in database and validate
        # 3. Check expiration, customer email, usage limits
        return True  # Implement actual validation
        
    def generate_download_url(self, platform: str, token: str, 
                            customer_email: str) -> dict:
        """Generate signed GCS URL for download"""
        # 1. Validate token
        if not self.validate_token(token, customer_email):
            raise ValueError("Invalid or expired token")
            
        # 2. Get file info
        file_info = self.get_file_info(platform)
        if not file_info:
            raise ValueError(f"No file available for platform: {platform}")
            
        # 3. Generate signed URL (1 hour expiry)
        blob = self.bucket.blob(file_info["key"])
        signed_url = blob.generate_signed_url(
            version="v4",
            expiration=timedelta(hours=1),
            method="GET"
        )
        
        # 4. Log download attempt
        self._log_download_attempt(customer_email, platform, file_info["filename"])
        
        # 5. Update token usage count
        self._update_token_usage(token)
        
        return {
            "download_url": signed_url,
            "filename": file_info["filename"],
            "expires_at": datetime.utcnow() + timedelta(hours=1),
            "file_size": file_info["size"]
        }
        
    def get_file_info(self, platform: str) -> dict:
        """Get file information for platform"""
        files = {
            "macos": {
                "key": "releases/v3.1.0-beta/LinkedIn_Automation_Tool_v3.1.0-beta_macOS.dmg",
                "filename": "LinkedIn_Automation_Tool_v3.1.0-beta_macOS.dmg",
                "size": "45MB"
            },
            "windows": {
                "key": "releases/v3.1.0-beta/LinkedIn_Automation_Tool_v3.1.0-beta.zip",
                "filename": "LinkedIn_Automation_Tool_v3.1.0-beta.zip", 
                "size": "51MB"
            }
        }
        return files.get(platform.lower())
        
    def _log_download_attempt(self, email: str, platform: str, filename: str):
        """Log download attempt to database"""
        # Implement database logging
        pass
        
    def _update_token_usage(self, token: str):
        """Update token usage count"""
        # Implement usage tracking
        pass
```

### Phase 5: Configuration (Day 1)
Add to `backend-api/src/backend_api/core/config.py`:

```python
# Download security settings
DOWNLOAD_TOKEN_EXPIRY_HOURS: int = 24
DOWNLOAD_URL_EXPIRY_HOURS: int = 1
MAX_DOWNLOADS_PER_TOKEN: int = 3
ENABLE_IP_BINDING: bool = False
ENABLE_GEOGRAPHIC_RESTRICTIONS: bool = False
ALLOWED_COUNTRIES: list = ["US", "CA", "GB", "AU", "DE", "FR"]

# GCP Cloud Storage settings for secure file storage
GCP_PROJECT_ID: str = "junior-api-project"  # Your existing GCP project
GCS_BUCKET_NAME: str = "linkedin-automation-secure-files"
GCS_REGION: str = "us-west1"  # Same region as your Cloud Run
GOOGLE_APPLICATION_CREDENTIALS: str = ""  # Path to service account key (or use default)
```

### Phase 6: GCP Cloud Storage Setup (Day 4)
Set up GCP Cloud Storage bucket for secure file storage:

1. **Create GCS Bucket**:
   ```bash
   # Using gcloud CLI (or via GCP Console)
   gsutil mb -p junior-api-project -c STANDARD -l us-west1 gs://linkedin-automation-secure-files
   
   # Set bucket to private (no public access)
   gsutil iam ch -d allUsers:objectViewer gs://linkedin-automation-secure-files
   gsutil iam ch -d allAuthenticatedUsers:objectViewer gs://linkedin-automation-secure-files
   ```

2. **Upload Files**:
   ```bash
   # Upload your existing files to GCS
   gsutil cp LinkedIn_Automation_Tool_v3.1.0-beta.zip gs://linkedin-automation-secure-files/releases/v3.1.0-beta/
   
   # Upload macOS DMG when available
   gsutil cp LinkedIn_Automation_Tool_v3.1.0-beta_macOS.dmg gs://linkedin-automation-secure-files/releases/v3.1.0-beta/
   ```

3. **Service Account Setup**:
   ```bash
   # Create service account for backend API
   gcloud iam service-accounts create linkedin-automation-downloads \
       --description="Service account for secure downloads" \
       --display-name="LinkedIn Automation Downloads"
   
   # Grant Storage Object Viewer permission
   gcloud projects add-iam-policy-binding junior-api-project \
       --member="serviceAccount:linkedin-automation-downloads@junior-api-project.iam.gserviceaccount.com" \
       --role="roles/storage.objectViewer"
   
   # Create and download key (for local development)
   gcloud iam service-accounts keys create ~/linkedin-downloads-key.json \
       --iam-account=linkedin-automation-downloads@junior-api-project.iam.gserviceaccount.com
   ```

4. **Bucket Structure**:
   ```
   gs://linkedin-automation-secure-files/
   ├── releases/
   │   └── v3.1.0-beta/
   │       ├── LinkedIn_Automation_Tool_v3.1.0-beta_macOS.dmg
   │       └── LinkedIn_Automation_Tool_v3.1.0-beta.zip
   └── future-releases/
       └── v3.2.0/
           └── ...
   ```

### Phase 7: Integration & Testing (Day 5)
1. **Add router to main app**:
   ```python
   # In backend-api/src/backend_api/main.py
   from .routers import downloads
   app.include_router(downloads.router, prefix="/api/downloads", tags=["downloads"])
   ```

2. **Environment Variables**:
   ```bash
   # Add to .env or Cloud Run environment
   GCP_PROJECT_ID=junior-api-project
   GCS_BUCKET_NAME=linkedin-automation-secure-files
   GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account-key.json
   
   # For Cloud Run deployment, use default service account or attach the downloads service account
   ```

3. **Dependencies**:
   ```bash
   # Add to requirements.txt
   google-cloud-storage>=2.10.0
   google-auth>=2.23.0
   google-auth-oauthlib>=1.1.0
   ```

## 🧪 Testing Checklist

### Unit Tests
- [ ] Token generation and validation
- [ ] GCS signed URL generation
- [ ] Token expiration handling
- [ ] Usage limit enforcement
- [ ] Customer verification

### Integration Tests
- [ ] Full download flow (token → download)
- [ ] Payment verification integration
- [ ] GCS signed URL generation and access
- [ ] Database operations
- [ ] Error handling

### Security Tests
- [ ] Token cannot be reused beyond limits
- [ ] Expired tokens are rejected
- [ ] Invalid customer emails are rejected
- [ ] Download URLs expire correctly
- [ ] No unauthorized access to GCS files

## 📊 Monitoring & Analytics

### GCP Monitoring Integration
```python
# Add Cloud Monitoring metrics
from google.cloud import monitoring_v3

def track_download_metrics(platform: str, success: bool):
    """Track download metrics in GCP Monitoring"""
    client = monitoring_v3.MetricServiceClient()
    project_name = f"projects/{GCP_PROJECT_ID}"
    
    # Create custom metrics for download tracking
    # - download_attempts_total
    # - download_success_rate
    # - platform_distribution
```

### Logging Requirements
```python
import logging
from google.cloud import logging as cloud_logging

# Set up Cloud Logging
cloud_logging.Client().setup_logging()
logger = logging.getLogger(__name__)

# Log all download attempts
logger.info(f"Download attempt: {customer_email}, {platform}, {success}")

# Log security events
logger.warning(f"Invalid token used: {token_hash}, {customer_email}")

# Log performance metrics
logger.info(f"Download URL generated in {duration}ms")
```

## 🚨 Error Handling

### Expected Errors
1. **Invalid Token**: Return 401 with clear message
2. **Expired Token**: Return 410 with renewal instructions
3. **Usage Limit Exceeded**: Return 429 with limit info
4. **File Not Found**: Return 404 with support contact
5. **GCS Errors**: Return 503 with retry instructions

### Error Response Format
```json
{
  "error": "token_expired",
  "message": "Download token has expired",
  "code": 410,
  "details": {
    "expired_at": "2024-01-01T12:00:00Z",
    "renewal_url": "https://heyjunior.ai/purchase.html"
  }
}
```

## 🔄 Deployment Steps

1. **Database Migration**: Run SQL scripts to create tables in your existing PostgreSQL
2. **GCS Setup**: Create bucket and upload files
3. **Service Account**: Configure authentication for Cloud Run
4. **Code Deployment**: Deploy new API endpoints to Cloud Run
5. **Testing**: Verify all endpoints work correctly
6. **Monitoring**: Set up Cloud Logging and Monitoring

## 📞 Support & Documentation

### API Documentation
- Add OpenAPI/Swagger documentation for all endpoints
- Include example requests/responses
- Document error codes and messages

### GCP Integration Notes
- Uses existing GCP project and region
- Integrates with Cloud Run service
- Uses Cloud Storage for file hosting
- Cloud Logging for audit trails
- Cloud Monitoring for metrics

## ⚡ Quick Start Commands

```bash
# 1. Set up GCP authentication
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account-key.json

# 2. Create GCS bucket
gsutil mb -p junior-api-project -l us-west1 gs://linkedin-automation-secure-files

# 3. Upload files
gsutil cp *.zip *.dmg gs://linkedin-automation-secure-files/releases/v3.1.0-beta/

# 4. Install dependencies
pip install google-cloud-storage google-auth

# 5. Create database tables
psql -d your_database -f migrations/create_download_tables.sql

# 6. Run tests
pytest tests/test_downloads.py -v

# 7. Start development server
uvicorn backend_api.main:app --reload
```

## 🎯 Success Criteria

- [ ] Download tokens generate successfully after payment
- [ ] macOS downloads require valid tokens
- [ ] Windows downloads work with secure system
- [ ] Fallback to GitHub Actions works if secure download fails
- [ ] All downloads are logged with customer information
- [ ] Token expiration and usage limits are enforced
- [ ] GCS signed URLs work correctly
- [ ] Error handling provides clear user feedback
- [ ] Performance is acceptable (< 2 seconds for token generation)
- [ ] Security tests pass (no unauthorized access possible)

## 📋 Handoff Notes

**Frontend Integration**: The frontend (`success.js`) is already updated to call these endpoints. Test with the existing frontend code.

**Fallback Mechanism**: If secure downloads fail, the system automatically falls back to GitHub Actions. This ensures no disruption to users.

**GCP Integration**: This solution uses your existing GCP infrastructure:
- Same project as your Cloud Run API
- Same region (us-west1) for optimal performance
- Integrates with existing PostgreSQL database
- Uses Cloud Storage instead of external services

**Customer Support**: Failed downloads should be logged with enough detail to help customers. Include customer email, error type, and timestamp.

**Future Enhancements**: This system provides foundation for usage analytics, enterprise features, and advanced security measures.

---

**Questions for Edmundo:**
1. Do you need help setting up the GCS bucket and service account?
2. Should we use the same service account as your Cloud Run or create a dedicated one?
3. Any concerns about the 24-hour token expiry time?
4. Need help with database migration scripts for your PostgreSQL?

**Contact**: Reach out immediately if you need clarification on any part of this implementation plan. 