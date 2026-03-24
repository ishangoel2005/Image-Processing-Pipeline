# Serverless Image Recognition App

A full-stack serverless application for uploading images, extracting EXIF data, resizing thumbnails, and tagging objects using Amazon Rekognition.

## Architecture

- **Frontend**: React (Vite) hosted on AWS Amplify Console.
- **Backend Infrastructure**: AWS Serverless Application Model (SAM).
- **Storage**: Amazon S3
- **Database**: Amazon DynamoDB
- **Compute**: AWS Lambda orchestrating via AWS Step Functions
- **AI/ML**: Amazon Rekognition

## Deployment Instructions

### 1. Build and Deploy the Backend

The backend is built with AWS SAM. Ensure you have the [AWS SAM CLI](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html) installed.

```bash
cd src/cloudformation

# Build the SAM application
sam build

# Deploy to your AWS account
sam deploy --guided
```

This will deploy the entire stack: Cognito, Step Functions, DynamoDB, S3, and Lambda functions. 
Note the Outputs provided at the end of the deployment: `UserPoolId`, `UserPoolClientId`, `IdentityPoolId`, `PhotoRepoBucketName`, `Region`.

### 2. Configure and Run the Frontend

The React frontend uses Vite. Copy the backend stack outputs into the environment file.

```bash
cd src/react-frontend

# Install dependencies (ensure you have Node.js 20+)
npm install aws-amplify @aws-amplify/ui-react react-router-dom lucide-react

# Create a .env file with your specific AWS resources
cat << EOF > .env
VITE_REGION=us-east-1
VITE_USER_POOL_ID=<Your_UserPoolId>
VITE_USER_POOL_CLIENT_ID=<Your_UserPoolClientId>
VITE_IDENTITY_POOL_ID=<Your_IdentityPoolId>
VITE_S3_BUCKET=<Your_PhotoRepoBucketName>
VITE_DYNAMODB_TABLE=ImageMetadataTable
EOF

# Start the local development server
npm run dev
```

### 3. Deploy Frontend using AWS Amplify Console

1. Push your code to a Git repository (GitHub/GitLab/Bitbucket/CodeCommit).
2. Open the AWS Amplify Console.
3. Choose "Host web app" and connect your repository.
4. Set the build settings:
   - Base directory: `src/react-frontend`
   - Build command: `npm install && npm run build`
   - Output directory: `dist`
5. Add the environment variables (`VITE_REGION`, `VITE_USER_POOL_ID`, etc.) in the Amplify build environment configuration.
6. Deploy!

## Usage

1. **Sign Up**: Create an account using the UI.
2. **Albums**: Create an album or just upload to the default album.
3. **Upload**: Select a JPG/PNG. You'll see the frontend automatically tracking the processing status.
4. **Gallery**: Check your album to see the resized photo along with Rekognition tags, EXIF data, and size information.

## How it works (Behind the Scenes)
- S3 upload triggers `s3trigger.js` Lambda function.
- Lambda validates the path is an upload, extracts the user ID, and starts the `ImageProcStateMachine` execution.
- Step Functions sequentially exacts EXIF metadata, checks the format, stores it in DynamoDB as `PROCESSING`.
- In parallel branches, it queries Amazon Rekognition for tags AND uses `Jimp` to shrink it to a 256px thumbnail. 
- Results are saved back, and the status changes to `COMPLETED`. The React UI polls DynamoDB for this change and natively updates the displayed photo layout.
