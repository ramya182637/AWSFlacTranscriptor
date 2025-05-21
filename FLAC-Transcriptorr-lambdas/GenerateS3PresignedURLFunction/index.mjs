import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";

export const handler = async (event) => {
  // Extract the input file name and email of the user.
  const body = JSON.parse(event.body);
  const fileName = body.fileName;
  const email = body.email;

  // Create a Pre-signed URL for the S3 Object with given file name and email as a tag
  const s3Client = new S3Client();
  const s3Command = new PutObjectCommand({
    Bucket: process.env.INPUT_BUCKET_NAME,
    Key: fileName,
    Tagging: `email=${email}`,
  });
  const s3Response = await getSignedUrl(s3Client, s3Command, {
    expiresIn: 3600,
    unhoistableHeaders: new Set(["x-amz-tagging"]),
  });
  console.log("S3 Response", s3Response);

  // Send notification using SNS
  const snsClient = new SNSClient();
  const snsMessage = `A new file has been uploaded with the name: ${fileName}.`;
  const publishParams = {
    TopicArn: process.env.SNS_TOPIC_ARN,
    Message: snsMessage,
    Subject: 'File Upload Notification',
  };

  try {
    await snsClient.send(new PublishCommand(publishParams));
    console.log("Notification sent to SNS");

    // Send the Pre-signed URL to frontend, so that user can directly upload to S3
    return {
      statusCode: 200,
      body: JSON.stringify({
        preSignedURL: s3Response,
        message: 'Notification sent successfully',
      }),
      headers: {
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "OPTIONS,POST",
      },
    };
  } catch (error) {
    console.error("Error sending SNS message", error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Error sending notification',
      }),
      headers: {
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "OPTIONS,POST",
      },
    };
  }
};
