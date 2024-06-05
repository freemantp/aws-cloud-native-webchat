
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({});
const dynamo = DynamoDBDocumentClient.from(client);

export const handler = async (event, context) => {

  try {

    const command = new PutCommand({
      TableName: "Connections",
      Item: {
        connectionId: event.requestContext.connectionId,
        sourceIp: event.requestContext.identity.sourceIp
      }
    });

    await dynamo.send(command);
    return { statusCode: 200, };

  } catch (err) {

    console.log(err);
    return { statusCode: 500, };

  }
};