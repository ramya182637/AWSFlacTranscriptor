# Flac Transcriptor

## Project Overview
Cloud-based web application that takes `.flac` audio files as input, transcribes speech using Google Speech-to-Text API, and sends the subtitle (`.srt`) file to the user via email.

## Table of Contents
  - [Technology Overview](#technology-overview)
  - [Flow of Execution](#flow-of-execution)
  
## Technology Overview
 - **Frontend**: `Docker + React`, deployed on `AWS Elastic Beanstalk`
 - **Backend**: `Nodejs` functions deployed on `AWS Lambda` & Exposed via `AWS API Gateway`
 - **Audio File & Subtitle Storage**: `AWS Simple Storage Service (S3)`
 - **Transcription Service**: `Google Speech-to-Text API`
 - **Triggering Lambda**: `Amazon EventBridge`
 - **Email**: `Amazon Simple Email Service (SES)`
 - **Security Monitoring**: `Amazon GuardDuty`
 - For **Infrastructure as Code (IaC)**: `AWS CloudFormation`
 - **Logging**: `AWS CloudWatch`

**Note**: To understand all these steps, check flow of execution section after components.

### Components:

1. **AWS Lambda**: 3 Lambda functions are created—for creating pre-signed S3 URLs, triggering transcription via Google API, and sending email via SES. Scales automatically based on demand.

2. **AWS Elastic Beanstalk**: Hosts containerized React frontend code. Provisions scalable infrastructure using EC2, Load Balancer, and Auto Scaling group.

3. **Amazon S3**: Used to store uploaded `.flac` audio files and the generated `.srt` subtitle files. Secure, durable, and highly available storage.

4. **AWS API Gateway**: Exposes a Lambda function to generate a pre-signed S3 URL as REST API for frontend use.

5. **Amazon EventBridge**: Triggers Lambda function responsible for processing and emailing transcription output.

6. **Google Speech-to-Text API**: Processes uploaded `.flac` files and returns transcription in subtitle (`.srt`) format.

7. **Amazon SES**: Sends formatted emails with download links to subtitle files.

8. **Amazon GuardDuty**: Monitors the AWS environment for suspicious activity and potential threats to improve security posture.

## Flow of Execution

1. The user accesses the frontend hosted on AWS Elastic Beanstalk.

2. The frontend is loaded in the browser and provides a form for the user to enter their email and upload a `.flac` audio file.

3. The frontend sends a request to API Gateway for a pre-signed S3 upload URL.

4. API Gateway invokes Lambda Function 1: `GenerateS3PresignedURL`.

5. This Lambda verifies the email with SES, and if valid, returns a pre-signed URL for `.flac` upload.

6. The frontend uploads the audio file with the email as metadata directly to S3.

7. The upload event in S3 triggers Lambda Function 2: `ProcessFlacTranscription`.

8. Lambda 2 downloads the `.flac` file, calls the Google Speech-to-Text API, receives the transcription, converts it into `.srt` format, and stores it back in S3.

9. Once the transcription is uploaded, an S3 event or EventBridge rule triggers Lambda Function 3: `SendEmailWithSubtitles`.

10. Lambda 3 generates a downloadable S3 link and uses Amazon SES to send the email to the user.

11. The user opens the email and downloads the `.srt` file.

12. Throughout, **GuardDuty** monitors the environment for unauthorized or anomalous activity.


**Note**: The Transcription can be done using Amazon Transcribe service and this serive also supports mp3 , mp4 files.So we can generate .srt files for both audio and video if needed.


