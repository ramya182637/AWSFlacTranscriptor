import axios from 'axios';
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";
import { Storage } from '@google-cloud/storage';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';

// Constants from environment variables
const SEND_EMAIL_LAMBDA_ARN = process.env.SEND_EMAIL_LAMBDA_ARN;
const API_KEY = process.env.API_KEY;
const GCS_BUCKET_NAME = process.env.GCS_BUCKET_NAME;
 
export async function handler(event) {
  const bucketName = event["Records"][0]["s3"]["bucket"]["name"];
  const fileName = event["Records"][0]["s3"]["object"]["key"];
  const localFilePath = `/tmp/${uuidv4()}-${path.basename(fileName)}`;
  const gcsFileName = `audio/${uuidv4()}-${path.basename(fileName)}`;

  try {
    // Initialize clients
    const s3Client = new S3Client();
    const storage = new Storage();
    const lambdaClient = new LambdaClient();

    // Download file from S3
    const getObjectCommand = new GetObjectCommand({
      Bucket: bucketName,
      Key: fileName,
    });
    const s3Response = await s3Client.send(getObjectCommand);
    const fileStream = fs.createWriteStream(localFilePath);
    s3Response.Body.pipe(fileStream);
    await new Promise((resolve, reject) => {
      fileStream.on('finish', resolve);
      fileStream.on('error', reject);
    });

    // Upload file to GCS
    await storage.bucket(GCS_BUCKET_NAME).upload(localFilePath, {
      destination: gcsFileName,
    });
    const gcsUri = `gs://${GCS_BUCKET_NAME}/${gcsFileName}`;
    console.log("GCS URI: ", gcsUri);

    // Set up the transcription request payload
    const requestPayload = {
      audio: {
        uri: gcsUri,
      },
      config: {
        encoding: 'FLAC', // Adjust based on your file format
        sampleRateHertz: 48000, // Adjust based on your audio file
        languageCode: 'en-US',
        enableAutomaticPunctuation: true,
        audio_channel_count: 2
      },
    };

    // Make the API request
    const response = await axios.post(
      `https://speech.googleapis.com/v1p1beta1/speech:recognize?key=${API_KEY}`,
      requestPayload
    );

    // Process the transcription results
    /*const transcription = response.data.results
      .map(result => result.alternatives[0].transcript)
      .join('\n');*/

      const transcription = response.data.results
      ? response.data.results
          .map(result => result.alternatives[0].transcript)
          .join('\n')
      : "";
    
    console.log("Transcription: ", transcription);

    console.log("Payload being sent to Lambda:", JSON.stringify({
      transcription: transcription || "",
      fileName: fileName || "",
      bucketName: bucketName || ""
    }));
    
    const invokeCommand = new InvokeCommand({
      FunctionName: SEND_EMAIL_LAMBDA_ARN,
      InvocationType: "Event",
      Payload: JSON.stringify({
        transcription: transcription || "",
        fileName: fileName || "",
        bucketName: bucketName || ""
      }),
    });

    await lambdaClient.send(invokeCommand);

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Transcription complete and email sent.' }),
    };
  } catch (error) {
    console.error("Error:", error.message);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  } finally {
    // Cleanup local file if it exists
    if (fs.existsSync(localFilePath)) {
      fs.unlinkSync(localFilePath);
    }
  }
}
