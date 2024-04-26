import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, DeleteCommand } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({});
const dynamo = DynamoDBDocumentClient.from(client);

export const handler = async (event, context) => {

  try {

    const command = new DeleteCommand({
      TableName: process.env.table,
      Key: {
        connectionId: event.requestContext.connectionId
      }
    });

    await dynamo.send(command);

    return { statusCode: 200, };
  } catch (err) {
    return { statusCode: 500, };
  }
};