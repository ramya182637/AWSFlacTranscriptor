import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"; 

const S3_BUCKET_NAME = process.env.S3_BUCKET_NAME; 
const SNS_TOPIC_ARN = process.env.SNS_TOPIC_ARN; 

// Utility function to convert text to SRT format
function textToSrt(transcription) {
  const segments = transcription.split('\n').map((text, index) => {
    const start = index * 3; // Simulate start time for each line
    const end = start + 2;   // Simulate end time for each line
    return `${index + 1}\n${formatTime(start)} --> ${formatTime(end)}\n${text}\n`;
  });
  return segments.join('\n');
}

function formatTime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},000`;
}

// Function to generate a pre-signed URL
async function generatePresignedUrl(bucketName, objectKey, s3Client) {
  const command = new GetObjectCommand({
    Bucket: bucketName,
    Key: objectKey,
  });

  // Generate a pre-signed URL using the AWS SDK v3 method
  const url = await getSignedUrl(s3Client, command, { expiresIn: 3600 }); // URL valid for 1 hour
  return url;
}

export async function handler(event, context) {
  console.log("Received event: ", JSON.stringify(event, null, 2));
  
  const { transcription, fileName, bucketName } = event;

  if (!transcription || !fileName || !bucketName) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Missing required fields" }),
    };
  }

  // Convert transcription to SRT format
  const srtContent = textToSrt(transcription);

  // Upload SRT file to S3
  const s3Client = new S3Client();
  const s3Params = {
    Bucket: S3_BUCKET_NAME,
    Key: `${fileName}.srt`,
    Body: srtContent,
    ContentType: 'text/plain', // Correct content type
  };
  await s3Client.send(new PutObjectCommand(s3Params));

  // Generate the pre-signed URL for the S3 object
  const s3Url = await generatePresignedUrl(S3_BUCKET_NAME, `${fileName}.srt`, s3Client);

  // Create the SNS message with subtitle URL and media file name
  const subject = `Subtitles Generated - ${fileName}`;
  const message = `File Name: ${fileName}\nSubtitle URL: ${s3Url}\n\nYou can download the subtitles from the link above.`;

  // Send the SNS notification
  const snsClient = new SNSClient();
  const snsCommand = new PublishCommand({
    TopicArn: SNS_TOPIC_ARN,
    Message: message,
    Subject: subject,
  });
  const snsResponse = await snsClient.send(snsCommand);

  console.log("SNSClient response: ", snsResponse);

  return {
    statusCode: 200,
    body: JSON.stringify(snsResponse),
  };
}
